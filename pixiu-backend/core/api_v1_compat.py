from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.views import SchoolViewSet, TrainerViewSet, SchoolClassViewSet, StudentViewSet
from billing.models import Invoice, Payment, PaymentMethod
from billing.serializers import InvoiceSerializer, PaymentSerializer, ReceiptSerializer
from billing.services import record_payment, recalculate_invoice
from billing.views import InvoiceViewSet
from crm.models import Lead
from crm.views import LeadViewSet
from inventory.models import Kit
from inventory.views import KitViewSet
from learning.models import AttendanceRecord, CurriculumUnit, LearningContent, Project, Quiz, QuizAttempt, StudentAssessment, Session
from learning.serializers import (
    AttendanceRecordSerializer, CurriculumUnitSerializer, LearningContentSerializer,
    ProjectSerializer, QuizAttemptReadSerializer, QuizSerializer, SessionSerializer,
    StudentAssessmentSerializer,
)
from learning.views import (
    AssessmentViewSet, AttendanceViewSet, ContentViewSet, CurriculumUnitViewSet,
    ProjectViewSet, QuizAttemptViewSet, QuizViewSet, SessionViewSet,
)
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
    return School.objects.filter(pk=value).first() or School.objects.filter(school_code=str(value).strip().upper()).first()


def _trainer(value):
    if not value:
        return None
    return Trainer.objects.filter(pk=value).first() or Trainer.objects.filter(trainer_id=str(value).strip().upper()).first()


def _class(value, school=None):
    if not value:
        return None
    obj = SchoolClass.objects.filter(pk=value).first()
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
    return Student.objects.filter(pk=value).first() or Student.objects.filter(student_id=str(value).strip().upper()).first()


def _legacy_school(obj):
    return {
        **SchoolViewSet.serializer_class(obj).data,
        "id": str(obj.pk),
        "legacy_id": obj.school_code,
        "code": obj.school_code,
        "principal": obj.principal_name,
        "contact": obj.phone,
        "status": "Active" if obj.status == "active" else "Inactive",
    }


def _legacy_trainer(obj):
    assignments = obj.school_assignments.filter(status="active").select_related("school")
    return {
        **TrainerViewSet.serializer_class(obj).data,
        "id": str(obj.pk),
        "legacy_id": obj.trainer_id,
        "assigned_schools": [a.school.school_code for a in assignments],
        "status": "Active" if obj.status == "active" else "Inactive",
    }


def _legacy_class(obj):
    school_code = obj.school.school_code
    return {
        "id": str(obj.pk),
        "class_id": f"CLS-{school_code}-{obj.grade}{obj.section}",
        "school_id": school_code,
        "school": str(obj.school.pk),
        "school_code": school_code,
        "grade": obj.grade,
        "section": obj.section,
        "display_name": obj.display_name,
        "status": "Active" if obj.status == "active" else "Inactive",
    }


def _legacy_student(obj):
    return {
        "id": str(obj.pk),
        "student_id": obj.student_id,
        "school_id": obj.school_class.school.school_code,
        "class_id": f"CLS-{obj.school_class.school.school_code}-{obj.school_class.grade}{obj.school_class.section}",
        "class_name": obj.school_class.display_name,
        "name": obj.name,
        "roll_number": obj.roll_number,
        "date_of_birth": obj.date_of_birth,
        "gender": obj.gender,
        "email": obj.email,
        "phone": obj.phone,
        "guardian_name": obj.guardian_name,
        "guardian_phone": obj.guardian_phone,
        "guardian_email": obj.guardian_email,
        "address": obj.address,
        "current_level": obj.current_level,
        "status": "Active" if obj.status == "active" else "Inactive",
    }


def _legacy_session(obj):
    return {
        "id": str(obj.pk),
        "school_id": obj.school_class.school.school_code,
        "class_id": f"CLS-{obj.school_class.school.school_code}-{obj.school_class.grade}{obj.school_class.section}",
        "trainer_id": obj.trainer.trainer_id,
        "date": obj.date,
        "start_time": obj.start_time,
        "end_time": obj.end_time,
        "topic": obj.topic,
        "notes": obj.notes,
        "status": obj.status,
        "is_locked": obj.is_locked,
        "class_name": obj.school_class.display_name,
    }


