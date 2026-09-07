from django.urls import path
from .phase6 import DashboardSummaryAPI, ReportsOverviewAPI, IntegrityAuditAPI, ControlledResetAPI

urlpatterns = [
    path("dashboard/summary/", DashboardSummaryAPI.as_view(), name="phase6-dashboard-summary"),
    path("reports/overview/", ReportsOverviewAPI.as_view(), name="phase6-reports-overview"),
    path("integrity-audit/", IntegrityAuditAPI.as_view(), name="phase6-integrity-audit"),
    path("controlled-reset/", ControlledResetAPI.as_view(), name="phase6-controlled-reset"),
]
