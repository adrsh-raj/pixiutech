import hashlib
from io import BytesIO
from pathlib import Path
from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.parsers import FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from core.clamav_client import ClamAVUnavailableError
from accounts.authentication import CachedJWTAuthentication
from accounts.models import UserRole, UserStatus
from accounts.permissions import IsActiveAccount
from audit.models import AuditAction
from audit.services import record_audit
from core.input_sanitization import sanitize_plain_text
from core.upload_security import SecureMultiPartParser, SecureUploadError, validate_uploaded_file
from crm.models import LabEnquiryAttachment, Lead, LeadEnquiryType, LeadSource, LeadStatus
from notifications.models import Notification, NotificationType

User = get_user_model()
LAB_SUPPORT_TYPES = {"bug", "help", "other", "philosophy"}
LAB_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
LAB_IMAGE_MAX_BYTES = 3 * 1024 * 1024

def _clean(value, max_length, *, preserve_newlines=False):
    return sanitize_plain_text(value, max_length, preserve_newlines=preserve_newlines)

def _canonical_sender_id(user):
    """Return the stable human-facing portal ID for the signed-in sender."""
    role = getattr(user, "role", "")
    if role == UserRole.STUDENT:
        try:
            value = str(user.student_profile.student_id or "").strip()
        except Exception:
            value = ""
    elif role == UserRole.TRAINER:
        try:
            value = str(user.trainer_profile.trainer_id or "").strip()
        except Exception:
            value = ""
    elif role == UserRole.ADMIN:
        value = str(getattr(user, "pixiu_id", "") or "").strip()
        if not value:
            raw = str(getattr(user, "display_name", "") or user.get_full_name() or user.username or "").strip()
            value = "".join(ch for ch in raw.upper() if ch.isalnum())
    else:
        try:
            value = str(user.school_profile.school_code or "").strip()
        except Exception:
            value = ""
    return value.strip().upper()


def _lab_secure_derivative(uploaded):
    """Rebuild a raster image when the AV sidecar is temporarily unavailable."""
    original_name = Path(str(getattr(uploaded, "name", "") or "")).name
    extension = Path(original_name).suffix.lower()
    format_map = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}
    output_format = format_map.get(extension)
    if not output_format:
        raise SecureUploadError("Only PNG, JPG, JPEG or WEBP images can be attached.")

    try:
        uploaded.seek(0)
        source = uploaded.read()
        image_file = BytesIO(source)
        from PIL import Image
        image = Image.open(image_file)
        if image.width * image.height > 25_000_000:
            raise SecureUploadError("The attached image dimensions are too large.")
        image.load()

        # Re-encode from decoded pixels. This strips metadata and rejects
        # malformed/active payloads that Pillow cannot safely decode.
        if output_format == "JPEG":
            if image.mode not in {"RGB", "L"}:
                background = Image.new("RGB", image.size, "white")
                if "A" in image.getbands():
                    background.paste(image.convert("RGBA"), mask=image.convert("RGBA").getchannel("A"))
                else:
                    background.paste(image.convert("RGB"))
                image = background
            else:
                image = image.convert("RGB") if image.mode != "RGB" else image
        elif image.mode not in {"1", "L", "LA", "RGB", "RGBA", "P", "I", "F"}:
            image = image.convert("RGBA")

        output = BytesIO()
        save_kwargs = {}
        if output_format == "WEBP":
            save_kwargs = {"quality": 90, "method": 4}
        elif output_format == "JPEG":
            save_kwargs = {"quality": 90, "optimize": True}
        image.save(output, format=output_format, **save_kwargs)
        rebuilt = output.getvalue()
    except Exception as exc:
        raise SecureUploadError("The attached image could not be safely rebuilt.") from exc
    finally:
        try:
            uploaded.seek(0)
        except Exception:
            pass

    if not rebuilt or len(rebuilt) > LAB_IMAGE_MAX_BYTES:
        raise SecureUploadError("The sanitized image is larger than the 3 MB limit.")

    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(
        original_name,
        rebuilt,
        content_type={
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
        }[extension],
    )


