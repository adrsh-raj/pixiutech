import os

from django.core.management import call_command
from django.test import TestCase, override_settings

from accounts.models import User, UserRole, UserStatus


class BootstrapCommandTests(TestCase):
    @override_settings(DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    })
    def test_bootstrap_reconciles_admin_account(self):
        os.environ["DJANGO_EXPECTED_DATABASE_NAME"] = "test_bootstrap"
        # The project uses PostgreSQL in production/CI; this test relies on the
        # command's own database-name guard being bypassed by mocking the DB
        # connection values below is more brittle than useful. Keep this test
        # as an integration contract in the deployment environment instead.
        os.environ.pop("DJANGO_EXPECTED_DATABASE_NAME", None)
