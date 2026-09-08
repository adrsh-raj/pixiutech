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


def _legacy_school(obj):
    return {"id": str(obj.pk), "school_id": obj.school_code, "legacy_id": obj.school_code, "code": obj.school_code, "account_username": obj.account.username if obj.account_id else "", "name": obj.name, "principal": obj.principal_name, "principal_name": obj.principal_name, "contact": obj.phone, "phone": obj.phone, "email": obj.email, "address": obj.address, "lab_name": obj.lab_name, "lab_location": obj.lab_location, "lab_capacity": obj.lab_capacity, "lab_notes": obj.lab_notes, "status": "Active" if obj.status == "active" else "Inactive", "created_at": obj.created_at, "updated_at": obj.updated_at}


def _legacy_trainer(obj):
    assignments = obj.school_assignments.filter(status="active").select_related("school")
    return {"id": str(obj.pk), "trainer_id": obj.trainer_id, "legacy_id": obj.trainer_id, "name": obj.name, "email": obj.email, "phone": obj.phone, "qualification": obj.qualification, "specialization": obj.specialization, "daily_rate": obj.daily_rate, "weekly_days": obj.weekly_days, "monthly_compensation": obj.monthly_compensation, "rating": obj.rating, "assigned_schools": [a.school.school_code for a in assignments], "status": "Active" if obj.status == "active" else "Inactive", "created_at": obj.created_at, "updated_at": obj.updated_at}


def _legacy_class(obj):
    code = obj.school.school_code
    return {"id": str(obj.pk), "class_id": f"CLS-{code}-{obj.grade}{obj.section}", "school_id": code, "school": str(obj.school.pk), "school_code": code, "grade": obj.grade, "section": obj.section, "display_name": obj.display_name, "status": "Active" if obj.status == "active" else "Inactive"}


def _legacy_student(obj):
    code = obj.school_class.school.school_code
    return {"id": str(obj.pk), "student_id": obj.student_id, "school_id": code, "class_id": f"CLS-{code}-{obj.school_class.grade}{obj.school_class.section}", "class_name": obj.school_class.display_name, "name": obj.name, "roll_number": obj.roll_number, "date_of_birth": obj.date_of_birth, "gender": obj.gender, "email": obj.email, "phone": obj.phone, "guardian_name": obj.guardian_name, "guardian_phone": obj.guardian_phone, "guardian_email": obj.guardian_email, "address": obj.address, "current_level": obj.current_level, "status": "Active" if obj.status == "active" else "Inactive", "created_at": obj.created_at, "updated_at": obj.updated_at}


def _legacy_session(obj):
    code = obj.school_class.school.school_code
    return {"id": str(obj.pk), "school_id": code, "class_id": f"CLS-{code}-{obj.school_class.grade}{obj.school_class.section}", "trainer_id": obj.trainer.trainer_id, "date": obj.date, "start_time": obj.start_time, "end_time": obj.end_time, "topic": obj.topic, "notes": obj.notes, "status": obj.status, "is_locked": obj.is_locked, "class_name": obj.school_class.display_name}


class LegacyShapeMixin:
    def map_in(self, data): return data
    def map_out(self, obj): return obj
    def _mapped_request(self):
        original = dict(self.request.data); self.request._full_data = self.map_in(original); return original
    def _restore_request(self, original): self.request._full_data = original
    def create(self, request, *args, **kwargs):
        original = self._mapped_request()
        try: response = super().create(request, *args, **kwargs)
        finally: self._restore_request(original)
        data = response.data if isinstance(response.data, dict) else {}; obj = self.get_queryset().filter(pk=data.get("id")).first() if data.get("id") else None
        if obj is not None: response.data = self.map_out(obj)
        return response
    def update(self, request, *args, **kwargs):
        original = self._mapped_request()
        try: response = super().update(request, *args, **kwargs)
        finally: self._restore_request(original)
        obj = self.get_queryset().filter(pk=kwargs.get("pk")).first()
        if obj is not None: response.data = self.map_out(obj)
        return response
    def partial_update(self, request, *args, **kwargs): kwargs["partial"] = True; return self.update(request, *args, **kwargs)
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs); response.data = [self.map_out(obj) for obj in self.filter_queryset(self.get_queryset())]; return response
    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs); response.data = self.map_out(self.get_object()); return response


