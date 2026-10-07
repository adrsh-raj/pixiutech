from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone

from rest_framework.test import APIClient

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.services import accessible_assignment_queryset, accessible_trainer_queryset
from core.api_v1_compat import _legacy_student


class StudentPaginationRegressionTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="pagination-admin",
            password="TestAdmin123!",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        school_user = User.objects.create_user(
            username="PAG",
            password="SchoolPass123!",
            role=UserRole.SCHOOL,
        )
        school = School.objects.create(school_code="PAG", name="Pagination School", account=school_user)
        school_class = SchoolClass.objects.create(school=school, grade="6", section="A")
        for roll in range(1, 52):
            Student.objects.create(
                school_class=school_class,
                student_id=f"PAG6A {roll:02d}" if roll <= 50 else "PAG6A 99",
                roll_number=roll if roll <= 50 else 99,
                name=f"Student {roll}",
            )

    def test_exact_page_boundary_does_not_report_a_fake_next_page(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        first = client.get("/api/v1/students?limit=50&offset=0")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(len(first.data), 50)
        self.assertEqual(first.headers["X-Pixiu-Page-Has-Next"], "true")
        self.assertEqual(first.headers["X-Pixiu-Page-Next-Offset"], "50")

        second = client.get("/api/v1/students?limit=50&offset=50")
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(len(second.data), 1)
        self.assertEqual(second.headers["X-Pixiu-Page-Has-Next"], "false")
        self.assertNotIn("X-Pixiu-Page-Next-Offset", second.headers)


class LegacyStudentCompatibilityRegressionTests(TestCase):
    def test_legacy_student_serializer_does_not_reference_removed_level_field(self):
        school = School.objects.create(school_code="LEG", name="Legacy School")
        school_class = SchoolClass.objects.create(school=school, grade="7", section="A")
        student = Student.objects.create(
            school_class=school_class,
            roll_number=1,
            name="Legacy Student",
        )
        payload = _legacy_student(student)
        self.assertNotIn("current_level", payload)


class AssignmentScopeRegressionTests(TestCase):
    def setUp(self):
        school_user = User.objects.create_user(
            username="SCOPE-SCHOOL",
            password="SchoolPass123!",
            role=UserRole.SCHOOL,
        )
        self.school = School.objects.create(
            school_code="SCP",
            name="Scope School",
            account=school_user,
        )
        school_class = SchoolClass.objects.create(school=self.school, grade="8", section="A")

        self.trainer_user = User.objects.create_user(
            username="TR-SCOPE",
            password="TrainerPass123!",
            role=UserRole.TRAINER,
        )
        self.trainer = Trainer.objects.create(
            trainer_id="TR-SCOPE",
            name="Future Trainer",
            account=self.trainer_user,
        )
        self.student_user = User.objects.create_user(
            username="ST-SCOPE",
            password="StudentPass123!",
            role=UserRole.STUDENT,
        )
        Student.objects.create(
            school_class=school_class,
            roll_number=1,
            name="Scope Student",
            account=self.student_user,
        )
        future = timezone.localdate() + timedelta(days=2)
        self.assignment = TrainerSchoolAssignment.objects.create(
            trainer=self.trainer,
            school=self.school,
            assigned_from=future,
            status="active",
        )

        self.school_user = school_user

    def test_school_and_student_do_not_see_future_trainer_or_assignment(self):
        self.assertFalse(accessible_trainer_queryset(self.school_user).filter(pk=self.trainer.pk).exists())
        self.assertFalse(accessible_assignment_queryset(self.school_user).filter(pk=self.assignment.pk).exists())
        self.assertFalse(accessible_trainer_queryset(self.student_user).filter(pk=self.trainer.pk).exists())
        self.assertFalse(accessible_assignment_queryset(self.student_user).filter(pk=self.assignment.pk).exists())
