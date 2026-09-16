from datetime import date

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.credentials import generate_student_temp_pin
from accounts.models import User, UserRole, UserStatus
from accounts.student_credential_views import StudentTemporaryPasswordResetView
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.services import accessible_student_queryset, provision_student, reset_student_to_temp_pin
from accounts.student_credentials import migrate_student_credentials


class StudentCredentialGenerationTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(school_code="P2SC", name="Phase 2 School", status="active")
        self.school_class = SchoolClass.objects.create(school=self.school, grade="8", section="A")
        self.student = Student.objects.create(school_class=self.school_class, roll_number=1, name="Student One", status="active")

    def test_temp_pin_is_eight_digits(self):
        pin = generate_student_temp_pin()
        self.assertEqual(len(pin), 8)
        self.assertTrue(pin.isdigit())

    def test_provision_student_uses_random_pin_and_sets_must_change(self):
        student, pin = provision_student(student=self.student)
        self.assertEqual(len(pin), 8)
        self.assertTrue(pin.isdigit())
        self.assertTrue(student.account.check_password(pin))
        self.assertTrue(student.account.must_change_password)
        self.assertNotEqual(pin, "P2SCP2sc8a1@hata")

    def test_reset_changes_pin_and_invalidates_old_password(self):
        student, old_pin = provision_student(student=self.student)
        new_pin = reset_student_to_temp_pin(student)
        self.assertNotEqual(old_pin, new_pin)
        self.assertFalse(student.account.check_password(old_pin))
        self.assertTrue(student.account.check_password(new_pin))
        self.assertTrue(student.account.must_change_password)

    def test_migration_provisions_unlinked_active_student(self):
        rows = migrate_student_credentials()
        self.student.refresh_from_db()
        self.assertEqual(len(rows), 1)
        self.assertIsNotNone(self.student.account_id)
        self.assertTrue(self.student.account.check_password(rows[0]["temporary_pin"]))
        self.assertTrue(self.student.account.must_change_password)


class StudentResetScopeTests(TestCase):
    def setUp(self):
        self.school_a = School.objects.create(school_code="SCHA", name="School A", status="active")
        self.school_b = School.objects.create(school_code="SCHB", name="School B", status="active")
        class_a = SchoolClass.objects.create(school=self.school_a, grade="8", section="A")
        class_b = SchoolClass.objects.create(school=self.school_b, grade="8", section="A")
        self.student_a, _ = provision_student(student=Student.objects.create(school_class=class_a, roll_number=1, name="A", status="active"))
        self.student_b, _ = provision_student(student=Student.objects.create(school_class=class_b, roll_number=1, name="B", status="active"))
        trainer = Trainer.objects.create(trainer_id="TR-P2", name="Trainer", status="active")
        self.trainer_user = User.objects.create_user(username="TR-P2", password="TrainerPassword!123", role=UserRole.TRAINER, status=UserStatus.ACTIVE, is_active=True)
        trainer.account = self.trainer_user
        trainer.save(update_fields=["account"])
        TrainerSchoolAssignment.objects.create(trainer=trainer, school=self.school_a, assigned_from=date.today(), status="active")

    def _post(self, student):
        request = APIRequestFactory().post(f"/api/v1/students/{student.id}/reset-password", {}, format="json")
        force_authenticate(request, user=self.trainer_user)
        return StudentTemporaryPasswordResetView.as_view()(request, pk=student.id)

    def test_trainer_can_reset_assigned_student(self):
        response = self._post(self.student_a)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["must_change_password"])
        self.assertEqual(len(response.data["temporary_pin"]), 8)

    def test_trainer_cannot_reset_other_school_student(self):
        response = self._post(self.student_b)
        self.assertEqual(response.status_code, 404)

    def test_student_queryset_is_own_account_only(self):
        self.assertEqual(list(accessible_student_queryset(self.student_a.account)), [self.student_a])
