from rest_framework.exceptions import ValidationError

from accounts.models import UserRole
from academics.models import SchoolClass
from academics.services import (
    accessible_assignment_queryset,
    accessible_class_queryset,
    accessible_school_queryset,
    accessible_student_queryset,
    accessible_trainer_queryset,
)
from academics.views import TrainerSchoolAssignmentViewSet
from learning.models import ContentClassAssignment, LearningContent, Quiz, QuizClassAssignment, QuizQuestion, SessionActivity
from learning.services import (
    accessible_assessments,
    accessible_attendance,
    accessible_content,
    accessible_curriculum,
    accessible_evidence,
    accessible_projects,
    accessible_sessions,
    accessible_attempts,
)
from .api_v1_compat import ContractTrainerViewSet
from .learning_contract_overrides import StableQuizQuestionViewSet
from .scoped_contract_views import (
    ScopedContractAssessmentViewSet,
    ScopedContractAttendanceViewSet,
    ScopedContractClassViewSet,
    ScopedContractContentViewSet,
    ScopedContractCurriculumViewSet,
    ScopedContractProjectViewSet,
    ScopedContractQuizAttemptViewSet,
    ScopedContractSchoolViewSet,
    ScopedContractStudentViewSet,
    ScopedProjectEvidenceViewSet,
    ScopedSessionActivityViewSet,
    ScopedQuizAssignmentViewSet,
)
from .quiz_contract_view import ScopedContractQuizViewSetStrict
from .strict_session_views import StrictScopedSessionViewSet
from learning.watermarking import prepare_uploaded_file
from django.db import transaction


def _accessible_quiz_queryset(user):
    if user.role == UserRole.ADMIN:
        return Quiz.objects.all()
    return Quiz.objects.filter(
        class_assignments__school_class_id__in=accessible_class_queryset(user).values("id")
    ).distinct()


