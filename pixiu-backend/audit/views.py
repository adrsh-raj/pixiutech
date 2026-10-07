from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from audit.models import AuditAction
from audit.services import record_audit
from accounts.models import UserRole

from accounts.permissions import IsActiveAccount
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, IsAdminUser]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.select_related("actor")

    @action(detail=True, methods=["post"], url_path="permanent-delete")
    @transaction.atomic
    def permanent_delete(self, request, pk=None):
        if getattr(request.user, "role", None) != UserRole.ADMIN or not request.user.is_staff:
            return Response({"detail": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)

        password = str(request.data.get("password") or "")
        if not password:
            raise serializers.ValidationError({"password": "Enter your current admin password to permanently delete this audit log."})

        if not request.user.check_password(password):
            return Response({"detail": "Password verification failed. The audit log was not deleted."}, status=status.HTTP_403_FORBIDDEN)

        log = self.get_object()
        deleted_id = str(log.pk)
        summary = log.summary[:500]
        entity_type = log.entity_type
        entity_id = log.entity_id

        # Record the privileged deletion as a fresh audit event, without ever
        # storing the supplied password or other secret material.
        record_audit(
            actor=request.user,
            action=AuditAction.DELETE,
            entity_type="AuditLog",
            entity_id=deleted_id,
            summary=f"Permanently deleted audit log {deleted_id}",
            changes={
                "deleted_entity_type": entity_type,
                "deleted_entity_id": entity_id,
                "deleted_summary": summary,
                "password_reverified": True,
            },
            request=request,
        )

        # AuditLog.delete() intentionally blocks model-level deletes. The
        # privileged endpoint uses a queryset hard-delete after authorization.
        AuditLog.objects.filter(pk=log.pk).delete()

        return Response(
            {"success": True, "deleted_id": deleted_id},
            status=status.HTTP_200_OK,
        )
