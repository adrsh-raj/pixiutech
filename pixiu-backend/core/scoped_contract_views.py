from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from .api_v1_compat import (
    ContractAssessmentViewSet, ContractAttendanceViewSet, ContractClassViewSet, ContractContentViewSet,
    ContractCurriculumViewSet, ContractInventoryViewSet, ContractLeadViewSet, ContractProjectViewSet,
    ContractQuizAttemptViewSet, ContractQuizViewSet, ContractReviewViewSet, ContractSchoolViewSet,
    ContractSessionViewSet, ContractStudentViewSet, ContractTrainerViewSet, ContractBillingFullViewSet,
)
from .phase7_contract_overrides import ContractSessionCompatViewSet
from .learning_attendance_overrides import StableAttendanceViewSet
from learning.models import ContentClassAssignment, SchoolClass
from learning.views import ProjectEvidenceViewSet, QuizAssignmentViewSet, SessionActivityViewSet
from learning.watermarking import prepare_uploaded_file
from .learning_contract_overrides import StableQuizQuestionViewSet


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
class ScopedContractCurriculumViewSet(ScopedDetailMixin, ContractCurriculumViewSet): pass
class ScopedContractInventoryViewSet(ScopedDetailMixin, ContractInventoryViewSet): pass
class ScopedContractLeadViewSet(ScopedDetailMixin, ContractLeadViewSet): pass
class ScopedContractProjectViewSet(ScopedDetailMixin, ContractProjectViewSet): pass
class ScopedContractQuizAttemptViewSet(ScopedDetailMixin, ContractQuizAttemptViewSet): pass
class ScopedContractQuizViewSet(ScopedDetailMixin, ContractQuizViewSet): pass
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


class ScopedContractBillingFullViewSet(ScopedDetailMixin, ContractBillingFullViewSet): pass
class ScopedStableAttendanceViewSet(ScopedDetailMixin, StableAttendanceViewSet): pass
class ScopedSessionActivityViewSet(ScopedDetailMixin, SessionActivityViewSet): pass
class ScopedStableQuizQuestionViewSet(ScopedDetailMixin, StableQuizQuestionViewSet): pass
class ScopedQuizAssignmentViewSet(ScopedDetailMixin, QuizAssignmentViewSet): pass
class ScopedProjectEvidenceViewSet(ScopedDetailMixin, ProjectEvidenceViewSet): pass
