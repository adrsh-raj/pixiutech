from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import SchoolClass
from .api_v1_compat import (
    ContractAssessmentViewSet, ContractAttendanceViewSet, ContractClassViewSet, ContractContentViewSet,
    ContractCurriculumViewSet, ContractInventoryViewSet, ContractLeadViewSet, ContractProjectViewSet,
    ContractQuizAttemptViewSet, ContractQuizViewSet, ContractReviewViewSet, ContractSchoolViewSet,
    ContractSessionViewSet, ContractStudentViewSet, ContractTrainerViewSet, ContractBillingFullViewSet,
)
from .phase7_contract_overrides import ContractSessionCompatViewSet
from .learning_attendance_overrides import StableAttendanceViewSet
from learning.models import ContentClassAssignment, CurriculumClassAssignment, QuizClassAssignment
from learning.views import ProjectEvidenceViewSet, QuizAssignmentViewSet, SessionActivityViewSet
from learning.watermarking import prepare_uploaded_file
from .learning_contract_overrides import StableQuizQuestionViewSet
from academics.services import accessible_class_queryset


class ScopedDetailMixin:
    """Make legacy compatibility detail operations use the same scope as list operations."""
    def get_object(self):
        scoped = getattr(self, "scoped_queryset", None)
        queryset = scoped() if callable(scoped) else self.get_queryset()
        queryset = self.filter_queryset(queryset)
        obj = get_object_or_404(queryset, **{self.lookup_field: self.kwargs[self.lookup_url_kwarg or self.lookup_field]})
        self.check_object_permissions(self.request, obj)
        return obj


class ScopedContractAssessmentViewSet(ScopedDetailMixin, ContractAssessmentViewSet): pass
class ScopedContractAttendanceViewSet(ScopedDetailMixin, ContractAttendanceViewSet): pass
class ScopedContractClassViewSet(ScopedDetailMixin, ContractClassViewSet): pass
class ScopedContractContentViewSet(ScopedDetailMixin, ContractContentViewSet):
    def _prepare_content_file(self, serializer):
        upload = serializer.validated_data.get("file")
        if upload is None:
            return
        enabled_raw = self.request.data.get("is_watermarked", "true")
        enabled = str(enabled_raw).strip().lower() not in {"false", "0", "no", "off"}
        target_role = serializer.validated_data.get("target_role", "student")
        processed, watermarked = prepare_uploaded_file(upload, target_role, enabled)
        serializer.validated_data["file"] = processed
        serializer.validated_data["is_watermarked"] = watermarked

    def perform_create(self, serializer):
        self.role_only("admin")
        self._prepare_content_file(serializer)
        serializer.save(created_by=self.request.user)
        self._ensure_grade_assignments(serializer.instance)

    def perform_update(self, serializer):
        self.role_only("admin")
        self._prepare_content_file(serializer)
        serializer.save()
        self._ensure_grade_assignments(serializer.instance)

    def _ensure_grade_assignments(self, content):
        target_role = str(content.target_role or "student").lower()
        if target_role not in {"student", "trainer", "all"} or not str(content.grade or "").strip().isdigit():
            return
        classes = SchoolClass.objects.filter(status="active", grade=str(content.grade).strip()).only("id")
        existing = set(content.class_assignments.values_list("school_class_id", flat=True))
        missing = [ContentClassAssignment(content=content, school_class_id=school_class_id, assigned_by=self.request.user) for school_class_id in classes.values_list("id", flat=True) if school_class_id not in existing]
        if missing:
            ContentClassAssignment.objects.bulk_create(missing, ignore_conflicts=True)


