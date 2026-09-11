from academics.services import accessible_class_queryset, accessible_student_queryset
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

from .scoped_contract_views import (
    ScopedContractAssessmentViewSet,
    ScopedContractAttendanceViewSet,
    ScopedContractClassViewSet,
    ScopedContractContentViewSet,
    ScopedContractCurriculumViewSet,
    ScopedContractProjectViewSet,
    ScopedContractQuizAttemptViewSet,
    ScopedContractStudentViewSet,
    ScopedProjectEvidenceViewSet,
)
from .quiz_contract_view import ScopedContractQuizViewSetStrict
from .strict_session_views import StrictScopedSessionViewSet


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
