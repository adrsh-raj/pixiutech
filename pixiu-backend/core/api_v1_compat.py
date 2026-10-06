from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.views import SchoolClassViewSet, SchoolViewSet, StudentViewSet, TrainerViewSet
from billing.models import Invoice, PaymentMethod
from billing.serializers import InvoiceSerializer, PaymentSerializer, ReceiptSerializer
from billing.services import record_payment, recalculate_invoice
from billing.views import InvoiceViewSet
from crm.models import Lead, LeadStatus
from crm.views import LeadViewSet
from inventory.views import KitViewSet
from learning.models import AttendanceRecord, Session
from learning.serializers import AttendanceRecordSerializer, CurriculumUnitSerializer, LearningContentSerializer, ProjectSerializer, QuizAttemptReadSerializer, QuizSerializer, SessionSerializer, StudentAssessmentSerializer
from learning.views import AssessmentViewSet, AttendanceViewSet, ContentViewSet, CurriculumUnitViewSet, ProjectViewSet, QuizAttemptViewSet, QuizViewSet, SessionViewSet
from notifications.models import Notification
from notifications.views import NotificationViewSet

User = get_user_model()


def _first(data, *keys, default=None):
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return value
    return default


def _date_only(value):
    if value in (None, ""):
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        return raw[:10]
    for separator in ("-", "/"):
        parts = raw.split(separator)
        if len(parts) == 3 and all(part.isdigit() for part in parts):
            first, second, year = parts
            if len(year) == 4 and len(first) in (1, 2) and len(second) in (1, 2):
                first_num, second_num = int(first), int(second)
                if first_num > 12 and second_num <= 12:
                    day, month = first_num, second_num
                else:
                    month, day = first_num, second_num
                if 1 <= day <= 31 and 1 <= month <= 12:
                    return f"{year}-{month:02d}-{day:02d}"
    return raw


def _school(value):
    if not value:
        return None
    raw = str(value).strip()
    try:
        obj = School.objects.filter(pk=raw).first()
    except (ValueError, TypeError):
        obj = None
    return obj or School.objects.filter(school_code=raw.upper()).first()


def _trainer(value):
    if not value:
        return None
    raw = str(value).strip()
    try:
        obj = Trainer.objects.filter(pk=raw).first()
    except (ValueError, TypeError):
        obj = None
    return obj or Trainer.objects.filter(trainer_id=raw.upper()).first()


def _class(value, school=None):
    if not value:
        return None
    try:
        obj = SchoolClass.objects.filter(pk=value).first()
    except (ValueError, TypeError):
        obj = None
    if obj:
        return obj
    raw = str(value).strip().upper()
    if raw.startswith("CLS-"):
        raw = raw[4:]
    if school and "-" in raw:
        raw = raw.rsplit("-", 1)[-1]
    if school:
        return SchoolClass.objects.filter(school=school, display_name=raw).first()
    return SchoolClass.objects.filter(display_name=raw).first()


def _student(value):
    if not value:
        return None
    raw = str(value).strip()
    try:
        obj = Student.objects.filter(pk=raw).first()
    except (ValueError, TypeError):
        obj = None
    return obj or Student.objects.filter(student_id=raw.upper()).first()


def _trainer_assignment(user, school):
    return TrainerSchoolAssignment.objects.filter(trainer__account=user, school=school, status="active").first()


def _legacy_school(obj):
    return {"id": str(obj.pk), "school_id": obj.school_code, "code": obj.school_code, "school_code": obj.school_code, "name": obj.name, "email": getattr(obj.account, "email", "") if obj.account_id else "", "status": getattr(obj, "status", "active")}


def _legacy_trainer(obj):
    assignments = TrainerSchoolAssignment.objects.filter(trainer=obj, status="active").select_related("school")
    assigned_codes = [assignment.school.school_code for assignment in assignments]
    return {"id": str(obj.pk), "trainer_id": obj.trainer_id, "name": obj.name, "email": getattr(obj.account, "email", "") if obj.account_id else "", "phone": obj.phone, "status": obj.status, "assigned_schools": assigned_codes}


