from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, UserRole
from .models import School, Trainer, TrainerSchoolAssignment


class TrainerOnboardingAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="trainer-admin",
            password="AdminPass123!",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.school = School.objects.create(school_code="XYZ", name="XYZ Academy")
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_create_trainer_without_trainer_id(self):
        response = self.client.post(
            "/api/v1/trainers",
            {
                "trainer_id": None,
                "name": "Anoop Yadav",
                "email": "anoop@gmail.com",
                "phone": "7985403186",
                "qualification": "BTECH",
                "specialization": "CS",
                "daily_rate": 200,
                "weekly_days": 2,
                "rating": 5,
                "status": "Active",
                "password": "AnoopSecurePass123!",
                "assigned_schools": [str(self.school.pk)],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["trainer_id"], "TR-001")
        trainer = Trainer.objects.get(trainer_id="TR-001")
        self.assertEqual(trainer.name, "Anoop Yadav")
        self.assertEqual(trainer.status, "active")
        self.assertEqual(trainer.email, "anoop@gmail.com")
        self.assertTrue(trainer.account.check_password("AnoopSecurePass123!"))
        self.assertTrue(
            TrainerSchoolAssignment.objects.filter(
                trainer=trainer,
                school=self.school,
                status="active",
            ).exists()
        )
