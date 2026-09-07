from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from accounts.models import UserRole
from .models import Lead, LeadActivity
from .serializers import LeadActivitySerializer, LeadSerializer


class AdminOnly(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    def admin(self):
        if self.request.user.role != UserRole.ADMIN:
            raise PermissionDenied("CRM access is admin-only in Phase 5.")


class LeadViewSet(AdminOnly):
    queryset = Lead.objects.select_related("assigned_to", "converted_school", "created_by").prefetch_related("activities")
    serializer_class = LeadSerializer
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs); self.admin()


class LeadActivityViewSet(AdminOnly):
    queryset = LeadActivity.objects.select_related("lead", "actor")
    serializer_class = LeadActivitySerializer
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs); self.admin()
