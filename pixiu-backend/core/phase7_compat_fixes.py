"""Compatibility fixes for the legacy /api/v1 contract used by the portal.

The rebuilt Django serializers are the source of truth. This module restores
legacy field names and endpoint behavior without duplicating database state.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import TrainerSchoolAssignment
from learning.models import Session
from learning.services import admin_override_attendance
from learning.serializers import AttendanceRecordSerializer
from .api_v1_compat import (
    ContractAttendanceViewSet,
    ContractClassViewSet,
    ContractSchoolViewSet,
    ContractStudentViewSet,
    ContractTrainerViewSet,
    _class,
    _first,
    _school,
    _student,
    _trainer,
)
from .phase7_contract_overrides import ContractSessionCompatViewSet


def _legacy_school(obj):
    return {
        "id": str(obj.pk),
        "school_id": obj.school_code,
        "legacy_id": obj.school_code,
        "code": obj.school_code,
        "school_code": obj.school_code,
        "account_username": obj.account.username if obj.account_id else "",
        "name": obj.name,
        "principal": obj.principal_name,
        "principal_name": obj.principal_name,
        "contact": obj.phone,
        "phone": obj.phone,
        "email": obj.email,
        "address": obj.address,
        "lab_name": obj.lab_name,
        "lab_location": obj.lab_location,
        "lab_capacity": obj.lab_capacity,
        "lab_notes": obj.lab_notes,
        "status": "Active" if obj.status == "active" else "Inactive",
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


def _legacy_trainer(obj):
    assignments = obj.school_assignments.filter(status="active").select_related("school")
    return {
        "id": str(obj.pk),
        "account_username": obj.account.username if obj.account_id else "",
        "trainer_id": obj.trainer_id,
        "legacy_id": obj.trainer_id,
        "name": obj.name,
        "email": obj.email,
        "phone": obj.phone,
        "qualification": obj.qualification,
        "specialization": obj.specialization,
        "daily_rate": obj.daily_rate,
        "weekly_days": obj.weekly_days,
        "monthly_compensation": obj.monthly_compensation,
        "rating": obj.rating,
        "assigned_schools": [a.school.school_code for a in assignments],
        "status": "Active" if obj.status == "active" else "Inactive",
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


def _legacy_student(obj):
    school = obj.school_class.school
    return {
        "id": str(obj.pk),
        "student_id": obj.student_id,
        "school_id": school.school_code,
        "class_id": f"CLS-{school.school_code}-{obj.school_class.grade}{obj.school_class.section}",
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
        "account_username": obj.account.username if obj.account_id else "",
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


def _legacy_class(obj):
    code = obj.school.school_code
    return {
        "id": str(obj.pk),
        "class_id": f"CLS-{code}-{obj.grade}{obj.section}",
        "school_id": code,
        "school": str(obj.school.pk),
        "school_code": code,
        "grade": obj.grade,
        "section": obj.section,
        "display_name": obj.display_name,
        "status": "Active" if obj.status == "active" else "Inactive",
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


def _legacy_session(obj):
    code = obj.school_class.school.school_code
    return {
        "id": str(obj.pk),
        "school_id": code,
        "class_id": f"CLS-{code}-{obj.school_class.grade}{obj.school_class.section}",
        "school_class": str(obj.school_class_id),
        "trainer": str(obj.trainer_id),
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


class LegacySchoolCompatViewSet(ContractSchoolViewSet):
    def map_in(self, data):
        payload = dict(data)
        payload["school_code"] = _first(data, "school_code", "school_id", "code", "id")
        payload["name"] = _first(data, "name", "school_name", default="")
        payload["principal_name"] = _first(data, "principal_name", "principal", default="")
        payload["phone"] = _first(data, "phone", "contact", default="")
        payload["email"] = _first(data, "email", default="")
        payload["address"] = _first(data, "address", default="")
        value = str(_first(data, "status", default="active")).strip().lower()
        payload["status"] = "active" if value in {"active", "true", "1"} else "inactive"
        return payload

    def map_out(self, obj):
        return _legacy_school(obj)

    @action(detail=True, methods=["post"], url_path="assign-trainer")
    def assign_trainer(self, request, pk=None):
        self.required_action = "EDIT"
        self.role_only(UserRole.ADMIN)
        school = self.get_object()
        trainer = _trainer(_first(request.data, "trainer_id", "trainer"))
        with transaction.atomic():
            TrainerSchoolAssignment.objects.filter(school=school, status="active").update(
                status="inactive", assigned_to=timezone.localdate()
            )
            if trainer:
                TrainerSchoolAssignment.objects.update_or_create(
                    trainer=trainer,
                    school=school,
                    assigned_from=timezone.localdate(),
                    defaults={"status": "active", "assigned_to": None},
                )
        return Response(_legacy_school(school))


class LegacyTrainerCompatViewSet(ContractTrainerViewSet):
    def map_in(self, data):
        payload = dict(data)
        payload["trainer_id"] = _first(data, "trainer_id", "legacy_id", "id", default=None)
        payload["name"] = _first(data, "name", "trainer_name", default="")
        payload["email"] = _first(data, "email", default="")
        payload["phone"] = _first(data, "phone", default="")
        payload["qualification"] = _first(data, "qualification", default="")
        payload["specialization"] = _first(data, "specialization", default="")
        payload["daily_rate"] = _first(data, "daily_rate")
        payload["weekly_days"] = _first(data, "weekly_days")
        payload["monthly_compensation"] = _first(data, "monthly_compensation")
        payload["rating"] = _first(data, "rating")
        value = str(_first(data, "status", default="active")).strip().lower()
        payload["status"] = "active" if value in {"active", "true", "1"} else "inactive"
        return payload

    def map_out(self, obj):
        return _legacy_trainer(obj)

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        self.required_action = "EDIT"
        self.role_only(UserRole.ADMIN)
        trainer = self.get_object()
        value = str(_first(request.data, "status", default=trainer.status)).strip().lower()
        trainer.status = "active" if value in {"active", "true", "1"} else "inactive"
        trainer.save(update_fields=["status", "updated_at"])
        return Response(_legacy_trainer(trainer))


class LegacyClassCompatViewSet(ContractClassViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code", "code"))
        payload = dict(data)
        if school:
            payload["school"] = str(school.pk)
        payload["grade"] = _first(data, "grade", "class_grade", default="")
        payload["section"] = _first(data, "section", default="A")
        value = str(_first(data, "status", default="active")).strip().lower()
        payload["status"] = "active" if value in {"active", "true", "1"} else "inactive"
        return payload

    def map_out(self, obj):
        return _legacy_class(obj)


class LegacyStudentCompatViewSet(ContractStudentViewSet):
    def map_in(self, data):
        school = _school(_first(data, "school", "school_id", "school_code"))
        school_class = _class(_first(data, "school_class", "class_id", "class"), school=school)
        payload = dict(data)
        if school_class:
            payload["school_class"] = str(school_class.pk)
        payload["student_id"] = _first(data, "student_id", "id", default=None)
        payload["name"] = _first(data, "name", "student_name", default="")
        value = str(_first(data, "status", default="active")).strip().lower()
        payload["status"] = "active" if value in {"active", "true", "1"} else "inactive"
        return payload

    def map_out(self, obj):
        return _legacy_student(obj)


class LegacySessionCompatViewSet(ContractSessionCompatViewSet):
    def map_in(self, data):
        payload = dict(data)
        school = _school(_first(data, "school", "school_id", "school_code"))
        school_class = _class(_first(data, "school_class", "class_id", "class"), school=school)
        trainer = _trainer(_first(data, "trainer", "trainer_id"))
        if school_class:
            payload["school_class"] = str(school_class.pk)
        if trainer:
            payload["trainer"] = str(trainer.pk)
        return payload

    def map_out(self, obj):
        return _legacy_session(obj)


class LegacyAttendanceCompatViewSet(ContractAttendanceViewSet):
    """Keep old payload names, but route admin correction through the audited service."""

    def map_in(self, data):
        payload = dict(data)
        payload["session"] = _first(data, "session", "session_id")
        payload["student"] = _first(data, "student", "student_id")
        payload["status"] = str(_first(data, "status", default="absent")).strip().lower()
        return payload

    def map_out(self, obj):
        return AttendanceRecordSerializer(obj, context={"request": self.request}).data

    @action(detail=False, methods=["put"], url_path="admin-override")
    def admin_override(self, request):
        self.required_action = "EDIT"
        self.role_only(UserRole.ADMIN)
        session = Session.objects.filter(pk=_first(request.data, "session", "session_id")).first()
        student = _student(_first(request.data, "student", "student_id"))
        if not session or not student:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Session and student are required.")
        obj = admin_override_attendance(
            user=request.user,
            session=session,
            student=student,
            status=str(_first(request.data, "status", default="absent")).strip().lower(),
            note=str(_first(request.data, "note", default="")),
        )
        return Response(self.map_out(obj))
