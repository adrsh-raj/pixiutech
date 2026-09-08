from django.urls import path
from rest_framework.routers import DefaultRouter

from accounts.legacy_credential_routes import SchoolProfilePasswordResetView, TrainerProfilePasswordResetView
from accounts.views import LoginView, LogoutView, MeView, RefreshView
from audit.views import AuditLogViewSet
from .analytics import SchoolPerformanceView, StudentProgressView, TrainerPerformanceView
from .class_ranking import ClassRankingView
from .api_v1_compat import (
    ContractAssessmentViewSet, ContractAttendanceViewSet, ContractClassViewSet, ContractContentViewSet,
    ContractCurriculumViewSet, ContractInventoryViewSet, ContractLeadViewSet, ContractProjectViewSet,
    ContractQuizAttemptViewSet, ContractQuizViewSet, ContractReviewViewSet, ContractSessionViewSet,
    ContractSchoolViewSet, ContractStudentViewSet, ContractTrainerViewSet, health, upload,
)
from .phase7_compat_extras import ContractBillingFullViewSet, ContractCommunicationLogViewSet, ContractNotificationFullViewSet
from .phase7_contract_overrides import ContractSessionCompatViewSet
from .trainer_materials import TrainerMaterialDetailView, TrainerMaterialFileView, TrainerMaterialListCreateView

router = DefaultRouter(trailing_slash=False)
router.register("schools", ContractSchoolViewSet, basename="v1-school")
router.register("trainers", ContractTrainerViewSet, basename="v1-trainer")
router.register("classes", ContractClassViewSet, basename="v1-class")
router.register("students", ContractStudentViewSet, basename="v1-student")
router.register("sessions", ContractSessionCompatViewSet, basename="v1-session")
router.register("attendance", ContractAttendanceViewSet, basename="v1-attendance")
router.register("curriculum", ContractCurriculumViewSet, basename="v1-curriculum")
router.register("content", ContractContentViewSet, basename="v1-content")
router.register("quizzes", ContractQuizViewSet, basename="v1-quiz")
router.register("quiz-submissions", ContractQuizAttemptViewSet, basename="v1-quiz-submission")
router.register("reviews", ContractReviewViewSet, basename="v1-review")
router.register("assessments", ContractAssessmentViewSet, basename="v1-assessment")
router.register("projects", ContractProjectViewSet, basename="v1-project")
router.register("billing", ContractBillingFullViewSet, basename="v1-billing")
router.register("inventory", ContractInventoryViewSet, basename="v1-inventory")
router.register("leads", ContractLeadViewSet, basename="v1-lead")
router.register("notifications", ContractNotificationFullViewSet, basename="v1-notification")
router.register("comms", ContractCommunicationLogViewSet, basename="v1-comms")
router.register("logs", AuditLogViewSet, basename="v1-audit-log")

urlpatterns = [
    path("health/", health, name="v1-health"),
    path("upload/", upload, name="v1-upload"),
    path("auth/login/", LoginView.as_view(), name="v1-login"),
    path("auth/refresh/", RefreshView.as_view(), name="v1-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="v1-logout"),
    path("auth/me/", MeView.as_view(), name="v1-me"),
    path("schools/<uuid:pk>/reset-password", SchoolProfilePasswordResetView.as_view(), name="v1-school-password-reset"),
    path("trainers/<uuid:pk>/reset-password", TrainerProfilePasswordResetView.as_view(), name="v1-trainer-password-reset"),
    path("trainer-materials", TrainerMaterialListCreateView.as_view(), name="v1-trainer-material-list-create"),
    path("trainer-materials/<uuid:pk>", TrainerMaterialDetailView.as_view(), name="v1-trainer-material-detail"),
    path("trainer-materials/<uuid:pk>/file", TrainerMaterialFileView.as_view(), name="v1-trainer-material-file"),
    path("class-ranking", ClassRankingView.as_view(), name="v1-class-ranking"),
    path("student-progress", StudentProgressView.as_view(), name="v1-student-progress"),
    path("trainer-performance", TrainerPerformanceView.as_view(), name="v1-trainer-performance"),
    path("school-performance", SchoolPerformanceView.as_view(), name="v1-school-performance"),
] + router.urls