class LegacyShapeMixin:
    """Preserve the portal's legacy field names while storage moves to Django."""

    def map_in(self, data):
        return data

    def map_out(self, obj):
        return obj

    def _mapped_request(self):
        original = dict(self.request.data)
        self.request._full_data = self.map_in(original)
        return original

    def _restore_request(self, original):
        self.request._full_data = original

    def create(self, request, *args, **kwargs):
        original = self._mapped_request()
        try:
            response = super().create(request, *args, **kwargs)
        finally:
            self._restore_request(original)
        if isinstance(response.data, dict):
            response.data = self.map_out(self.get_object_for_contract(response.data) or response.data)
        return response

    def update(self, request, *args, **kwargs):
        original = self._mapped_request()
        try:
            response = super().update(request, *args, **kwargs)
        finally:
            self._restore_request(original)
        obj = self.get_queryset().filter(pk=kwargs.get("pk")).first()
        if obj is not None:
            response.data = self.map_out(obj)
        return response

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data = [self.map_out(x) for x in self._current_list()]
        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        obj = self.get_object()
        response.data = self.map_out(obj)
        return response

    def _current_list(self):
        return list(self.filter_queryset(self.get_queryset()))

    def get_object_for_contract(self, data):
        pk = data.get("id") if isinstance(data, dict) else None
        return self.get_queryset().filter(pk=pk).first() if pk else None


class ContractSchoolViewSet(LegacyShapeMixin, SchoolViewSet):
    def map_in(self, data):
        school_code = str(_first(data, "school_code", "code", "id", default="")).strip().upper()
        status_value = str(_first(data, "status", default="active")).lower()
        return {
            "school_code": school_code,
            "name": _first(data, "name", default=""),
            "principal_name": _first(data, "principal_name", "principal", default=""),
            "phone": _first(data, "phone", "contact", default=""),
            "email": _first(data, "email", default=""),
            "address": _first(data, "address", default=""),
            "lab_name": _first(data, "lab_name", default=""),
            "lab_location": _first(data, "lab_location", default=""),
            "lab_capacity": _first(data, "lab_capacity"),
            "lab_notes": _first(data, "lab_notes", default=""),
            "status": "active" if status_value in {"active", "true", "1"} else "inactive",
        }

    def map_out(self, obj):
        return _legacy_school(obj)

    @action(detail=True, methods=["post"], url_path="assign-trainer")
    def assign_trainer(self, request, pk=None):
        school = self.get_object()
        self.assert_role(UserRole.ADMIN)
        trainer = _trainer(_first(request.data, "trainer_id", "trainer"))
        if trainer is None:
            active = TrainerSchoolAssignment.objects.filter(school=school, status="active")
            active.update(status="inactive", assigned_to=timezone.localdate())
            return Response(_legacy_school(school))
        with transaction.atomic():
            TrainerSchoolAssignment.objects.filter(school=school, status="active").exclude(trainer=trainer).update(status="inactive", assigned_to=timezone.localdate())
            TrainerSchoolAssignment.objects.update_or_create(
                trainer=trainer,
                school=school,
                assigned_from=timezone.localdate(),
                defaults={"status": "active", "assigned_to": None},
            )
        return Response(_legacy_school(school))