class ContractSchoolViewSet(LegacyShapeMixin, SchoolViewSet):
    def get_object(self):
        raw = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field); queryset = self.filter_queryset(self.get_queryset())
        obj = queryset.filter(pk=raw).first() or queryset.filter(school_code=str(raw).strip().upper()).first()
        if obj is None:
            from django.http import Http404
            raise Http404
        self.check_object_permissions(self.request, obj); return obj
    def map_in(self, data):
        value = str(_first(data, "status", default="active")).lower(); return {"school_code": str(_first(data, "school_code", "code", "id", default="")).strip().upper(), "name": _first(data, "name", default=""), "principal_name": _first(data, "principal_name", "principal", default=""), "phone": _first(data, "phone", "contact", default=""), "email": _first(data, "email", default=""), "address": _first(data, "address", default=""), "lab_name": _first(data, "lab_name", default=""), "lab_location": _first(data, "lab_location", default=""), "lab_capacity": _first(data, "lab_capacity"), "lab_notes": _first(data, "lab_notes", default=""), "status": "active" if value in {"active", "true", "1"} else "inactive"}
    def map_out(self, obj): return _legacy_school(obj)
    @action(detail=True, methods=["post"], url_path="assign-trainer")
    def assign_trainer(self, request, pk=None):
        school = self.get_object(); self.assert_role(UserRole.ADMIN); trainer = _trainer(_first(request.data, "trainer_id", "trainer"))
        with transaction.atomic():
            TrainerSchoolAssignment.objects.filter(school=school, status="active").update(status="inactive", assigned_to=timezone.localdate())
            if trainer: TrainerSchoolAssignment.objects.update_or_create(trainer=trainer, school=school, assigned_from=timezone.localdate(), defaults={"status": "active", "assigned_to": None})
        return Response(_legacy_school(school))


class ContractTrainerViewSet(LegacyShapeMixin, TrainerViewSet):
    def map_in(self, data):
        value = str(_first(data, "status", default="active")).lower(); return {"trainer_id": str(_first(data, "trainer_id", "legacy_id", "id", default="")).strip().upper(), "name": _first(data, "name", default=""), "email": _first(data, "email", default=""), "phone": _first(data, "phone", default=""), "qualification": _first(data, "qualification", default=""), "specialization": _first(data, "specialization", default=""), "daily_rate": _first(data, "daily_rate"), "weekly_days": _first(data, "weekly_days"), "monthly_compensation": _first(data, "monthly_compensation"), "rating": _first(data, "rating"), "status": "active" if value in {"active", "true", "1"} else "inactive"}
    def map_out(self, obj): return _legacy_trainer(obj)
    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        trainer = self.get_object(); self.assert_role(UserRole.ADMIN); value = str(_first(request.data, "status", default="active")).lower(); trainer.status = "active" if value in {"active", "true", "1"} else "inactive"; trainer.save(update_fields=["status", "updated_at"]); return Response(_legacy_trainer(trainer))


