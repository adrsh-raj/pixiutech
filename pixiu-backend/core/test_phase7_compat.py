from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.services import provision_student
from audit.models import AuditLog
from learning.models import AttendanceRecord, Session

from .phase7_compat_fixes import (
    LegacyAttendanceCompatViewSet,
    LegacyClassCompatViewSet,
    LegacySchoolCompatViewSet,
    LegacySessionCompatViewSet,
    LegacyStudentCompatViewSet,
    LegacyTrainerCompatViewSet,
)


class LegacyApiCompatibilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create_user("admin-compat", "admin-pass", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("ZPS", "school-pass", role=UserRole.SCHOOL)
        self.trainer_user = User.objects.create_user("TR-001", "trainer-pass", role=UserRole.TRAINER)
        self.school = School.objects.create(
            school_code="ZPS",
            name="Zenith Public School",
            principal_name="Principal One",
            phone="9999999999",
            email="principal@zps.example",
            account=self.school_user,
        )
        self.trainer = Trainer.objects.create(
            trainer_id="TR-001",
            name="Trainer One",
            email="trainer@pixiu.example",
            phone="8888888888",
            qualification="B.Tech",
            specialization="Robotics",
            daily_rate=1500,
            weekly_days=5,
            monthly_compensation=30000,
            rating=4.5,
            account=self.trainer_user,
        )
        TrainerSchoolAssignment.objects.create(
            trainer=self.trainer,
            school=self.school,
            assigned_from=date(2026, 1, 1),
            status="active",
        )
        self.school_class = SchoolClass.objects.create(school=self.school, grade="8", section="A")
        self.student = Student.objects.create(school_class=self.school_class, roll_number=3, name="Student One")
        self.student, _ = provision_student(student=self.student)
        self.session = Session.objects.create(
            school_class=self.school_class,
            trainer=self.trainer,
            date=date(2026, 9, 7),
            start_time=time(10, 0),
            topic="Arduino",
            created_by=self.trainer_user,
        )

    def test_legacy_output_restores_portal_fields(self):
        school_payload = LegacySchoolCompatViewSet().map_out(self.school)
        trainer_payload = LegacyTrainerCompatViewSet().map_out(self.trainer)
        class_payload = LegacyClassCompatViewSet().map_out(self.school_class)
        student_payload = LegacyStudentCompatViewSet().map_out(self.student)
        session_payload = LegacySessionCompatViewSet().map_out(self.session)

        self.assertEqual(school_payload["school_id"], "ZPS")
        self.assertEqual(school_payload["principal"], "Principal One")
        self.assertIn("account_username", school_payload)

        self.assertEqual(trainer_payload["trainer_id"], "TR-001")
        self.assertEqual(trainer_payload["assigned_schools"], ["ZPS"])
        self.assertEqual(trainer_payload["qualification"], "B.Tech")

        self.assertEqual(class_payload["class_id"], "CLS-ZPS-8A")
        self.assertEqual(class_payload["school_id"], "ZPS")

        self.assertEqual(student_payload["student_id"], self.student.student_id)
        self.assertEqual(student_payload["class_id"], "CLS-ZPS-8A")
        self.assertEqual(student_payload["school_id"], "ZPS")
        self.assertIn("roll_number", student_payload)

        self.assertEqual(session_payload["school_id"], "ZPS")
        self.assertEqual(session_payload["class_id"], "CLS-ZPS-8A")
        self.assertEqual(session_payload["trainer_id"], "TR-001")

    def test_legacy_input_accepts_old_aliases(self):
        school = LegacySchoolCompatViewSet().map_in({
            "id": "ABC",
            "name": "Alpha School",
            "principal": "Principal Two",
            "contact": "7777777777",
            "status": "Active",
        })
        trainer = LegacyTrainerCompatViewSet().map_in({
            "id": "TR-009",
            "name": "Trainer Nine",
            "status": "Active",
        })
        school_class = LegacyClassCompatViewSet().map_in({
            "school_id": "ZPS",
            "class_grade": "8",
            "section": "A",
            "status": "Active",
        })

        self.assertEqual(school["school_code"], "ABC")
        self.assertEqual(school["principal_name"], "Principal Two")
        self.assertEqual(school["phone"], "7777777777")
        self.assertEqual(school["status"], "active")
        self.assertEqual(trainer["trainer_id"], "TR-009")
        self.assertEqual(trainer["status"], "active")
        self.assertEqual(school_class["school"], str(self.school.pk))
        self.assertEqual(school_class["grade"], "8")
        self.assertEqual(school_class["status"], "active")

    def test_admin_attendance_override_uses_audited_service(self):
        record = AttendanceRecord.objects.create(
            session=self.session,
            student=self.student,
            status="present",
            marked_by=self.trainer_user,
        )
        request = self.factory.put(
            f"/api/v1/attendance/admin-override",
            {
                "session_id": str(self.session.pk),
                "student_id": self.student.student_id,
                "status": "absent",
                "note": "Correction",
            },
            format="json",
        )
        force_authenticate(request, user=self.admin)
        response = LegacyAttendanceCompatViewSet.as_view({"put": "admin_override"})(request)

        self.assertEqual(response.status_code, 200, response.data)
        record.refresh_from_db()
        self.assertEqual(record.status, "absent")
        self.assertTrue(AuditLog.objects.filter(entity_type="AttendanceRecord", entity_id=record.id).exists())
