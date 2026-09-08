from django.test import SimpleTestCase

from core.phase6 import ControlledResetAPI
from .models import AuditAction, AuditLog


class AuditSafetyTests(SimpleTestCase):
    def test_required_server_audit_actions_exist(self):
        required = {'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'VOID', 'PASSWORD_RESET', 'ASSIGNMENT_CHANGE', 'ATTENDANCE_OVERRIDE', 'PAYMENT'}
        available = {value for value, _label in AuditAction.choices}
        self.assertTrue(required.issubset(available))

    def test_controlled_reset_never_targets_audit_logs(self):
        reset = ControlledResetAPI()
        for scope in sorted(reset.SCOPES):
            self.assertNotIn(AuditLog, reset._models(scope))
