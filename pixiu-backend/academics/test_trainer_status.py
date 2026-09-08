from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, UserRole, UserStatus
from .models import Trainer


class TrainerStatusActionTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="status-admin",
            password="AdminPass123!",
            role=UserRole.ADMIN,
            is_staff=True,
            status=UserStatus.ACTIVE,
        )
        self.trainer_user = User.objects.create_user(
            username="TR-009",
            password="TrainerPass123!",
            role=UserRole.TRAINER,
            status=UserStatus.ACTIVE,
        )
        self.trainer = Trainer.objects.create(
            trainer_id="TR-009",
            name="Status Trainer",
            account=self.trainer_user,
            status="active",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_deactivate_trainer_account(self):
        response = self.client.put(
            f"/api/academics/trainers/{self.trainer.id}/status/",
            {"status": "inactive"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.trainer.refresh_from_db()
        self.trainer_user.refresh_from_db()
        self.assertEqual(self.trainer.status, "inactive")
        self.assertEqual(self.trainer_user.status, UserStatus.INACTIVE)
        self.assertFalse(self.trainer_user.is_active)

    def test_invalid_trainer_status_is_rejected(self):
        response = self.client.put(
            f"/api/academics/trainers/{self.trainer.id}/status/",
            {"status": "paused"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
