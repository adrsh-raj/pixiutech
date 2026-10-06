import hashlib
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

from accounts.models import UserRole, UserStatus
from audit.models import AuditAction
from audit.services import record_audit
from core.input_sanitization import sanitize_plain_text
from core.upload_security import SecureMultiPartParser, SecureUploadError, validate_uploaded_file
from crm.models import LabEnquiryAttachment, Lead, LeadEnquiryType, LeadSource, LeadStatus

User = get_user_model()
LAB_SUPPORT_TYPES = {"bug", "help", "other", "philosophy"}
LAB_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
LAB_IMAGE_MAX_BYTES = 3 * 1024 * 1024

def _clean(value, max_length, *, preserve_newlines=False):
    return sanitize_plain_text(value, max_length, preserve_newlines=preserve_newlines)

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
    return validate_uploaded_file(uploaded)

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
            if request.user.role == UserRole.STUDENT:
                try:
                    verified_student_id = str(request.user.student_profile.student_id).strip().upper()
                except Exception:
                    verified_student_id = ""
                if verified_student_id:
                    student_id = verified_student_id
            if not student_id:
                return Response({"success": False, "error": "Student ID is required."}, status=400)
            if not message:
                return Response({"success": False, "error": "Please describe the problem or question."}, status=400)
            try:
                attachment = _validate_lab_image(raw_attachment)
            except SecureUploadError as exc:
                return Response({"success": False, "error": str(exc)}, status=400)
            school = "PIXIU Virtual Lab"
            person = f"Lab User · {student_id}"
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
            f"Student ID: {student_id}" if student_id else "",
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
                        "student_id": student_id,
                        "has_attachment": attachment is not None,
                    },
                    request=request,
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
