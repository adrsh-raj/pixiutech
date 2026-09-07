from django.test import TestCase
from accounts.models import User, UserRole
from .models import AuditLog
from .services import record_audit

class AuditTests(TestCase):
    def test_audit_log_is_append_only(self):
        user=User.objects.create_user("audit-admin","strong-pass",role=UserRole.ADMIN,is_staff=True)
        log=record_audit(actor=user,action="create",entity_type="Invoice",entity_id="1",summary="Created invoice")
        with self.assertRaises(ValueError):
            log.summary="Changed"; log.save()
        with self.assertRaises(ValueError):
            log.delete()
