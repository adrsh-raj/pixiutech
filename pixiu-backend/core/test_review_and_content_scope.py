from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from learning.models import ContentClassAssignment, LearningContent, StudentAssessment

User = get_user_model()


class ReviewAndContentScopeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin-scope", password="pass", role="admin", display_name="Admin")
        self.trainer_user = User.objects.create_user(username="trainer-scope", password="pass", role="trainer", display_name="Trainer")
        self.student_user = User.objects.create_user(username="student-scope", password="pass", role="student", display_name="Student")
        self.school_a = School.objects.create(school_code="SCOPEA", name="Scope School A")
        self.school_b = School.objects.create(school_code="SCOPEB", name="Scope School B")
        self.class_a = SchoolClass.objects.create(school=self.school_a, grade="7", section="A")
        self.class_b = SchoolClass.objects.create(school=self.school_b, grade="7", section="A")
        self.student = Student.objects.create(account=self.student_user, school_class=self.class_a, student_id="SCOPEA7A01", roll_number=1, name="Student")
        self.trainer = Trainer.objects.create(account=self.trainer_user, trainer_id="TR-SCOPE", name="Trainer")
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school_a, assigned_from=date.today(), status="active")

    def test_trainer_can_create_assessment_for_scoped_student(self):
        self.client.force_authenticate(self.trainer_user)
        response = self.client.post(
            reverse("v1-assessment-list"),
            {
                "student": str(self.student.id),
                "title": "Unit review",
                "unit_code": "U1",
                "level": "Level 1",
                "score": 80,
                "rating": 4,
                "status": "published",
                "feedback": "Good progress",
                "assessment_date": date.today().isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        assessment = StudentAssessment.objects.get(pk=response.data["id"])
        self.assertEqual(assessment.student_id, self.student.id)
        self.assertEqual(assessment.trainer_id, self.trainer.id)

    def test_admin_content_is_scoped_to_selected_school_and_grade(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("v1-content-list"),
            {
                "title": "Scope material",
                "content_type": "link",
                "school": str(self.school_a.id),
                "grade": "7",
                "level": "Level 1",
                "unit_code": "U1",
                "url": "https://example.com/scope",
                "target_role": "student",
                "status": "published",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        content = LearningContent.objects.get(pk=response.data["id"])
        self.assertEqual(list(content.class_assignments.values_list("school_class_id", flat=True)), [self.class_a.id])
        self.assertEqual(ContentClassAssignment.objects.filter(content=content, school_class=self.class_b).count(), 0)

    def test_trainer_cannot_target_unassigned_school(self):
        self.client.force_authenticate(self.trainer_user)
        response = self.client.post(
            reverse("v1-content-list"),
            {
                "title": "Blocked material",
                "content_type": "link",
                "school": str(self.school_b.id),
                "grade": "7",
                "url": "https://example.com/blocked",
                "target_role": "student",
                "status": "published",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("school", response.data.get("fields", {}))
