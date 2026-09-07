from django.utils import timezone

from .models import Notification, NotificationPreference


def notify(*, recipient, title: str, message: str, notification_type="info", event_key=""):
    prefs, _ = NotificationPreference.objects.get_or_create(user=recipient)
    if not prefs.in_app_enabled:
        return None
    if event_key:
        notification, created = Notification.objects.get_or_create(
            recipient=recipient,
            event_key=event_key,
            defaults={
                "notification_type": notification_type,
                "title": title,
                "message": message,
            },
        )
        return notification
    return Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        event_key=f"manual:{timezone.now().timestamp()}",
    )
