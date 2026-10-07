from datetime import date

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory

from accounts.credentials import build_student_username
from accounts.models import User, UserRole

from .models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from .serializers import SchoolClassSerializer, StudentCreateSerializer
from .services import provision_student


class Phase3ModelTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin-phase3", password="TestAdmin123!", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user(username="xyz", password="SchoolPass123!", role=UserRole.SCHOOL)
        self.trainer_user = User.objects.create_user(username="TR-001", password="TrainerPass123!", role=UserRole.TRAINER)

        self.school = School.objects.create(school_code="xyz", name="XYZ Academy", account=self.school_user)
        self.trainer = Trainer.objects.create(trainer_id="tr-001", name="Test Trainer", account=self.trainer_user)
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date(2026, 1, 1))
        self.school_class = SchoolClass.objects.create(school=self.school, grade="8", section="a")

    def test_uppercase_ids_are_generated_exactly(self):
        username = build_student_username("xyz", "8", "a", 3)
        self.assertEqual(username, "XYZ8A 03")

    def test_duplicate_active_trainer_school_assignment_is_blocked(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date(2026, 2, 1))

    def test_duplicate_roll_in_class_is_blocked(self):
        Student.objects.create(student_id="XYZ8A 01", school_class=self.school_class, roll_number=1, name="First Student")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Student.objects.create(student_id="XYZ8A 99", school_class=self.school_class, roll_number=1, name="Second Student")

    def test_student_provisioning_creates_hashed_account_and_one_time_password(self):
        student = Student.objects.create(school_class=self.school_class, roll_number=3, name="Test Student")
        provisioned, password = provision_student(student=student)
        self.assertEqual(provisioned.student_id, "XYZ8A 03")
        self.assertEqual(provisioned.account.username, "XYZ8A 03")
        self.assertTrue(password)
        self.assertTrue(provisioned.account.check_password(password))
        self.assertTrue(provisioned.account.password.startswith("pbkdf2_"))
        self.assertTrue(provisioned.account.must_change_password)

    def test_student_provisioning_rolls_back_orphan_account_on_profile_failure(self):
        student = Student.objects.create(school_class=self.school_class, roll_number=4, name="Rollback Student")
        original_save = Student.save
        calls = {"count": 0}

        def failing_save(instance, *args, **kwargs):
            calls["count"] += 1
            if calls["count"] >= 2:
                raise RuntimeError("forced rollback")
            return original_save(instance, *args, **kwargs)

        Student.save = failing_save
        try:
            with self.assertRaises(RuntimeError):
                provision_student(student=student)
        finally:
            Student.save = original_save

        self.assertFalse(User.objects.filter(username="XYZ8A 04").exists())


class Phase3ScopeAndValidationTests(TestCase):
    def setUp(self):
        self.school_a_user = User.objects.create_user(username="AAA", password="SchoolPass123!", role=UserRole.SCHOOL)
        self.school_b_user = User.objects.create_user(username="BBB", password="SchoolPass123!", role=UserRole.SCHOOL)
        self.school_a = School.objects.create(school_code="AAA", name="School A", account=self.school_a_user)
        self.school_b = School.objects.create(school_code="BBB", name="School B", account=self.school_b_user)
        self.class_a = SchoolClass.objects.create(school=self.school_a, grade="8", section="A")
        self.class_b = SchoolClass.objects.create(school=self.school_b, grade="8", section="A")

    def _request_with_user(self, method="post", path="/"):
        request = getattr(APIRequestFactory(), method)(path)
        request.user = self.school_a_user
        return request

    def test_school_cannot_create_class_in_another_school(self):
        request = self._request_with_user(path="/api/academics/classes/")
        serializer = SchoolClassSerializer(
            data={"school": str(self.school_b.id), "grade": "9", "section": "B"},
            context={"request": request},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("own classes", str(serializer.errors).lower())

    def test_school_cannot_create_student_in_another_school(self):
        request = self._request_with_user(path="/api/academics/students/")
        serializer = StudentCreateSerializer(
            data={"school_class": str(self.class_b.id), "roll_number": 1, "name": "Blocked"},
            context={"request": request},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("cannot create a student", str(serializer.errors).lower())

    def test_school_cannot_retrieve_another_school(self):
        client = APIClient()
        client.force_authenticate(user=self.school_a_user)
        response = client.get(f"/api/academics/schools/{self.school_b.id}/")
        self.assertEqual(response.status_code, 403)

    def test_school_list_is_scope_filtered(self):
        client = APIClient()
        client.force_authenticate(user=self.school_a_user)
        response = client.get("/api/academics/schools/")
        self.assertEqual(response.status_code, 200)
        returned_ids = {item["id"] for item in response.data}
        self.assertEqual(returned_ids, {str(self.school_a.id)})

    def test_class_with_students_cannot_change_identity_fields(self):
        Student.objects.create(student_id="AAA8A 01", school_class=self.class_a, roll_number=1, name="Locked")
        request = self._request_with_user(method="patch", path=f"/api/academics/classes/{self.class_a.id}/")
        serializer = SchoolClassSerializer(
            self.class_a,
            data={"school": str(self.school_a.id), "grade": "9", "section": "B"},
            partial=True,
            context={"request": request},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("student ids", str(serializer.errors).lower())


class SchoolOnboardingApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="school-onboard-admin",
            password="AdminPass123!",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _payload(self, code="XYZ"):
        return {
            "school_code": code,
            "name": "XYZ Academy",
            "principal_name": "MR. Anand Rathi",
            "phone": "9876543210",
            "email": "principal@example.com",
            "lab_name": "AI Lab",
            "lab_location": "First Floor",
            "address": "Test Road",
        }

    def test_school_onboarding_creates_profile_and_managed_login(self):
        response = self.client.post("/api/v1/schools", self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        school = School.objects.get(school_code="XYZ")
        self.assertIsNotNone(school.account_id)
        self.assertEqual(school.account.username, "XYZ")
        self.assertEqual(school.account.role, UserRole.SCHOOL)
        self.assertFalse(school.account.is_active)
        self.assertEqual(response.data["school_code"], "XYZ")

    def test_orphan_school_username_is_reused_instead_of_returning_500(self):
        orphan = User.objects.create_user("XYZ", "ignored-password", role=UserRole.SCHOOL)
        self.assertFalse(School.objects.filter(account_id=orphan.pk).exists())
        response = self.client.post("/api/v1/schools", self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        school = School.objects.get(school_code="XYZ")
        self.assertEqual(school.account_id, orphan.id)

    def test_school_code_collision_with_other_role_is_validation_error(self):
        User.objects.create_user("XYZ", "ignored-password", role=UserRole.TRAINER)
        response = self.client.post("/api/v1/schools", self._payload(), format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("school_code", response.data.get("fields", response.data))

    def test_cross_scope_retrieve_uses_scoped_queryset(self):
        school_a = School.objects.create(school_code="AAA", name="School A")
        school_b = School.objects.create(school_code="BBB", name="School B")
        school_user = User.objects.create_user("AAA", "SchoolPass123!", role=UserRole.SCHOOL)
        school_a.account = school_user
        school_a.save(update_fields=["account", "updated_at"])
        self.client.force_authenticate(user=school_user)
        response = self.client.get(f"/api/v1/schools/{school_b.pk}")
        self.assertEqual(response.status_code, 404)