def _validate_lab_image(uploaded):
    if uploaded is None:
        return None
    original_name = Path(str(getattr(uploaded, "name", "") or "")).name
    extension = Path(original_name).suffix.lower()
    if extension not in LAB_IMAGE_EXTENSIONS:
        raise SecureUploadError("Only PNG, JPG, JPEG or WEBP images can be attached.")
    if int(getattr(uploaded, "size", 0) or 0) <= 0:
        raise SecureUploadError("The attached image is empty.")
    if int(uploaded.size) > LAB_IMAGE_MAX_BYTES:
        raise SecureUploadError("Lab screenshots/images must be 3 MB or smaller.")

    try:
        return validate_uploaded_file(uploaded, raise_clamav_unavailable=True)
    except ClamAVUnavailableError:
        # Keep normal AV scanning as the first choice. During a temporary
        # ClamAV outage, rebuild the already type/signature/Pillow-validated
        # raster image, then run the full file validation again without AV.
        derivative = _lab_secure_derivative(uploaded)
        return validate_uploaded_file(derivative, scan=False)

class PublicEnquiryView(APIView):
    permission_classes = [AllowAny]
    # JWT is optional for the public sales form, but required for authenticated Lab support.
    authentication_classes = [CachedJWTAuthentication]
    parser_classes = [SecureMultiPartParser, FormParser]
    throttle_scope = "public_enquiry"

    def post(self, request):
        enquiry_type = _clean(request.data.get("enquiry_type") or request.data.get("kind") or "sales", 20).lower()
        if enquiry_type not in {"sales", *LAB_SUPPORT_TYPES}:
            return Response({"success": False, "error": "Unsupported enquiry type."}, status=400)

        website = _clean(request.data.get("website"), 120)
        if website:
            return Response({"success": False, "error": "Unable to process this enquiry."}, status=400)

        message = _clean(request.data.get("message"), 4000, preserve_newlines=True)
        student_id = _clean(request.data.get("student_id"), 80)
        raw_attachment = request.FILES.get("image") or request.FILES.get("attachment")

        if enquiry_type in LAB_SUPPORT_TYPES:
            if not request.user.is_authenticated:
                return Response({"success": False, "error": "Please sign in to the Lab before sending support."}, status=401)
            canonical_id = _canonical_sender_id(request.user)
            if not canonical_id:
                return Response({"success": False, "error": "Your account does not have a valid portal ID."}, status=400)
            student_id = canonical_id
            if not message:
                return Response({"success": False, "error": "Please describe the problem or question."}, status=400)
            try:
                attachment = _validate_lab_image(raw_attachment)
            except SecureUploadError as exc:
                return Response({"success": False, "error": str(exc)}, status=400)
            school = "PIXIU Virtual Lab"
            person = canonical_id
            phone = _clean(request.data.get("phone"), 30)
            email = _clean(request.data.get("email"), 254)
            city = ""
            expected_students = 0
        else:
            attachment = None
            school = _clean(request.data.get("school"), 250)
            person = _clean(request.data.get("person"), 200)
            phone = _clean(request.data.get("phone"), 30)
            email = _clean(request.data.get("email"), 254)
            city = _clean(request.data.get("city"), 120)
            raw_strength = _clean(request.data.get("strength"), 10)
            if not school or not person or not phone or not email:
                return Response({"success": False, "error": "School name, contact person, phone and email are required."}, status=400)
            try:
                expected_students = max(0, min(int(raw_strength or 0), 100000))
            except ValueError:
                expected_students = 0

        owner = User.objects.filter(role=UserRole.ADMIN, status=UserStatus.ACTIVE, is_active=True).order_by("id").first()
        if not owner:
            return Response({"success": False, "error": "Enquiry service is temporarily unavailable."}, status=503)

        type_label = {
            LeadEnquiryType.SALES: "Sales",
            LeadEnquiryType.BUG: "Bug",
            LeadEnquiryType.HELP: "Help",
            LeadEnquiryType.OTHER: "Other",
            LeadEnquiryType.PHILOSOPHY: "Think / Rethink Philosophy",
        }[enquiry_type]

        notes = "\n".join(part for part in [
            f"Pixiu ID: {student_id}" if student_id else "",
            f"Category: {type_label}",
            f"City: {city}" if city else "",
            f"Student Strength: {expected_students}" if expected_students else "",
            f"Website Message: {message}" if message else "",
            "Source: PIXIU Virtual Lab Support" if enquiry_type in LAB_SUPPORT_TYPES else "Source: pixiutech.com Contact Form",
        ] if part)

        try:
            with transaction.atomic():
                lead = Lead.objects.create(
                    organization_name=school,
                    contact_name=person,
                    email=email,
                    phone=phone,
                    source=LeadSource.WEBSITE,
                    enquiry_type=enquiry_type,
                    status=LeadStatus.NEW,
                    owner=owner,
                    expected_students=expected_students,
                    estimated_value=0,
                    notes=notes,
                )

                if attachment is not None:
                    original_name = _clean(getattr(raw_attachment, "name", "image"), 255)
                    attachment.seek(0)
                    digest = hashlib.sha256(attachment.read()).hexdigest()
                    attachment.seek(0)
                    record = LabEnquiryAttachment(
                        lead=lead,
                        original_name=original_name,
                        size=int(attachment.size),
                        content_type=str(getattr(attachment, "content_type", "") or "application/octet-stream"),
                        sha256=digest,
                    )
                    record.file.save(Path(attachment.name).name, attachment, save=False)
                    record.save()

                record_audit(
                    actor=None,
                    action=AuditAction.CREATE,
                    entity_type="Lead",
                    entity_id=lead.id,
                    summary=f"Website enquiry captured for {school}",
                    changes={
                        "source": LeadSource.WEBSITE,
                        "enquiry_type": enquiry_type,
                        "email": email,
                        "city": city,
                        "expected_students": expected_students,
                        "pixiu_id": student_id,
                        "has_attachment": attachment is not None,
                        "sender_role": str(getattr(request.user, "role", "") or ""),
                        "sender_id": student_id,
                    },
                    request=request,
                )

                # Mandatory operational notification: every Lab enquiry creates
                # an unread server-side in-app notification for every active admin,
                # independent of optional user notification preferences.
                admin_ids = list(
                    User.objects.filter(
                        role=UserRole.ADMIN,
                        status=UserStatus.ACTIVE,
                        is_active=True,
                    ).values_list("id", flat=True)
                )
                sender_label = student_id or person or email or "Website contact"
                notification_message = (
                    f"New {type_label} enquiry from {sender_label}. "
                    "Open Website Enquiries to review the report."
                )
                notification_source = "PIXIU Virtual Lab" if enquiry_type in LAB_SUPPORT_TYPES else "pixiutech.com Website"
                metadata = {
                    "source": notification_source,
                    "lead_id": str(lead.id),
                    "enquiry_type": enquiry_type,
                    "sender_id": student_id,
                    "sender_role": str(getattr(request.user, "role", "") or ""),
                    "requires_action": True,
                }
                for admin_id in admin_ids:
                    Notification.objects.get_or_create(
                        recipient_id=admin_id,
                        event_key=f"lab-enquiry:{lead.id}:{admin_id}",
                        defaults={
                            "notification_type": NotificationType.CRM,
                            "title": f"New Lab enquiry · {type_label}",
                            "message": notification_message,
                            "metadata": metadata,
                        },
                    )
        except SecureUploadError as exc:
            return Response({"success": False, "error": str(exc)}, status=400)

        return Response({"success": True, "lead_id": str(lead.id), "status": lead.status}, status=201)

class LabEnquiryAttachmentView(APIView):
    """Serve Lab screenshots through the authenticated admin inbox only."""

    permission_classes = [IsAuthenticated, IsActiveAccount]
    authentication_classes = [CachedJWTAuthentication]

    def get(self, request, attachment_id):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only administrators can view Lab enquiry attachments.")

        attachment = get_object_or_404(LabEnquiryAttachment, pk=attachment_id)
        if not attachment.file:
            return Response({"success": False, "error": "Attachment is unavailable."}, status=404)

        content_type = str(attachment.content_type or "application/octet-stream").split(";", 1)[0].lower()
        if content_type not in {"image/png", "image/jpeg", "image/webp"}:
            content_type = "application/octet-stream"

        response = FileResponse(attachment.file.open("rb"), content_type=content_type)
        safe_name = _clean(getattr(attachment, "original_name", "image"), 255) or "image"
        response["Content-Disposition"] = f"inline; filename*=UTF-8''{quote(safe_name)}"
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