def _legacy_student(obj):
    school = obj.school_class.school if obj.school_class_id else None
    return {"id": str(obj.pk), "student_id": obj.student_id, "name": obj.name, "email": getattr(obj.account, "email", "") if obj.account_id else "", "status": obj.status, "class_id": str(obj.school_class_id) if obj.school_class_id else "", "class_name": obj.school_class.display_name if obj.school_class_id else "", "school_id": school.school_code if school else "", "school_code": school.school_code if school else "", "school": school.name if school else "", "school_name": school.name if school else "", "roll_number": obj.roll_number, "date_of_birth": obj.date_of_birth.isoformat() if obj.date_of_birth else None, "gender": obj.gender, "phone": obj.phone, "guardian_name": obj.guardian_name, "guardian_phone": obj.guardian_phone, "guardian_email": obj.guardian_email, "address": obj.address, "current_level": obj.current_level}


def _legacy_class(obj):
    return {"id": str(obj.pk), "class_id": f"CLS-{obj.school.school_code}-{obj.grade}{obj.section}", "school_id": obj.school.school_code, "grade": obj.grade, "section": obj.section, "display_name": obj.display_name, "status": obj.status}


class LegacyShapeMixin:
    def map_in(self, data):
        return data

    def map_out(self, obj):
        return obj

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=self.map_in(request.data))
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        obj = self.get_object() if getattr(serializer.instance, "pk", None) is None else serializer.instance
        return Response(self.map_out(obj), status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=self.map_in(request.data), partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(self.map_out(serializer.instance))

    def retrieve(self, request, *args, **kwargs):
        return Response(self.map_out(self.get_object()))

    def list(self, request, *args, **kwargs):
        return Response([self.map_out(obj) for obj in self.filter_queryset(self.get_queryset())])


class ContractSchoolViewSet(LegacyShapeMixin, SchoolViewSet):
    def map_in(self, data):
        payload = dict(data)
        payload["name"] = _first(data, "name", "school_name", default="")
        payload["school_code"] = _first(data, "school_code", "school_id", "code")
        return payload

    def map_out(self, obj):
        return _legacy_school(obj)


class ContractTrainerViewSet(LegacyShapeMixin, TrainerViewSet):
    def map_in(self, data):
        payload = dict(data)
        payload["trainer_id"] = _first(data, "trainer_id", "id", default=None)
        payload["name"] = _first(data, "name", "trainer_name", default="")
        return payload

    def map_out(self, obj):
        return _legacy_trainer(obj)


class ContractClassViewSet(LegacyShapeMixin, SchoolClassViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code"))
        payload = dict(data)
        if school:
            payload["school"] = str(school.pk)
        payload["grade"] = _first(data, "grade", "class_grade", default="")
        payload["section"] = _first(data, "section", default="A")
        return payload

    def map_out(self, obj):
        return _legacy_class(obj)


class ContractStudentViewSet(LegacyShapeMixin, StudentViewSet):
    def map_in(self, data):
        school_class = _class(_first(data, "school_class", "class_id", "class"), school=_school(_first(data, "school", "school_id", "school_code")))
        payload = dict(data)
        if school_class:
            payload["school_class"] = str(school_class.pk)
        payload["student_id"] = _first(data, "student_id", "id", default=None)
        payload["name"] = _first(data, "name", "student_name", default="")
        payload["date_of_birth"] = _date_only(data.get("date_of_birth"))
        return payload

    def map_out(self, obj):
        return _legacy_student(obj)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=self.map_in(request.data))
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        student = serializer.instance
        payload = _legacy_student(student)
        payload["initial_password"] = serializer.generated_password
        return Response(payload, status=status.HTTP_201_CREATED, headers=self.get_success_headers(payload))


class ContractSessionViewSet(LegacyShapeMixin, SessionViewSet):
    def map_in(self, data):
        payload = dict(data)
        payload["school_class"] = str(_class(_first(data, "school_class", "class_id", "class"), school=_school(_first(data, "school", "school_id", "school_code"))).pk) if _class(_first(data, "school_class", "class_id", "class"), school=_school(_first(data, "school", "school_id", "school_code"))) else _first(data, "school_class", "class_id", "class")
        payload["trainer"] = str(_trainer(_first(data, "trainer", "trainer_id")).pk) if _trainer(_first(data, "trainer", "trainer_id")) else _first(data, "trainer", "trainer_id")
        return payload

    def map_out(self, obj):
        return SessionSerializer(obj, context={"request": self.request}).data


class ContractAttendanceViewSet(LegacyShapeMixin, AttendanceViewSet):
    def map_in(self, data):
        payload = dict(data)
        payload["session"] = _first(data, "session", "session_id")
        payload["student"] = _first(data, "student", "student_id")
        payload["status"] = str(_first(data, "status", default="absent")).lower()
        return payload

    def map_out(self, obj):
        return AttendanceRecordSerializer(obj, context={"request": self.request}).data

    @action(detail=False, methods=["put"], url_path="admin-override")
    def admin_override(self, request):
        self.assert_role(UserRole.ADMIN)
        session = Session.objects.filter(pk=_first(request.data, "session", "session_id")).first()
        student = _student(_first(request.data, "student", "student_id"))
        if not session or not student:
            raise ValidationError("Session and student are required.")
        from learning.services import create_attendance
        obj = create_attendance(user=request.user, session=session, student=student, status=str(_first(request.data, "status", default="absent")).lower(), note=str(_first(request.data, "note", default="")))
        return Response(self.map_out(obj))


class ContractCurriculumViewSet(LegacyShapeMixin, CurriculumUnitViewSet):
    def map_in(self, data):
        return dict(data)

    def map_out(self, obj):
        return CurriculumUnitSerializer(obj, context={"request": self.request}).data


class ContractAssessmentViewSet(LegacyShapeMixin, AssessmentViewSet):
    def map_in(self, data):
        return data

    def map_out(self, obj):
        return StudentAssessmentSerializer(obj, context={"request": self.request}).data


class ContractProjectViewSet(LegacyShapeMixin, ProjectViewSet):
    def map_in(self, data):
        return data

    def map_out(self, obj):
        return ProjectSerializer(obj, context={"request": self.request}).data


class ContractQuizViewSet(LegacyShapeMixin, QuizViewSet):
    def map_in(self, data):
        return data

    def map_out(self, obj):
        return QuizSerializer(obj, context={"request": self.request}).data


class ContractQuizAttemptViewSet(LegacyShapeMixin, QuizAttemptViewSet):
    def map_in(self, data):
        return data

    def map_out(self, obj):
        return QuizAttemptReadSerializer(obj, context={"request": self.request}).data


class ContractContentViewSet(LegacyShapeMixin, ContentViewSet):
    def map_in(self, data):
        return data

    def map_out(self, obj):
        return LearningContentSerializer(obj, context={"request": self.request}).data


class ContractSchoolClassViewSet(LegacyShapeMixin, SchoolClassViewSet):
    def map_in(self, data):
        return data

    def map_out(self, obj):
        return _legacy_class(obj)


class ContractBillingFullViewSet(LegacyShapeMixin, InvoiceViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code"))
        school_class = _class(_first(data, "school_class", "class_id"), school=school)
        trainer = _trainer(_first(data, "trainer", "trainer_id"))
        issue_date = _first(data, "issue_date", "date", default=timezone.localdate())
        return {"school": str(school.pk) if school else _first(data, "school", "school_id"), "school_class": str(school_class.pk) if school_class else None, "trainer": str(trainer.pk) if trainer else None, "issue_date": issue_date, "due_date": _first(data, "due_date", default=issue_date), "notes": _first(data, "notes", "payment_notes", default=""), "tax_amount": _first(data, "tax_amount", "tax", default=0)}

    def map_out(self, obj):
        data = InvoiceSerializer(obj, context={"request": self.request}).data
        paid = float(obj.amount_paid)
        total = float(obj.total_amount)
        return {**data, "school_id": obj.school.school_code, "amount": total, "paid_amount": paid, "pending_amount": max(0, total - paid), "status": obj.status}

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        invoice = self.get_object()
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        desired = str(_first(request.data, "status", default=invoice.status)).lower()
        if desired == "issued":
            if invoice.status != "draft":
                raise ValidationError("Only draft invoices can be issued.")
            recalculate_invoice(invoice)
            invoice.status = "issued"
            invoice.save(update_fields=["status", "updated_at"])
        elif desired == "void":
            if invoice.status == "paid":
                raise ValidationError("Paid invoices cannot be voided without a controlled finance adjustment.")
            invoice.status = "void"
            invoice.save(update_fields=["status", "updated_at"])
        else:
            raise ValidationError("Invoice status is lifecycle-controlled. Use issued or void.")
        return Response(self.map_out(invoice))

    @action(detail=True, methods=["put"], url_path="confirm-payment")
    def confirm_payment(self, request, pk=None):
        invoice = self.get_object()
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        confirmed = _first(request.data, "is_confirmed", default=True)
        confirmed = confirmed.lower() in {"true", "1", "yes"} if isinstance(confirmed, str) else bool(confirmed)
        if not confirmed:
            return Response(self.map_out(invoice))
        amount = _first(request.data, "amount", "payment_amount", default=max(float(invoice.total_amount - invoice.amount_paid), 0))
        method = str(_first(request.data, "payment_method", "method", default="other")).lower()
        method = method if method in {choice.value for choice in PaymentMethod} else "other"
        payment, receipt = record_payment(recorded_by=request.user, invoice=invoice, amount=amount, method=method, payment_date=timezone.now(), transaction_reference=str(_first(request.data, "transaction_id", "transaction_reference", default="")), notes=str(_first(request.data, "payment_notes", "notes", default="")))
        invoice.refresh_from_db()
        payload = self.map_out(invoice)
        payload["payment"] = PaymentSerializer(payment).data
        payload["receipt"] = ReceiptSerializer(receipt).data
        return Response(payload)


class ContractInventoryViewSet(LegacyShapeMixin, KitViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school_id", "school_code"))
        school_class = _class(_first(data, "school_class", "class_id"), school=school)
        return {"kit_code": _first(data, "kit_code", "id", default=f"KIT-{timezone.now().strftime('%Y%m%d%H%M%S%f')[:18]}"), "name": _first(data, "name", "title", default="Class Kit"), "description": _first(data, "description", default=""), "school_class": str(school_class.pk) if school_class else None, "status": "active" if str(_first(data, "status", default="active")).lower() in {"active", "available", "ready"} else "inactive"}

    def map_out(self, obj):
        return {"id": str(obj.pk), "kit_code": obj.kit_code, "name": obj.name, "description": obj.description, "class_id": f"CLS-{obj.school_class.school.school_code}-{obj.school_class.grade}{obj.school_class.section}" if obj.school_class else "", "school_id": obj.school_class.school.school_code if obj.school_class else "", "status": obj.status}

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        kit = self.get_object()
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        kit.status = "active" if str(_first(request.data, "status", default="active")).lower() in {"active", "available", "ready"} else "inactive"
        kit.save(update_fields=["status", "updated_at"])
        return Response(self.map_out(kit))


class ContractLeadViewSet(LegacyShapeMixin, LeadViewSet):
    def get_queryset(self):
        return super().get_queryset().prefetch_related("lab_attachments")

    def map_in(self, data):
        return {
            "organization_name": _first(data, "organization_name", "name", default=""),
            "contact_name": _first(data, "contact_name", "contact_person", default=""),
            "email": _first(data, "email", default=""),
            "phone": _first(data, "phone", default=""),
            "source": str(_first(data, "source", default="other")).lower(),
            "enquiry_type": str(_first(data, "enquiry_type", "kind", default="sales")).lower(),
            "status": str(_first(data, "status", "stage", default="new")).lower().replace(" ", "_"),
            "expected_students": int(_first(data, "expected_students", default=0) or 0),
            "estimated_value": _first(data, "estimated_value", "expected_value", default=0),
            "next_follow_up": _first(data, "next_follow_up"),
            "notes": _first(data, "notes", default=""),
        }

    def map_out(self, obj):
        attachments = []
        for attachment in obj.lab_attachments.all():
            try:
                url = attachment.file.url if attachment.file else ""
            except Exception:
                url = ""
            attachments.append({
                "id": str(attachment.pk),
                "original_name": attachment.original_name,
                "size": attachment.size,
                "content_type": attachment.content_type,
                "created_at": attachment.created_at,
                "url": url,
            })
        return {
            "id": str(obj.pk),
            "name": obj.organization_name,
            "organization_name": obj.organization_name,
            "contact_person": obj.contact_name,
            "email": obj.email,
            "phone": obj.phone,
            "source": obj.source,
            "enquiry_type": obj.enquiry_type,
            "stage": obj.status,
            "status": obj.status,
            "expected_students": obj.expected_students,
            "expected_value": float(obj.estimated_value),
            "estimated_value": float(obj.estimated_value),
            "notes": obj.notes,
            "lab_attachments": attachments,
        }

    @action(detail=True, methods=["put"], url_path="stage")
    def stage(self, request, pk=None):
        lead = self.get_object()
        desired = str(_first(request.data, "stage", "status", default=lead.status)).lower().replace(" ", "_")
        if desired not in {choice[0] for choice in LeadStatus.choices}:
            raise ValidationError("Unsupported lead stage.")
        lead.status = desired
        lead.save(update_fields=["status", "updated_at"])
        return Response(self.map_out(lead))


class ContractReviewViewSet(ContractAssessmentViewSet):
    pass


class ContractNotificationViewSet(LegacyShapeMixin, NotificationViewSet):
    def map_out(self, obj):
        return {"id": str(obj.pk), "title": obj.title, "message": obj.message, "type": obj.notification_type, "severity": "urgent" if obj.notification_type == "warning" else "info", "read": bool(obj.read_at), "created_at": obj.created_at, "target_type": "User", "target_user_id": obj.recipient_id}

    def map_in(self, data):
        recipient = User.objects.filter(pk=_first(data, "recipient")).first() or self.request.user
        kind = str(_first(data, "notification_type", "type", default="info")).lower()
        kind = kind if kind in {"info", "success", "warning", "action", "payment", "inventory", "crm", "system"} else "info"
        return {"recipient": recipient.pk, "notification_type": kind, "title": _first(data, "title", default="Notification"), "message": _first(data, "message", default=""), "event_key": str(_first(data, "event_key", default=f"portal-{timezone.now().timestamp()}"))}

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.ADMIN and request.data.get("target_type"):
            raise PermissionDenied("Only administrators can send targeted notifications.")
        return super().create(request, *args, **kwargs)


@api_view(["GET", "HEAD"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok", "service": "Pixiu Django API", "version": "v1"})


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def upload(request):
    uploaded = request.FILES.get("file")
    if not uploaded:
        raise ValidationError({"file": "No file uploaded."})
    path = default_storage.save(f"uploads/{uploaded.name}", ContentFile(uploaded.read()))
    return Response({"url": default_storage.url(path), "path": path}, status=status.HTTP_201_CREATED)
