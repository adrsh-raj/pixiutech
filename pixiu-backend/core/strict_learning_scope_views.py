from academics.services import (
    accessible_assignment_queryset,
    accessible_class_queryset,
    accessible_school_queryset,
    accessible_student_queryset,
    accessible_trainer_queryset,
)
from learning.models import QuizClassAssignment, QuizQuestion
from learning.services import (
    accessible_assessments,
    accessible_attendance,
    accessible_content,
    accessible_curriculum,
    accessible_evidence,
    accessible_projects,
    accessible_quizzes,
    accessible_sessions,
    accessible_attempts,
)
from .api_v1_compat import ContractTrainerViewSet
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
from academics.views import TrainerSchoolAssignmentViewSet


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
        return __import__('learning.models', fromlist=['SessionActivity']).SessionActivity.objects.filter(
            session_id__in=accessible_sessions(self.request.user).values('id')
        ).select_related('session')
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedCurriculumViewSet(ScopedContractCurriculumViewSet):
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
        return accessible_quizzes(self.request.user)
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedQuizQuestionViewSet(__import__('core.learning_contract_overrides', fromlist=['StableQuizQuestionViewSet']).StableQuizQuestionViewSet):
    def get_queryset(self):
        return QuizQuestion.objects.filter(quiz_id__in=accessible_quizzes(self.request.user).values('id')).select_related('quiz')
    def scoped_queryset(self):
        return self.get_queryset()


class SafeScopedQuizAssignmentViewSet(ScopedQuizAssignmentViewSet):
    def get_queryset(self):
        if self.request.user.role == 'admin':
            return QuizClassAssignment.objects.select_related('quiz', 'school_class')
        return QuizClassAssignment.objects.filter(
            school_class_id__in=accessible_class_queryset(self.request.user).values('id')
        ).select_related('quiz', 'school_class')
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
