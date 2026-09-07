from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/accounts/", include("accounts.urls")),
    path("api/academics/", include("academics.urls")),
    path("api/learning/", include("learning.urls")),
    path("api/billing/", include("billing.urls")),
    path("api/inventory/", include("inventory.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/crm/", include("crm.urls")),
    path("api/audit/", include("audit.urls")),
]