class ContractTrainerViewSet(LegacyShapeMixin, TrainerViewSet):
    def map_in(self, data):
        status_value = str(_first(data, "status", default="active")).lower()
        return {
            "trainer_id": str(_first(data, "trainer_id", "id", default="")).strip().upper(),
            "name": _first(data, "name", default=""),
            "email": _first(data, "email", default=""),
            "phone": _first(data, "phone", default=""),
            "qualification": _first(data, "qualification", default=""),
            "specialization": _first(data, "specialization", default=""),
            "daily_rate": _first(data, "daily_rate"),
            "weekly_days": _first(data, "weekly_days"),
            "monthly_compensation": _first(data, "monthly_compensation"),
            "rating": _first(data, "rating"),
            "status": "active" if status_value in {"active", "true", "1"} else "inactive",
        }

    def map_out(self, obj):
        return _legacy_trainer(obj)

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        trainer = self.get_object()
        self.assert_role(UserRole.ADMIN)
        value = str(_first(request.data, "status", default="active")).lower()
        trainer.status = "active" if value in {"active", "true", "1"} else "inactive"
        trainer.save(update_fields=["status", "updated_at"])
        return Response(_legacy_trainer(trainer))


class ContractClassViewSet(LegacyShapeMixin, SchoolClassViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code"))
        return {
            "school": str(school.pk) if school else _first(data, "school"),
            "grade": _first(data, "grade", default=""),
            "section": _first(data, "section", default=""),
            "display_name": _first(data, "display_name", default=""),
            "status": "active" if str(_first(data, "status", default="active")).lower() in {"active", "true", "1"} else "inactive",
        }

    def map_out(self, obj):
        return _legacy_class(obj)


class ContractStudentViewSet(LegacyShapeMixin, StudentViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code"))
        school_class = _class(_first(data, "school_class", "class_id", "class"), school=school)
        student_id = str(_first(data, "student_id", default=""))
        roll = _first(data, "roll_number")
        if roll is None and student_id:
            try:
                roll = int(student_id.split()[-1])
            except (ValueError, IndexError):
                roll = 1
        return {
            "school_class": str(school_class.pk) if school_class else _first(data, "school_class", "class_id"),
            "roll_number": int(roll or 1),
            "name": _first(data, "name", default=""),
            "date_of_birth": _first(data, "date_of_birth"),
            "gender": _first(data, "gender", default=""),
            "email": _first(data, "email", default=""),
            "phone": _first(data, "phone", default=""),
            "guardian_name": _first(data, "guardian_name", default=""),
            "guardian_phone": _first(data, "guardian_phone", default=""),
            "guardian_email": _first(data, "guardian_email", default=""),
            "address": _first(data, "address", default=""),
            "current_level": _first(data, "current_level", default=""),
            "status": "active" if str(_first(data, "status", default="active")).lower() in {"active", "true", "1"} else "inactive",
        }

    def map_out(self, obj):
        return _legacy_student(obj)


class ContractSessionViewSet(LegacyShapeMixin, SessionViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code"))
        trainer = _trainer(_first(data, "trainer", "trainer_id"))
        school_class = _class(_first(data, "school_class", "class_id", "class"), school=school)
        return {
            "school_class": str(school_class.pk) if school_class else _first(data, "school_class", "class_id"),
            "trainer": str(trainer.pk) if trainer else _first(data, "trainer", "trainer_id"),
            "date": _first(data, "date", default=timezone.localdate()),
            "start_time": _first(data, "start_time"),
            "end_time": _first(data, "end_time"),
            "topic": _first(data, "topic", default=""),
            "notes": _first(data, "notes", default=""),
        }

    def map_out(self, obj):
        return _legacy_session(obj)


class ContractAttendanceViewSet(LegacyShapeMixin, AttendanceViewSet):
    def map_in(self, data):
        session = Session.objects.filter(pk=_first(data, "session", "session_id")).first()
        student = _student(_first(data, "student", "student_id"))
        status_value = str(_first(data, "status", default="absent")).lower()
        return {
            "session": str(session.pk) if session else _first(data, "session", "session_id"),
            "student": str(student.pk) if student else _first(data, "student", "student_id"),
            "status": "present" if status_value == "present" else "absent",
            "note": _first(data, "note", "payment_notes", default=""),
        }

    def map_out(self, obj):
        return {
            "id": str(obj.pk),
            "session_id": str(obj.session_id),
            "student_id": obj.student.student_id,
            "status": "Present" if obj.status == "present" else "Absent",
            "date": obj.marked_at.date(),
            "time": obj.marked_at.time(),
            "marked_at": obj.marked_at,
            "note": obj.note,
        }

    @action(detail=False, methods=["put"], url_path="admin-override")
    def admin_override(self, request):
        self.assert_role(UserRole.ADMIN)
        session = Session.objects.filter(pk=_first(request.data, "session", "session_id")).first()
        student = _student(_first(request.data, "student", "student_id"))
        if not session or not student:
            raise ValidationError("Session and student are required.")
        obj = AttendanceRecord.objects.filter(session=session, student=student).first()
        payload = {"session": str(session.pk), "student": str(student.pk), "status": str(_first(request.data, "status", default="absent")).lower()}
        if obj:
            ser = self.get_serializer(obj, data=payload, partial=True)
        else:
            ser = self.get_serializer(data=payload)
        ser.is_valid(raise_exception=True)
        saved = ser.save()
        return Response(self.map_out(saved))


class ContractCurriculumViewSet(LegacyShapeMixin, CurriculumUnitViewSet):
    def map_in(self, data):
        return {k: _first(data, k, default="") for k in ["grade", "level", "unit_code", "title", "week", "topic", "objectives", "status"]}
    def map_out(self, obj):
        return CurriculumUnitSerializer(obj, context={"request": self.request}).data

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        obj = self.get_object(); self.assert_role(UserRole.ADMIN)
        obj.status = str(_first(request.data, "status", default=obj.status)).lower()
        obj.save(update_fields=["status", "updated_at"])
        return Response(self.map_out(obj))


class ContractContentViewSet(LegacyShapeMixin, ContentViewSet):
    def map_in(self, data):
        return {k: _first(data, k, default="") for k in ["title", "description", "content_type", "grade", "level", "unit_code", "url", "target_role", "status"]}
    def map_out(self, obj):
        return LearningContentSerializer(obj, context={"request": self.request}).data


class ContractQuizViewSet(LegacyShapeMixin, QuizViewSet):
    def map_in(self, data):
        return {k: _first(data, k, default=({"duration_minutes": 30, "max_attempts": 1}.get(k, ""))) for k in ["title", "grade", "level", "unit_code", "duration_minutes", "max_attempts", "status"]}
    def map_out(self, obj): return QuizSerializer(obj, context={"request": self.request}).data


class ContractQuizAttemptViewSet(LegacyShapeMixin, QuizAttemptViewSet):
    def map_in(self, data):
        quiz = Quiz.objects.filter(pk=_first(data, "quiz", "quiz_id")).first()
        student = _student(_first(data, "student", "student_id"))
        return {
            "quiz": str(quiz.pk) if quiz else _first(data, "quiz", "quiz_id"),
            "student": str(student.pk) if student else _first(data, "student", "student_id"),
            "answers": _first(data, "answers", default={}),
            "time_taken_seconds": int(_first(data, "time_taken_seconds", "time_taken", default=0) or 0),
            "violation_count": int(_first(data, "violation_count", default=0) or 0),
        }
    def map_out(self, obj): return QuizAttemptReadSerializer(obj, context={"request": self.request}).data


class ContractAssessmentViewSet(LegacyShapeMixin, AssessmentViewSet):
    def map_in(self, data):
        student = _student(_first(data, "student", "student_id"))
        trainer = _trainer(_first(data, "trainer", "trainer_id"))
        return {
            "student": str(student.pk) if student else _first(data, "student", "student_id"),
            "trainer": str(trainer.pk) if trainer else _first(data, "trainer", "trainer_id"),
            "unit_code": _first(data, "unit_code", default="REVIEW"),
            "level": _first(data, "level", default=""),
            "title": _first(data, "title", "review_title", default="Student Review"),
            "score": _first(data, "score"),
            "rating": _first(data, "rating"),
            "status": _first(data, "status", default="submitted"),
            "feedback": _first(data, "feedback", "comment", "review", default=""),
            "assessment_date": _first(data, "assessment_date", "date", default=timezone.localdate()),
        }
    def map_out(self, obj): return StudentAssessmentSerializer(obj, context={"request": self.request}).data


class ContractProjectViewSet(LegacyShapeMixin, ProjectViewSet):
    def map_in(self, data):
        student = _student(_first(data, "student", "student_id"))
        return {
            "student": str(student.pk) if student else _first(data, "student", "student_id"),
            "title": _first(data, "title", default=""),
            "description": _first(data, "description", default=""),
            "status": _first(data, "status", default="draft"),
        }
    def map_out(self, obj): return ProjectSerializer(obj, context={"request": self.request}).data


class ContractBillingViewSet(LegacyShapeMixin, InvoiceViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code"))
        school_class = _class(_first(data, "school_class", "class_id"), school=school)
        trainer = _trainer(_first(data, "trainer", "trainer_id"))
        issue_date = _first(data, "issue_date", "date", default=timezone.localdate())
        return {
            "school": str(school.pk) if school else _first(data, "school", "school_id"),
            "school_class": str(school_class.pk) if school_class else None,
            "trainer": str(trainer.pk) if trainer else None,
            "issue_date": issue_date,
            "due_date": _first(data, "due_date", default=issue_date),
            "notes": _first(data, "notes", "payment_notes", default=""),
            "tax_amount": _first(data, "tax_amount", "tax", default=0),
        }
    def map_out(self, obj):
        data = InvoiceSerializer(obj, context={"request": self.request}).data
        paid = float(obj.amount_paid)
        total = float(obj.total_amount)
        return {**data, "school_id": obj.school.school_code, "amount": total, "paid_amount": paid, "pending_amount": max(0, total - paid), "status": obj.status}

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        invoice = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        desired = str(_first(request.data, "status", default=invoice.status)).lower()
        invoice.status = desired
        invoice.save(update_fields=["status", "updated_at"])
        return Response(self.map_out(invoice))

    @action(detail=True, methods=["put"], url_path="confirm-payment")
    def confirm_payment(self, request, pk=None):
        invoice = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        confirmed = bool(_first(request.data, "is_confirmed", default=True))
        if not confirmed:
            return Response(self.map_out(invoice))
        amount = _first(request.data, "amount", "payment_amount", default=max(float(invoice.total_amount - invoice.amount_paid), 0))
        method = str(_first(request.data, "payment_method", "method", default="other")).lower()
        if method not in {choice.value for choice in PaymentMethod}:
            method = "other"
        payment, receipt = record_payment(
            recorded_by=request.user,
            invoice=invoice,
            amount=amount,
            method=method,
            payment_date=timezone.now(),
            transaction_reference=str(_first(request.data, "transaction_id", "transaction_reference", default="")),
            notes=str(_first(request.data, "payment_notes", "notes", default="")),
        )
        invoice.refresh_from_db()
        payload = self.map_out(invoice)
        payload["payment"] = PaymentSerializer(payment).data
        payload["receipt"] = ReceiptSerializer(receipt).data
        return Response(payload)


class ContractInventoryViewSet(LegacyShapeMixin, KitViewSet):
    def map_in(self, data):
        school_class = _class(_first(data, "school_class", "class_id"), school=_school(_first(data, "school_id")))
        return {
            "kit_code": _first(data, "kit_code", "id", default=f"KIT-{timezone.now().strftime('%Y%m%d%H%M%S%f')[:15]}"),
            "name": _first(data, "name", "title", default="Class Kit"),
            "description": _first(data, "description", default=""),
            "school_class": str(school_class.pk) if school_class else None,
            "status": "active" if str(_first(data, "status", default="active")).lower() in {"active", "available", "ready"} else "inactive",
        }
    def map_out(self, obj):
        return {"id": str(obj.pk), "kit_code": obj.kit_code, "name": obj.name, "description": obj.description, "class_id": (f"CLS-{obj.school_class.school.school_code}-{obj.school_class.grade}{obj.school_class.section}" if obj.school_class else ""), "school_id": obj.school_class.school.school_code if obj.school_class else "", "status": obj.status}

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        kit = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        kit.status = "active" if str(_first(request.data, "status", default="active")).lower() in {"active", "available", "ready"} else "inactive"
        kit.save(update_fields=["status", "updated_at"])
        return Response(self.map_out(kit))


class ContractLeadViewSet(LegacyShapeMixin, LeadViewSet):
    def map_in(self, data):
        return {
            "organization_name": _first(data, "organization_name", "name", default=""),
            "contact_name": _first(data, "contact_name", "contact_person", default=""),
            "email": _first(data, "email", default=""),
            "phone": _first(data, "phone", default=""),
            "source": str(_first(data, "source", default="other")).lower(),
            "status": str(_first(data, "status", "stage", default="new")).lower().replace(" ", "_"),
            "expected_students": int(_first(data, "expected_students", default=0) or 0),
            "estimated_value": _first(data, "estimated_value", "expected_value", default=0),
            "next_follow_up": _first(data, "next_follow_up"),
            "notes": _first(data, "notes", default=""),
        }
    def map_out(self, obj):
        return {"id": str(obj.pk), "name": obj.organization_name, "organization_name": obj.organization_name, "contact_person": obj.contact_name, "email": obj.email, "phone": obj.phone, "source": obj.source, "stage": obj.status, "status": obj.status, "expected_students": obj.expected_students, "expected_value": float(obj.estimated_value), "estimated_value": float(obj.estimated_value), "notes": obj.notes}

    @action(detail=True, methods=["put"], url_path="stage")
    def stage(self, request, pk=None):
        lead = self.get_object(); desired = str(_first(request.data, "stage", "status", default=lead.status)).lower().replace(" ", "_")
        if desired not in {x.value for x in Lead.Status}: raise ValidationError("Unsupported lead stage.")
        lead.status = desired; lead.save(update_fields=["status", "updated_at"])
        return Response(self.map_out(lead))


class ContractNotificationViewSet(LegacyShapeMixin, NotificationViewSet):
    def map_in(self, data):
        recipient = User.objects.filter(pk=_first(data, "recipient")).first() or self.request.user
        kind = str(_first(data, "notification_type", "type", default="info")).lower()
        if kind not in {"info", "success", "warning", "action", "payment", "inventory", "crm", "system"}:
            kind = "info"
        return {"recipient": recipient.pk, "notification_type": kind, "title": _first(data, "title", default="Notification"), "message": _first(data, "message", default=""), "event_key": str(_first(data, "event_key", default=f"portal-{timezone.now().timestamp()}"))}
    def map_out(self, obj): return {"id": str(obj.pk), "title": obj.title, "message": obj.message, "type": obj.notification_type, "severity": "urgent" if obj.notification_type == "warning" else "info", "read": bool(obj.read_at), "created_at": obj.created_at, "target_type": "User", "target_user_id": obj.recipient_id}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def health(request):
    return Response({"status": "ok", "service": "Pixiu Django API", "version": "v1"})


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def upload(request):
    file_obj = request.FILES.get("file")
    if not file_obj:
        return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file_obj.content_type not in allowed:
        return Response({"error": "Only JPG, PNG, WebP and GIF images are permitted."}, status=status.HTTP_400_BAD_REQUEST)
    if file_obj.size > 5 * 1024 * 1024:
        return Response({"error": "Maximum upload size is 5MB."}, status=status.HTTP_400_BAD_REQUEST)
    ext = file_obj.name.rsplit(".", 1)[-1].lower()
    filename = f"evidence-{timezone.now().strftime('%Y%m%d%H%M%S%f')}.{ext}"
    stored = default_storage.save(f"evidence/{filename}", ContentFile(file_obj.read()))
    return Response({"success": True, "url": default_storage.url(stored), "filename": filename, "mimetype": file_obj.content_type, "size": file_obj.size})
