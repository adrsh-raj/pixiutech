from rest_framework.exceptions import ValidationError

from accounts.models import UserRole
from academics.services import (
    accessible_assignment_queryset,
    accessible_class_queryset,
    accessible_school_queryset,
    accessible_student_queryset,
    accessible_trainer_queryset,
)
from academics.views import TrainerSchoolAssignmentViewSet
from learning.models import Quiz, QuizClassAssignment, QuizQuestion, SessionActivity
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
    pass


class SafeScopedAttendanceViewSet(ScopedContractAttendanceViewSet):
    def get_queryset(self):
        return accessible_attendance(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedSessionActivityViewSet(ScopedSessionActivityViewSet):
    def get_queryset(self):
        return SessionActivity.objects.filter(
            session_id__in=accessible_sessions(self.request.user).values("id")
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
        return QuizClassAssignment.objects.filter(
            school_class_id__in=accessible_class_queryset(self.request.user).values("id")
        ).select_related("quiz", "school_class") if self.request.user.role != UserRole.ADMIN else QuizClassAssignment.objects.select_related("quiz", "school_class")
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedQuizAttemptViewSet(ScopedContractQuizAttemptViewSet):
    def get_queryset(self):
        return accessible_attempts(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedAssessmentViewSet(ScopedContractAssessmentViewSet):
    def get_queryset(self):
        return accessible_assessments(self.request.user)
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
