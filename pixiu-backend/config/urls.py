from django.contrib import admin
from django.urls import include, path

handler400 = "rest_framework.exceptions.bad_request"
handler500 = "rest_framework.exceptions.server_error"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/v1/", include("core.api_v1_urls")),
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
