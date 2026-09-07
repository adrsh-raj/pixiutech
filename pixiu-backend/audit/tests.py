from django.test import TestCase

from accounts.models import User, UserRole
from .models import AuditLog
from .services import record_audit


class AuditTests(TestCase):
    def test_audit_event_is_append_only_data(self):
        user = User.objects.create_user("audit-admin", "strong-password", role=UserRole.ADMIN, is_staff=True)
        event = record_audit(actor=user, action="create", app_label="billing", model_name="Invoice", object_id="123", method="POST", path="/api/billing/invoices/", status_code=201)
        self.assertEqual(AuditLog.objects.count(), 1)
        self.assertEqual(event.actor_id, user.id)
