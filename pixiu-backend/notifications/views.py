from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from accounts.models import UserRole
from .models import Notification
from .serializers import NotificationSerializer
from .services import mark_notification_read


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return self.queryset
        return self.queryset.filter(recipient=user, expires_at__isnull=True) | self.queryset.filter(recipient=user, expires_at__gt=timezone.now())

    def perform_create(self, serializer):
        if self.request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only admins can create notifications.")
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only admins can edit notifications.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only admins can delete notifications.")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification = self.get_object()
        try:
            notification = mark_notification_read(notification=notification, user=request.user)
        except PermissionError as exc:
            raise PermissionDenied(str(exc))
        return Response(self.get_serializer(notification).data, status=status.HTTP_200_OK)