class SafeScopedSchoolViewSet(ScopedContractSchoolViewSet):
    def get_queryset(self):
        return accessible_school_queryset(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedTrainerViewSet(ContractTrainerViewSet):
    def get_queryset(self):
        return accessible_trainer_queryset(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedTrainerSchoolAssignmentViewSet(TrainerSchoolAssignmentViewSet):
    def get_queryset(self):
        return accessible_assignment_queryset(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedClassViewSet(ScopedContractClassViewSet):
    def get_queryset(self):
        return accessible_class_queryset(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedStudentViewSet(ScopedContractStudentViewSet):
    def get_queryset(self):
        return accessible_student_queryset(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedSessionViewSet(StrictScopedSessionViewSet):
    def get_queryset(self):
        qs = accessible_sessions(self.request.user)
        if self.request.user.role == UserRole.TRAINER:
            qs = qs.filter(school_class_id__in=accessible_class_queryset(self.request.user).values("id"))
        return qs
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedAttendanceViewSet(ScopedContractAttendanceViewSet):
    def get_queryset(self):
        qs = accessible_attendance(self.request.user)
        if self.request.user.role == UserRole.TRAINER:
            qs = qs.filter(session__school_class_id__in=accessible_class_queryset(self.request.user).values("id"))
        return qs
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedSessionActivityViewSet(ScopedSessionActivityViewSet):
    def get_queryset(self):
        return SessionActivity.objects.filter(
            session_id__in=SafeScopedSessionViewSet.get_queryset(self).values("id")
        ).select_related("session")
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedCurriculumViewSet(ScopedContractCurriculumViewSet):
    def map_in(self, data):
        level = str(data.get("level") or data.get("unit_level") or "").strip()
        if not level:
            raise ValidationError({"level": "Level is required. Enter the level manually for this unit."})
        return super().map_in(data)

    def get_queryset(self):
        return accessible_curriculum(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedContentViewSet(ScopedContractContentViewSet):
    def get_queryset(self):
        return accessible_content(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()

    def _target_school(self):
        school_id = self.request.data.get("school") or self.request.data.get("school_id")
        if not school_id:
            raise ValidationError({"school": "Select the school that should receive this content."})
        school = accessible_school_queryset(self.request.user).filter(pk=school_id).first()
        if not school:
            # Also accept a school code for legacy/front-end compatibility.
            school = accessible_school_queryset(self.request.user).filter(school_code=str(school_id).strip().upper()).first()
        if not school:
            raise ValidationError({"school": "You cannot share content to this school."})
        return school

    def _target_grade(self):
        grade = str(self.request.data.get("grade") or "").strip()
        if not grade.isdigit():
            raise ValidationError({"grade": "A numeric grade is required for scoped content sharing."})
        return grade

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

    @transaction.atomic
    def _save_scoped_content(self, serializer, *, update=False):
        user = self.request.user
        if user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            raise ValidationError({"detail": "Only administrators and trainers can create learning content."})

        target_role = str(serializer.validated_data.get("target_role", getattr(serializer.instance, "target_role", "student")) or "student").strip().lower()
        if user.role == UserRole.TRAINER and target_role != "student":
            raise ValidationError({"target_role": "Trainers can share learning content with students only."})

        if update and user.role == UserRole.TRAINER and serializer.instance.created_by_id != user.id:
            raise ValidationError({"detail": "Trainers can edit only content they created."})

        school = self._target_school()
        grade = self._target_grade()
        active_classes = SchoolClass.objects.filter(school_id=school.id, grade=grade, status="active").only("id")
        class_ids = list(active_classes.values_list("id", flat=True))
        if not class_ids:
            raise ValidationError({"grade": f"School {school.school_code} has no active class in Grade {grade}."})

        self._prepare_content_file(serializer)
        if update:
            content = serializer.save(created_by=user if user.role == UserRole.TRAINER else serializer.instance.created_by)
            ContentClassAssignment.objects.filter(content=content).delete()
        else:
            content = serializer.save(created_by=user)

        ContentClassAssignment.objects.bulk_create(
            [ContentClassAssignment(content=content, school_class_id=class_id, assigned_by=user) for class_id in class_ids],
            ignore_conflicts=True,
        )
        return content

    def perform_create(self, serializer):
        self._save_scoped_content(serializer, update=False)

    def perform_update(self, serializer):
        self._save_scoped_content(serializer, update=True)


class SafeScopedQuizViewSet(ScopedContractQuizViewSetStrict):
    def get_queryset(self):
        return _accessible_quiz_queryset(self.request.user).select_related("created_by").prefetch_related("questions")
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedQuizQuestionViewSet(StableQuizQuestionViewSet):
    def get_queryset(self):
        return QuizQuestion.objects.filter(
            quiz_id__in=_accessible_quiz_queryset(self.request.user).values("id")
        ).select_related("quiz")
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedQuizAssignmentViewSet(ScopedQuizAssignmentViewSet):
    def get_queryset(self):
        if self.request.user.role == UserRole.ADMIN:
            return QuizClassAssignment.objects.select_related("quiz", "school_class")
        return QuizClassAssignment.objects.filter(
            school_class_id__in=accessible_class_queryset(self.request.user).values("id")
        ).select_related("quiz", "school_class")
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedQuizAttemptViewSet(ScopedContractQuizAttemptViewSet):
    def get_queryset(self):
        return accessible_attempts(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedAssessmentViewSet(ScopedContractAssessmentViewSet):
    def get_queryset(self):
        qs = accessible_assessments(self.request.user)
        if self.request.user.role == UserRole.TRAINER:
            qs = qs.filter(student__school_class_id__in=accessible_class_queryset(self.request.user).values("id"))
        return qs
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedProjectViewSet(ScopedContractProjectViewSet):
    def get_queryset(self):
        return accessible_projects(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedEvidenceViewSet(ScopedProjectEvidenceViewSet):
    def get_queryset(self):
        return accessible_evidence(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()
