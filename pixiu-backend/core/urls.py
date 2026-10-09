from django.urls import include, path
from learning.trainer_units import TrainerUnitListCreateView

urlpatterns = [
    path("trainer-units", TrainerUnitListCreateView.as_view(), name="core-trainer-units"),
    path("trainer-units/", TrainerUnitListCreateView.as_view(), name="core-trainer-units-slash"),
    path("api/", include("core.api_v1_urls")),
    path("api/accounts/", include("accounts.urls")),
    path("api/academics/", include("academics.urls")),
    path("api/learning/", include("learning.urls")),
    path("api/billing/", include("billing.urls")),
    path("api/inventory/", include("inventory.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/crm/", include("crm.urls")),
    path("api/audit/", include("audit.urls")),
    path("api/phase6/", include("core.phase6_urls")),
]
