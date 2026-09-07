from django.test import TestCase
from accounts.models import User, UserRole
from .models import Notification, NotificationPreference
from .services import notify

class NotificationTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user("notif-user","strong-pass",role=UserRole.STUDENT)
    def test_notification_is_recipient_bound_and_deduplicated(self):
        first=notify(recipient=self.user,title="Payment",message="Paid",notification_type="payment",event_key="payment:1")
        second=notify(recipient=self.user,title="Payment again",message="Paid again",notification_type="payment",event_key="payment:1")
        self.assertEqual(first.id, second.id)
        self.assertEqual(Notification.objects.filter(recipient=self.user).count(),1)
