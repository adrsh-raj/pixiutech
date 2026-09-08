from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.services import provision_student
from learning.models import Session

from .phase7_compat_fixes import (
    LegacySchoolCompatViewSet,
    LegacySessionCompatViewSet,
    LegacyTrainerCompatViewSet,
)


class LegacyApiActionCompatibilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create_user("admin-actions", "admin-pass", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("ACT", "school-pass", role=UserRole.SCHOOL)
        self.school = School.objects.create(school_code="ACT", name="Action Test School", account=self.school_user)
        self.trainer_user = User.objects.create_user("TR-101", "trainer-pass", role=UserRole.TRAINER)
        self.trainer = Trainer.objects.create(trainer_id="TR-101", name="Trainer 101", account=self.trainer_user)
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date(2026, 1, 1))
        self.cls = SchoolClass.objects.create(school=self.school, grade="8", section="A")
        self.student = Student.objects.create(school_class=self.cls, roll_number=1, name="Student One")
        self.student, _ = provision_student(student=self.student)
        self.session = Session.objects.create(
            school_class=self.cls,
            trainer=self.trainer,
            date=date(2026, 9, 8),
            start_time=time(10, 0),
            topic="Compatibility",
            created_by=self.trainer_user,
        )

    def test_school_assign_trainer_action_still_exists(self):
        request = self.factory.post(
            f"/api/v1/schools/{self.school.pk}/assign-trainer",
            {"trainer_id": self.trainer.trainer_id},
            format="json",
        )
        force_authenticate(request, user=self.admin)
        response = LegacySchoolCompatViewSet.as_view({"post": "assign_trainer"})(request, pk=str(self.school.pk))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["school_id"], "ACT")
        self.assertTrue(
            TrainerSchoolAssignment.objects.filter(
                trainer=self.trainer, school=self.school, status="active"
            ).exists()
        )

    def test_trainer_status_action_still_exists(self):
        request = self.factory.put(
            f"/api/v1/trainers/{self.trainer.pk}/status",
            {"status": "Inactive"},
            format="json",
        )
        force_authenticate(request, user=self.admin)
        response = LegacyTrainerCompatViewSet.as_view({"put": "status_change"})(request, pk=str(self.trainer.pk))
        self.assertEqual(response.status_code, 200, response.data)
        self.trainer.refresh_from_db()
        self.assertEqual(self.trainer.status, "inactive")
        self.assertEqual(response.data["status"], "Inactive")

    def test_session_unlock_legacy_put_is_preserved(self):
        self.session.is_locked = True
        self.session.save(update_fields=["is_locked", "updated_at"])
        request = self.factory.put(
            f"/api/v1/sessions/{self.session.pk}/unlock",
            {},
            format="json",
        )
        force_authenticate(request, user=self.admin)
        response = LegacySessionCompatViewSet.as_view({"put": "unlock"})(request, pk=str(self.session.pk))
        self.assertEqual(response.status_code, 200, response.data)
        self.session.refresh_from_db()
        self.assertFalse(self.session.is_locked)