class ScopedContractCurriculumViewSet(ScopedDetailMixin, ContractCurriculumViewSet):
    """Compatibility curriculum endpoint used by the trainer portal.

    The legacy UI sends class_grade/week/unit_level/topic/objectives/status while
    the canonical model expects grade/level/unit_code/title/... . Normalize that
    contract here and make newly-created plans visible to the creator's accessible
    classes. Curriculum units are intentionally unique by grade+unit_code, so a
    repeated Unit N reuses/updates the existing unit instead of creating a duplicate.
    """
    def _accessible_target_classes(self, grade):
        return SchoolClass.objects.filter(
            pk__in=accessible_class_queryset(self.request.user).values("id"),
            status="active",
            grade=str(grade).strip(),
        )

    def scoped_queryset(self):
        return super().scoped_queryset()

    def map_in(self, data):
        payload = dict(data)
        grade = str(data.get("grade") or data.get("class_grade") or "").strip()
        week = str(data.get("week") or "").strip()
        level = str(data.get("level") or data.get("unit_level") or "").strip()
        topic = str(data.get("topic") or data.get("title") or "").strip()
        objectives = str(data.get("objectives") or "").strip()
        unit_match = __import__("re").search(r"(\d+)", week)
        unit_number = unit_match.group(1) if unit_match else str(data.get("unit_code") or "1").strip()
        unit_code = str(data.get("unit_code") or f"U{int(unit_number)}").strip().upper()
        if not level:
            level = f"Level {max(int(unit_number) - 1, 0)}"
        if not topic:
            topic = week or f"Unit {unit_number}"
        status_value = str(data.get("status") or "Upcoming").strip().lower()
        status_map = {
            "upcoming": "draft",
            "untaught": "draft",
            "draft": "draft",
            "completed": "published",
            "taught": "published",
            "published": "published",
            "archived": "archived",
        }
        payload.update({
            "grade": grade,
            "level": level,
            "unit_code": unit_code,
            "title": str(data.get("title") or f"Unit {unit_number} — {topic}").strip(),
            "week": week or f"Unit {unit_number}",
            "topic": topic,
            "objectives": objectives,
            "status": status_map.get(status_value, "draft"),
        })
        return payload

    def map_out(self, obj):
        payload = super().map_out(obj)
        status_value = str(payload.get("status") or "draft").lower()
        unit_number = str(payload.get("unit_code") or "U1").replace("UNIT-", "").replace("U", "", 1)
        payload.update({
            "class_grade": str(payload.get("grade") or ""),
            "unit_level": str(payload.get("level") or ""),
            "status": "Completed" if status_value == "published" else "Upcoming",
            "week": payload.get("week") or f"Unit {unit_number}",
        })
        return payload

    def _save_and_assign(self, validated_data):
        from learning.models import CurriculumUnit
        grade = str(validated_data.get("grade") or "").strip()
        unit_code = str(validated_data.get("unit_code") or "").strip().upper()
        existing = CurriculumUnit.objects.filter(grade=grade, unit_code=unit_code).first()
        if existing is None:
            unit = CurriculumUnit.objects.create(created_by=self.request.user, **validated_data)
        else:
            for field in ("level", "title", "week", "topic", "objectives", "status"):
                if field in validated_data:
                    setattr(existing, field, validated_data[field])
            existing.save(update_fields=["level", "title", "week", "topic", "objectives", "status", "updated_at"])
            unit = existing

        target_classes = self._accessible_target_classes(grade) if self.request.user.role != UserRole.ADMIN else SchoolClass.objects.filter(status="active", grade=grade)
        existing_class_ids = set(unit.class_assignments.values_list("school_class_id", flat=True))
        missing = [
            CurriculumClassAssignment(curriculum_unit=unit, school_class_id=cls.id, assigned_by=self.request.user)
            for cls in target_classes
            if cls.id not in existing_class_ids
        ]
        if missing:
            CurriculumClassAssignment.objects.bulk_create(missing, ignore_conflicts=True)
        return unit

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        unit = self._save_and_assign(serializer.validated_data)
        serializer.instance = unit

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        unit = self._save_and_assign(serializer.validated_data | {"grade": serializer.instance.grade, "unit_code": serializer.instance.unit_code})
        serializer.instance = unit

class ScopedContractInventoryViewSet(ScopedDetailMixin, ContractInventoryViewSet): pass
class ScopedContractLeadViewSet(ScopedDetailMixin, ContractLeadViewSet): pass
class ScopedContractProjectViewSet(ScopedDetailMixin, ContractProjectViewSet): pass
class ScopedContractQuizAttemptViewSet(ScopedDetailMixin, ContractQuizAttemptViewSet): pass

class ScopedContractQuizViewSet(ScopedDetailMixin, ContractQuizViewSet):
    def scoped_queryset(self):
        qs = super().scoped_queryset()
        if self.request.user.role == UserRole.TRAINER:
            assigned_ids = QuizClassAssignment.objects.filter(
                school_class__id__in=self._accessible_class_ids()
            ).values("quiz_id")
            return qs.model.objects.filter(
                Q(pk__in=assigned_ids) | Q(created_by=self.request.user)
            ).select_related("created_by").prefetch_related("questions").distinct()
        return qs

    def _accessible_class_ids(self):
        return accessible_class_queryset(self.request.user).values("id")

class ScopedContractReviewViewSet(ScopedDetailMixin, ContractReviewViewSet): pass
class ScopedContractSchoolViewSet(ScopedDetailMixin, ContractSchoolViewSet): pass
class ScopedContractSessionViewSet(ScopedDetailMixin, ContractSessionViewSet): pass
class ScopedContractSessionCompatViewSet(ScopedDetailMixin, ContractSessionCompatViewSet): pass

class ScopedContractStudentViewSet(ScopedDetailMixin, ContractStudentViewSet):
    def map_out(self, obj):
        payload = super().map_out(obj)
        school = getattr(getattr(obj, "school_class", None), "school", None)
        school_class = getattr(obj, "school_class", None)
        payload.update({
            "school_id": school.school_code if school else "",
            "school_code": school.school_code if school else "",
            "school_name": school.name if school else "",
            "class_name": school_class.display_name if school_class else "",
            "roll_number": obj.roll_number,
            "account_username": getattr(obj.account, "username", "") if obj.account_id else "",
        })
        return payload

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=self.map_in(request.data))
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        payload = self.map_out(serializer.instance)
        password = getattr(serializer, "generated_password", None)
        if password:
            payload["initial_password"] = password
        return Response(payload, status=status.HTTP_201_CREATED, headers=self.get_success_headers(payload))


class ScopedContractTrainerViewSet(ScopedDetailMixin, ContractTrainerViewSet):
    def map_out(self, obj):
        payload = super().map_out(obj)
        assignments = obj.school_assignments.filter(status="active").select_related("school")
        payload["assigned_schools"] = [assignment.school.school_code for assignment in assignments]
        return payload

class ScopedContractBillingFullViewSet(ScopedDetailMixin, ContractBillingFullViewSet): pass
class ScopedStableAttendanceViewSet(ScopedDetailMixin, StableAttendanceViewSet): pass
class ScopedSessionActivityViewSet(ScopedDetailMixin, SessionActivityViewSet): pass
class ScopedStableQuizQuestionViewSet(ScopedDetailMixin, StableQuizQuestionViewSet): pass
class ScopedQuizAssignmentViewSet(ScopedDetailMixin, QuizAssignmentViewSet): pass
class ScopedProjectEvidenceViewSet(ScopedDetailMixin, ProjectEvidenceViewSet): pass
