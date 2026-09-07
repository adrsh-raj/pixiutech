from datetime import date, time

from django.db import connection
from django.test import SimpleTestCase
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Trainer, TrainerSchoolAssignment


class Phase8PermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            username="phase8-admin",
            password="StrongAdminPass!123",
            role=UserRole.ADMIN,
            status="active",
        )
        cls.school_user = User.objects.create_user(
            username="phase8-school",
            password="StrongSchoolPass!123",
            role=UserRole.SCHOOL,
            status="active",
        )
        cls.trainer_user = User.objects.create_user(
            username="phase8-trainer",
            password="StrongTrainerPass!123",
            role=UserRole.TRAINER,
            status="active",
        )
        cls.student_user = User.objects.create_user(
            username="phase8-student",
            password="StrongStudentPass!123",
            role=UserRole.STUDENT,
            status="active",
        )

    def authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_unauthenticated_cannot_read_v1_resource(self):
        response = self.client.get("/api/v1/schools")
        self.assertIn(response.status_code, {401, 403})

    def test_admin_can_create_school(self):
        self.authenticate(self.admin)
        response = self.client.post(
            "/api/v1/schools",
            {"school_id": "P8A", "name": "Phase Eight School"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["school_id"], "P8A")

    def test_school_user_cannot_create_school(self):
        self.authenticate(self.school_user)
        response = self.client.post(
            "/api/v1/schools",
            {"school_id": "P8B", "name": "Forbidden School"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_trainer_cannot_assign_trainer(self):
        school = School.objects.create(school_code="P8C", name="P8C School")
        trainer = Trainer.objects.create(trainer_id="P8T", name="P8 Trainer", account=self.trainer_user)
        self.authenticate(self.trainer_user)
        response = self.client.post(
            f"/api/v1/schools/{school.id}/assign-trainer",
            {"trainer_id": trainer.trainer_id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_trainer_can_read_own_trainer_record(self):
        Trainer.objects.create(trainer_id="P8T2", name="P8 Trainer 2", account=self.trainer_user)
        self.authenticate(self.trainer_user)
        response = self.client.get("/api/v1/trainers")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(item["trainer_id"] == "P8T2" for item in response.data))


class Phase8AuthenticationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="phase8-auth",
            password="StrongAuthPass!123",
            role=UserRole.ADMIN,
            status="active",
        )

    def test_login_refresh_me_logout_flow(self):
        login = self.client.post(
            "/api/v1/auth/login/",
            {"username": "phase8-auth", "password": "StrongAuthPass!123", "role": "admin"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["access"])
        self.assertTrue(login.data["refresh"])
        self.assertEqual(login.data["user"]["username"], "phase8-auth")

        refresh = login.data["refresh"]
        refreshed = self.client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(refreshed.status_code, 200)
        self.assertTrue(refreshed.data["access"])

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
        me = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["username"], "phase8-auth")

        logout = self.client.post("/api/v1/auth/logout/", {"refresh": refresh}, format="json")
        self.assertEqual(logout.status_code, 205)


class Phase8MigrationTests(SimpleTestCase):
    def test_required_phase7_tables_exist(self):
        required_tables = {
            "accounts_user",
            "academics_school",
            "academics_schoolclass",
            "academics_student",
            "academics_trainer",
            "learning_session",
            "billing_invoice",
            "notifications_notification",
            "crm_communicationlog",
        }
        with connection.cursor() as cursor:
            table_names = set(connection.introspection.table_names(cursor))
        missing = required_tables - table_names
        self.assertFalse(missing, f"Missing required migrated tables: {sorted(missing)}")
