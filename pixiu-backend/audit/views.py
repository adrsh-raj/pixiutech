from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.viewsets import ReadOnlyModelViewSet

from accounts.permissions import IsActiveAccount
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(ReadOnlyModelViewSet):
    permission_classes=[IsAuthenticated, IsActiveAccount, IsAdminUser]
    serializer_class=AuditLogSerializer
    queryset=AuditLog.objects.select_related("actor")
