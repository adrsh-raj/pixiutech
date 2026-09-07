from django.urls import path
from rest_framework.routers import DefaultRouter

from accounts.views import LoginView, LogoutView, MeView, RefreshView
from .api_v1_compat import (
    ContractAssessmentViewSet,
    ContractAttendanceViewSet,
    ContractBillingViewSet,
    ContractClassViewSet,
    ContractContentViewSet,
    ContractCurriculumViewSet,
    ContractInventoryViewSet,
    ContractLeadViewSet,
    ContractNotificationViewSet,
    ContractProjectViewSet,
    ContractQuizAttemptViewSet,
    ContractQuizViewSet,
    ContractReviewViewSet,
    ContractSessionViewSet,
    ContractStudentViewSet,
    ContractTrainerViewSet,
    health,
    upload,
)
from .phase7_contract_overrides import ContractSchoolCompatViewSet, ContractSessionCompatViewSet

# No trailing slash keeps the old portal request contract intact while the
# public API is now owned by Django. Auth endpoints retain explicit slashes.
router = DefaultRouter(trailing_slash=False)
router.register("schools", ContractSchoolCompatViewSet, basename="v1-school")
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
router.register("billing", ContractBillingViewSet, basename="v1-billing")
router.register("inventory", ContractInventoryViewSet, basename="v1-inventory")
router.register("leads", ContractLeadViewSet, basename="v1-lead")
router.register("notifications", ContractNotificationViewSet, basename="v1-notification")

urlpatterns = [
    path("health/", health, name="v1-health"),
    path("upload/", upload, name="v1-upload"),
    path("auth/login/", LoginView.as_view(), name="v1-login"),
    path("auth/refresh/", RefreshView.as_view(), name="v1-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="v1-logout"),
    path("auth/me/", MeView.as_view(), name="v1-me"),
] + router.urls
