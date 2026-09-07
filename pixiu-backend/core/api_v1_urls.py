from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import LoginView, LogoutView, MeView, RefreshView
from academics.views import (
    SchoolClassViewSet,
    SchoolViewSet,
    StudentViewSet,
    TrainerSchoolAssignmentViewSet,
    TrainerViewSet,
)
from billing.views import InvoiceViewSet, PaymentViewSet, ReceiptViewSet
from crm.views import LeadActivityViewSet, LeadContactViewSet, LeadViewSet
from inventory.views import (
    InventoryItemViewSet,
    KitCustodyViewSet,
    KitItemViewSet,
    KitViewSet,
    StockBalanceViewSet,
    StockMovementViewSet,
)
from learning.views import (
    AssessmentViewSet,
    AttendanceViewSet,
    ContentViewSet,
    CurriculumUnitViewSet,
    ProjectViewSet,
    QuizAttemptViewSet,
    QuizViewSet,
    SessionViewSet,
)
from notifications.views import NotificationViewSet

router = DefaultRouter()

# Stable Phase-7 resource names. These names intentionally form the public
# contract used by the web portal; app-internal URLs remain free to evolve.
router.register("schools", SchoolViewSet, basename="v1-school")
router.register("trainers", TrainerViewSet, basename="v1-trainer")
router.register("trainer-school-assignments", TrainerSchoolAssignmentViewSet, basename="v1-trainer-school-assignment")
router.register("classes", SchoolClassViewSet, basename="v1-class")
router.register("students", StudentViewSet, basename="v1-student")
router.register("sessions", SessionViewSet, basename="v1-session")
router.register("attendance", AttendanceViewSet, basename="v1-attendance")
router.register("curriculum", CurriculumUnitViewSet, basename="v1-curriculum")
router.register("content", ContentViewSet, basename="v1-content")
router.register("quizzes", QuizViewSet, basename="v1-quiz")
router.register("quiz-submissions", QuizAttemptViewSet, basename="v1-quiz-submission")
router.register("assessments", AssessmentViewSet, basename="v1-assessment")
router.register("projects", ProjectViewSet, basename="v1-project")
router.register("billing", InvoiceViewSet, basename="v1-billing")
router.register("payments", PaymentViewSet, basename="v1-payment")
router.register("receipts", ReceiptViewSet, basename="v1-receipt")
router.register("inventory", KitViewSet, basename="v1-inventory-kit")
router.register("inventory-items", InventoryItemViewSet, basename="v1-inventory-item")
router.register("inventory-stock", StockBalanceViewSet, basename="v1-stock-balance")
router.register("inventory-movements", StockMovementViewSet, basename="v1-stock-movement")
router.register("inventory-kit-items", KitItemViewSet, basename="v1-kit-item")
router.register("inventory-custody", KitCustodyViewSet, basename="v1-kit-custody")
router.register("leads", LeadViewSet, basename="v1-lead")
router.register("lead-activities", LeadActivityViewSet, basename="v1-lead-activity")
router.register("lead-contacts", LeadContactViewSet, basename="v1-lead-contact")
router.register("notifications", NotificationViewSet, basename="v1-notification")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="v1-login"),
    path("auth/refresh/", RefreshView.as_view(), name="v1-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="v1-logout"),
    path("auth/me/", MeView.as_view(), name="v1-me"),
    path("", include(router.urls)),
]
