from django.utils import timezone
from .models import Notification


def create_notification(*, recipient, title, body, notification_type="system", action_url="", expires_at=None):
    return Notification.objects.create(recipient=recipient, title=title, body=body, notification_type=notification_type, action_url=action_url, expires_at=expires_at)


def mark_notification_read(*, notification, user):
    if notification.recipient_id != user.id:
        raise PermissionError("Notification does not belong to this user.")
    notification.read_at = timezone.now()
    notification.save(update_fields=["read_at"])
    return notification
