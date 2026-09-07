from django.utils import timezone
from rest_framework import serializers

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "notification_type", "title", "message", "read_at", "created_at"]
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["id", "in_app_enabled", "email_enabled", "sms_enabled", "updated_at"]
        read_only_fields = ["id", "updated_at"]


class NotificationReadSerializer(serializers.Serializer):
    read = serializers.BooleanField(default=True)

    def update(self, instance, validated_data):
        instance.read_at = timezone.now() if validated_data.get("read", True) else None
        instance.save(update_fields=["read_at"])
        return instance
