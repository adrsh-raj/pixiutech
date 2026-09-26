from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from academics.models import School, SchoolClass, Student, Trainer
from billing.models import Invoice
from crm.models import Lead

User = get_user_model()


class Phase7APITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(username="phase7-admin", password="StrongAdminPass!123", role="admin", status="active")
        cls.trainer = User.objects.create_user(username="phase7-trainer", password="StrongTrainerPass!123", role="trainer", status="active")

    def auth(self, user):
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["username"] = user.username
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_v1_public_enquiry_uses_canonical_django_endpoint(self):
        response = self.client.post(
            "/api/v1/public/enquiries",
            {
                "school": "Phase Seven Enquiry",
                "person": "Public Contact",
                "phone": "9876543210",
                "email": "public@example.com",
                "city": "Lucknow",
                "strength": "120",
                "message": "Canonical API smoke test",
                "website": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["success"])
        self.assertTrue(Lead.objects.filter(organization_name="Phase Seven Enquiry").exists())
    def test_v1_login_contract_returns_access_refresh_and_user(self):
        response = self.client.post("/api/v1/auth/login/", {"username": "phase7-admin", "password": "StrongAdminPass!123", "role": "admin"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["role"], "admin")

    def test_v1_school_resource_uses_legacy_portal_shape(self):
        self.auth(self.admin)
        school = School.objects.create(school_code="P7", name="Phase Seven School", principal_name="Principal")
        response = self.client.get("/api/v1/schools")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["school_id"], "P7")
        self.assertEqual(response.data[0]["name"], school.name)
        self.assertIn("id", response.data[0])

    def test_v1_class_and_student_legacy_identifiers_resolve(self):
        self.auth(self.admin)
        school = School.objects.create(school_code="P72", name="Phase Seven Two")
        school_class = SchoolClass.objects.create(school=school, grade="8", section="A")
        student = Student.objects.create(school_class=school_class, roll_number=1, name="Student One")
        class_response = self.client.get(f"/api/v1/classes/{school_class.id}")
        self.assertEqual(class_response.status_code, 200)
        self.assertEqual(class_response.data["class_id"], "CLS-P72-8A")
        student_response = self.client.get(f"/api/v1/students/{student.id}")
        self.assertEqual(student_response.status_code, 200)
        self.assertEqual(student_response.data["student_id"], student.student_id)

    def test_non_admin_can_use_scoped_v1_resources(self):
        school = School.objects.create(school_code="P73", name="Phase Seven Three")
        trainer_profile = Trainer.objects.create(trainer_id="P7T", name="Trainer One", account=self.trainer)
        from academics.models import TrainerSchoolAssignment
        TrainerSchoolAssignment.objects.create(trainer=trainer_profile, school=school, assigned_from=date.today())
        self.auth(self.trainer)
        response = self.client.get("/api/v1/trainers")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["trainer_id"], "P7T")

    def test_v1_unauthenticated_request_is_denied(self):
        response = self.client.get("/api/v1/schools")
        self.assertIn(response.status_code, {401, 403})

    def test_refresh_endpoint_rotates_access_token(self):
        refresh = RefreshToken.for_user(self.admin)
        response = self.client.post("/api/v1/auth/refresh/", {"refresh": str(refresh)}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