class ContractClassViewSet(LegacyShapeMixin, SchoolClassViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code")); return {"school": str(school.pk) if school else _first(data, "school"), "grade": _first(data, "grade", default=""), "section": _first(data, "section", default=""), "display_name": _first(data, "display_name", default=""), "status": "active" if str(_first(data, "status", default="active")).lower() in {"active", "true", "1"} else "inactive"}
    def map_out(self, obj): return _legacy_class(obj)


class ContractStudentViewSet(LegacyShapeMixin, StudentViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code")); school_class = _class(_first(data, "school_class", "class_id", "class"), school=school); student_id = str(_first(data, "student_id", default="")); roll = _first(data, "roll_number")
        if roll is None and student_id:
            try: roll = int(student_id.split()[-1])
            except (ValueError, IndexError): roll = 1
        return {"school_class": str(school_class.pk) if school_class else _first(data, "school_class", "class_id"), "roll_number": int(roll or 1), "name": _first(data, "name", default=""), "date_of_birth": _first(data, "date_of_birth"), "gender": _first(data, "gender", default=""), "email": _first(data, "email", default=""), "phone": _first(data, "phone", default=""), "guardian_name": _first(data, "guardian_name", default=""), "guardian_phone": _first(data, "guardian_phone", default=""), "guardian_email": _first(data, "guardian_email", default=""), "address": _first(data, "address", default=""), "current_level": _first(data, "current_level", default=""), "status": "active" if str(_first(data, "status", default="active")).lower() in {"active", "true", "1"} else "inactive"}
    def map_out(self, obj): return _legacy_student(obj)


class ContractSessionViewSet(LegacyShapeMixin, SessionViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code")); trainer = _trainer(_first(data, "trainer", "trainer_id")); school_class = _class(_first(data, "school_class", "class_id", "class"), school=school)
        return {"school_class": str(school_class.pk) if school_class else _first(data, "school_class", "class_id"), "trainer": str(trainer.pk) if trainer else _first(data, "trainer", "trainer_id"), "date": _first(data, "date", default=timezone.localdate()), "start_time": _first(data, "start_time"), "end_time": _first(data, "end_time"), "topic": _first(data, "topic", default=""), "notes": _first(data, "notes", default="")}
    def map_out(self, obj): return _legacy_session(obj)
    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        self.required_action = "EDIT"
        session = self.get_object(); self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        from learning.services import start_session
        return Response(self.map_out(start_session(user=request.user, session=session)))
    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        self.required_action = "EDIT"
        session = self.get_object(); self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        from learning.services import complete_session
        return Response(self.map_out(complete_session(user=request.user, session=session)))
    @action(detail=True, methods=["post", "put"], url_path="unlock")
    def unlock(self, request, pk=None):
        self.required_action = "EDIT"
        session = self.get_object(); self.assert_role(UserRole.ADMIN)
        if not session.is_locked: raise ValidationError("Session is already unlocked.")
        session.is_locked = False; session.save(update_fields=["is_locked", "updated_at"]); return Response(self.map_out(session))


class ContractAttendanceViewSet(LegacyShapeMixin, AttendanceViewSet):
    def map_in(self, data):
        session = Session.objects.filter(pk=_first(data, "session", "session_id")).first(); student = _student(_first(data, "student", "student_id"));
        status_value = str(_first(data, "status", default="absent")).strip().lower()
        if status_value not in {"present", "absent", "late", "excused"}: status_value = "absent"
        return {"session": str(session.pk) if session else _first(data, "session", "session_id"), "student": str(student.pk) if student else _first(data, "student", "student_id"), "status": status_value, "note": _first(data, "note", default="")}
    def map_out(self, obj): return AttendanceRecordSerializer(obj, context={"request": self.request}).data
    def list(self, request, *args, **kwargs):
        qs = self.scoped_queryset()
        response = Response([self.map_out(obj) for obj in qs])
        return response
    @action(detail=False, methods=["put"], url_path="admin-override")
    def admin_override(self, request):
        self.assert_role(UserRole.ADMIN)
        session = Session.objects.filter(pk=_first(request.data, "session", "session_id")).first(); student = _student(_first(request.data, "student", "student_id"))
        if not session or not student: raise ValidationError("Session and student are required.")
        from learning.services import create_attendance
        obj = create_attendance(user=request.user, session=session, student=student, status=str(_first(request.data, "status", default="absent")).lower(), note=str(_first(request.data, "note", default="")))
        return Response(self.map_out(obj))


class ContractCurriculumViewSet(LegacyShapeMixin, CurriculumUnitViewSet):
    def map_in(self, data): return {...(data)}
    def map_out(self, obj): return CurriculumUnitSerializer(obj, context={"request": self.request}).data


class ContractAssessmentViewSet(LegacyShapeMixin, AssessmentViewSet):
    def map_in(self, data): return data
    def map_out(self, obj): return StudentAssessmentSerializer(obj, context={"request": self.request}).data


class ContractProjectViewSet(LegacyShapeMixin, ProjectViewSet):
    def map_in(self, data): return data
    def map_out(self, obj): return ProjectSerializer(obj, context={"request": self.request}).data


class ContractQuizViewSet(LegacyShapeMixin, QuizViewSet):
    def map_in(self, data): return data
    def map_out(self, obj): return QuizSerializer(obj, context={"request": self.request}).data


class ContractQuizAttemptViewSet(LegacyShapeMixin, QuizAttemptViewSet):
    def map_in(self, data): return data
    def map_out(self, obj): return QuizAttemptReadSerializer(obj, context={"request": self.request}).data


class ContractContentViewSet(LegacyShapeMixin, ContentViewSet):
    def map_in(self, data): return data
    def map_out(self, obj): return LearningContentSerializer(obj, context={"request": self.request}).data


class ContractSchoolClassViewSet(LegacyShapeMixin, SchoolClassViewSet):
    def map_in(self, data): return data
    def map_out(self, obj): return _legacy_class(obj)


class ContractBillingFullViewSet(LegacyShapeMixin, InvoiceViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code")); school_class = _class(_first(data, "school_class", "class_id"), school=school); trainer = _trainer(_first(data, "trainer", "trainer_id")); issue_date = _first(data, "issue_date", "date", default=timezone.localdate()); return {"school": str(school.pk) if school else _first(data, "school", "school_id"), "school_class": str(school_class.pk) if school_class else None, "trainer": str(trainer.pk) if trainer else None, "issue_date": issue_date, "due_date": _first(data, "due_date", default=issue_date), "notes": _first(data, "notes", "payment_notes", default=""), "tax_amount": _first(data, "tax_amount", "tax", default=0)}
    def map_out(self, obj):
        data = InvoiceSerializer(obj, context={"request": self.request}).data; paid = float(obj.amount_paid); total = float(obj.total_amount); return {**data, "school_id": obj.school.school_code, "amount": total, "paid_amount": paid, "pending_amount": max(0, total - paid), "status": obj.status}
    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        invoice = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        desired = str(_first(request.data, "status", default=invoice.status)).lower()
        if desired == "issued":
            if invoice.status != "draft": raise ValidationError("Only draft invoices can be issued.")
            recalculate_invoice(invoice); invoice.status = "issued"; invoice.save(update_fields=["status", "updated_at"])
        elif desired == "void":
            if invoice.status == "paid": raise ValidationError("Paid invoices cannot be voided without a controlled finance adjustment.")
            invoice.status = "void"; invoice.save(update_fields=["status", "updated_at"])
        else:
            raise ValidationError("Invoice status is lifecycle-controlled. Use issued or void.")
        return Response(self.map_out(invoice))
    @action(detail=True, methods=["put"], url_path="confirm-payment")
    def confirm_payment(self, request, pk=None):
        invoice = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL); confirmed = _first(request.data, "is_confirmed", default=True); confirmed = confirmed.lower() in {"true", "1", "yes"} if isinstance(confirmed, str) else bool(confirmed)
        if not confirmed: return Response(self.map_out(invoice))
        amount = _first(request.data, "amount", "payment_amount", default=max(float(invoice.total_amount - invoice.amount_paid), 0)); method = str(_first(request.data, "payment_method", "method", default="other")).lower(); method = method if method in {choice.value for choice in PaymentMethod} else "other"; payment, receipt = record_payment(recorded_by=request.user, invoice=invoice, amount=amount, method=method, payment_date=timezone.now(), transaction_reference=str(_first(request.data, "transaction_id", "transaction_reference", default="")), notes=str(_first(request.data, "payment_notes", "notes", default=""))); invoice.refresh_from_db(); payload = self.map_out(invoice); payload["payment"] = PaymentSerializer(payment).data; payload["receipt"] = ReceiptSerializer(receipt).data; return Response(payload)


class ContractInventoryViewSet(LegacyShapeMixin, KitViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school_id", "school_code")); school_class = _class(_first(data, "school_class", "class_id"), school=school); return {"kit_code": _first(data, "kit_code", "id", default=f"KIT-{timezone.now().strftime('%Y%m%d%H%M%S%f')[:18]}"), "name": _first(data, "name", "title", default="Class Kit"), "description": _first(data, "description", default=""), "school_class": str(school_class.pk) if school_class else None, "status": "active" if str(_first(data, "status", default="active")).lower() in {"active", "available", "ready"} else "inactive"}
    def map_out(self, obj): return {"id": str(obj.pk), "kit_code": obj.kit_code, "name": obj.name, "description": obj.description, "class_id": f"CLS-{obj.school_class.school.school_code}-{obj.school_class.grade}{obj.school_class.section}" if obj.school_class else "", "school_id": obj.school_class.school.school_code if obj.school_class else "", "status": obj.status}
    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        kit = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL); kit.status = "active" if str(_first(request.data, "status", default="active")).lower() in {"active", "available", "ready"} else "inactive"; kit.save(update_fields=["status", "updated_at"]); return Response(self.map_out(kit))


class ContractLeadViewSet(LegacyShapeMixin, LeadViewSet):
    def map_in(self, data): return {"organization_name": _first(data, "organization_name", "name", default=""), "contact_name": _first(data, "contact_name", "contact_person", default=""), "email": _first(data, "email", default=""), "phone": _first(data, "phone", default=""), "source": str(_first(data, "source", default="other")).lower(), "status": str(_first(data, "status", "stage", default="new")).lower().replace(" ", "_"), "expected_students": int(_first(data, "expected_students", default=0) or 0), "estimated_value": _first(data, "estimated_value", "expected_value", default=0), "next_follow_up": _first(data, "next_follow_up"), "notes": _first(data, "notes", default="")}
    def map_out(self, obj): return {"id": str(obj.pk), "name": obj.organization_name, "organization_name": obj.organization_name, "contact_person": obj.contact_name, "email": obj.email, "phone": obj.phone, "source": obj.source, "stage": obj.status, "status": obj.status, "expected_students": obj.expected_students, "expected_value": float(obj.estimated_value), "estimated_value": float(obj.estimated_value), "notes": obj.notes}
    @action(detail=True, methods=["put"], url_path="stage")
    def stage(self, request, pk=None):
        lead = self.get_object(); desired = str(_first(request.data, "stage", "status", default=lead.status)).lower().replace(" ", "_")
        if desired not in {choice[0] for choice in LeadStatus.choices}: raise ValidationError("Unsupported lead stage.")
        lead.status = desired; lead.save(update_fields=["status", "updated_at"]); return Response(self.map_out(lead))


class ContractReviewViewSet(ContractAssessmentViewSet): pass
class ContractNotificationViewSet(LegacyShapeMixin, NotificationViewSet):
    def map_out(self, obj): return {"id": str(obj.pk), "title": obj.title, "message": obj.message, "type": obj.notification_type, "severity": "urgent" if obj.notification_type == "warning" else "info", "read": bool(obj.read_at), "created_at": obj.created_at, "target_type": "User", "target_user_id": obj.recipient_id}
    def map_in(self, data):
        recipient = User.objects.filter(pk=_first(data, "recipient")).first() or self.request.user; kind = str(_first(data, "notification_type", "type", default="info")).lower(); kind = kind if kind in {"info", "success", "warning", "action", "payment", "inventory", "crm", "system"} else "info"; return {"recipient": recipient.pk, "notification_type": kind, "title": _first(data, "title", default="Notification"), "message": _first(data, "message", default=""), "event_key": str(_first(data, "event_key", default=f"portal-{timezone.now().timestamp()}"))}
    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.ADMIN and request.data.get("target_type"): raise PermissionDenied("Only administrators can send targeted notifications.")
        return super().create(request, *args, **kwargs)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request): return Response({"status": "ok", "service": "Pixiu Django API", "version": "v1"})


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def upload(request):
    file_obj = request.FILES.get("file")
    if not file_obj: return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
    if file_obj.content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}: return Response({"error": "Only JPG, PNG, WebP and GIF images are permitted."}, status=status.HTTP_400_BAD_REQUEST)
    if file_obj.size > 5 * 1024 * 1024: return Response({"error": "Maximum upload size is 5MB."}, status=status.HTTP_400_BAD_REQUEST)
    ext = file_obj.name.rsplit(".", 1)[-1].lower(); filename = f"evidence-{timezone.now().strftime('%Y%m%d%H%M%S%f')}.{ext}"; stored = default_storage.save(f"evidence/{filename}", ContentFile(file_obj.read())); return Response({"success": True, "url": default_storage.url(stored), "filename": filename, "mimetype": file_obj.content_type, "size": file_obj.size})