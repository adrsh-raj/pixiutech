from .api_v1_compat import (
    ContractAssessmentViewSet,
    ContractAttendanceViewSet,
    ContractClassViewSet,
    ContractContentViewSet,
    ContractCurriculumViewSet,
    ContractInventoryViewSet,
    ContractLeadViewSet,
    ContractProjectViewSet,
    ContractQuizAttemptViewSet,
    ContractQuizViewSet,
    ContractReviewViewSet,
    ContractSchoolViewSet,
    ContractSessionViewSet,
    ContractStudentViewSet,
    ContractTrainerViewSet,
    ContractBillingFullViewSet,
)
from .phase7_contract_overrides import ContractSessionCompatViewSet
from .learning_attendance_overrides import StableAttendanceViewSet
from learning.views import ProjectEvidenceViewSet, QuizAssignmentViewSet, SessionActivityViewSet
from .learning_contract_overrides import StableQuizQuestionViewSet


class ScopedDetailMixin:
    """Make legacy compatibility detail operations use the same scope as list operations."""

    def get_object(self):
        scoped = getattr(self, "scoped_queryset", None)
        queryset = scoped() if callable(scoped) else self.get_queryset()
        queryset = self.filter_queryset(queryset)
        lookup = self.lookup_url_kwarg or self.lookup_field
        obj = queryset.get(**{self.lookup_field: self.kwargs[lookup]})
        self.check_object_permissions(self.request, obj)
        return obj


class ScopedContractAssessmentViewSet(ScopedDetailMixin, ContractAssessmentViewSet): pass
class ScopedContractAttendanceViewSet(ScopedDetailMixin, ContractAttendanceViewSet): pass
class ScopedContractClassViewSet(ScopedDetailMixin, ContractClassViewSet): pass
class ScopedContractContentViewSet(ScopedDetailMixin, ContractContentViewSet): pass
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
class ScopedContractStudentViewSet(ScopedDetailMixin, ContractStudentViewSet): pass
class ScopedContractTrainerViewSet(ScopedDetailMixin, ContractTrainerViewSet): pass
class ScopedContractBillingFullViewSet(ScopedDetailMixin, ContractBillingFullViewSet): pass
class ScopedStableAttendanceViewSet(ScopedDetailMixin, StableAttendanceViewSet): pass


class ScopedSessionActivityViewSet(ScopedDetailMixin, SessionActivityViewSet): pass
class ScopedStableQuizQuestionViewSet(ScopedDetailMixin, StableQuizQuestionViewSet): pass
class ScopedQuizAssignmentViewSet(ScopedDetailMixin, QuizAssignmentViewSet): pass
class ScopedProjectEvidenceViewSet(ScopedDetailMixin, ProjectEvidenceViewSet): pass
