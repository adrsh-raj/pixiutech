import uuid

from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    SYSTEM = "system", "System"
    BILLING = "billing", "Billing"
    LEARNING = "learning", "Learning"
    INVENTORY = "inventory", "Inventory"
    CRM = "crm", "CRM"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices, default=NotificationType.SYSTEM)
    title = models.CharField(max_length=200)
    body = models.TextField()
    action_url = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "read_at"]), models.Index(fields=["recipient", "created_at"]) ]
