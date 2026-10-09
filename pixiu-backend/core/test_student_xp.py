from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student
from learning.models import Project


class StudentXpApiTests(TestCase):
    def setUp(self):
        self.student_user = User.objects.create_user(
            "xp-student",
            "StrongStudentPass!123",
            role=UserRole.STUDENT,
        )
        school = School.objects.create(school_code="XPTEST", name="XP Test School")
        school_class = SchoolClass.objects.create(school=school, grade="8", section="A")
        self.student = Student.objects.create(
            account=self.student_user,
            student_id="XPTEST8A01",
            school_class=school_class,
            roll_number=1,
            name="XP Student",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.student_user)

    def test_xp_events_are_persisted_and_returned_for_the_student(self):
        events = [
            {
                "id": "mission:test-110-a",
                "category": "mission",
                "title": "Completed test mission A",
                "xp": 110,
            },
            {
                "id": "mission:test-110-b",
                "category": "mission",
                "title": "Completed test mission B",
                "xp": 110,
            },
        ]
        post_response = self.client.post(
            "/api/v1/student-xp",
            {"events": events},
            format="json",
        )
        self.assertEqual(post_response.status_code, 200)
        self.assertEqual(post_response.data["total_xp"], 220)

        ledger_project = Project.objects.get(student=self.student, title="__pixiu_xp_ledger__")
        self.assertEqual(ledger_project.score, 220)

        get_response = self.client.get("/api/v1/student-xp")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(len(get_response.data["ledger"]["events"]), 2)
        self.assertEqual(
            {event["id"] for event in get_response.data["ledger"]["events"]},
            {event["id"] for event in events},
        )
