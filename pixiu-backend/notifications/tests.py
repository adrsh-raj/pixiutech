from django.test import TestCase
from django.utils import timezone

from accounts.models import User, UserRole
from .models import Notification
from .services import create_notification, mark_notification_read


class NotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("notify-user", "strong-password", role=UserRole.STUDENT)

    def test_user_can_read_own_notification(self):
        notification = create_notification(recipient=self.user, title="Test", body="Hello")
        mark_notification_read(notification=notification, user=self.user)
        notification.refresh_from_db()
        self.assertIsNotNone(notification.read_at)

    def test_read_timestamp_is_server_generated(self):
        notification = Notification.objects.create(recipient=self.user, title="T", body="B")
        self.assertIsNone(notification.read_at)
        mark_notification_read(notification=notification, user=self.user)
        self.assertLessEqual(notification.read_at, timezone.now())
