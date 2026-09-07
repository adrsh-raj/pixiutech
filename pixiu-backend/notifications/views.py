from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsActiveAccount
from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer, NotificationReadSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes=[IsAuthenticated, IsActiveAccount]
    serializer_class=NotificationSerializer
    queryset=Notification.objects.all()
    def get_queryset(self): return self.queryset.filter(recipient=self.request.user)
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification=self.get_object(); notification.read_at=__import__('django.utils.timezone',fromlist=['timezone']).timezone.now(); notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated=self.get_queryset().filter(read_at__isnull=True).update(read_at=__import__('django.utils.timezone',fromlist=['timezone']).timezone.now())
        return Response({"updated":updated},status=status.HTTP_200_OK)


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated, IsActiveAccount]
    serializer_class=NotificationPreferenceSerializer
    queryset=NotificationPreference.objects.all()
    http_method_names=["get","post","put","patch"]
    def get_queryset(self): return self.queryset.filter(user=self.request.user)
    def perform_create(self, serializer): serializer.save(user=self.request.user)
    def perform_update(self, serializer):
        if serializer.instance.user_id != self.request.user.id: raise PermissionDenied("You cannot edit another user's notification preferences.")
        serializer.save()
