from datetime import date, time

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from learning.models import (
    ContentClassAssignment,
    CurriculumClassAssignment,
    CurriculumUnit,
    LearningContent,
    Quiz,
    QuizClassAssignment,
    QuizQuestion,
    Session,
)


User = get_user_model()


class LearningBoundaryTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin-test", password="pass1234", role="admin", display_name="Admin"
        )
        self.trainer_user = User.objects.create_user(
            username="trainer-a", password="pass1234", role="trainer", display_name="Trainer A"
        )
        self.student_a_user = User.objects.create_user(
            username="student-a", password="pass1234", role="student", display_name="Student A"
        )
        self.student_b_user = User.objects.create_user(
            username="student-b", password="pass1234", role="student", display_name="Student B"
        )

        self.school_a = School.objects.create(school_code="SCA", name="School A")
        self.school_b = School.objects.create(school_code="SCB", name="School B")
        self.school_a.account = User.objects.create_user(
            username="school-a", password="pass1234", role="school", display_name="School A"
        )
        self.school_a.save(update_fields=["account", "updated_at"])
        self.school_b.account = User.objects.create_user(
            username="school-b", password="pass1234", role="school", display_name="School B"
        )
        self.school_b.save(update_fields=["account", "updated_at"])

        self.class_a = SchoolClass.objects.create(school=self.school_a, grade="7", section="A")
        self.class_b = SchoolClass.objects.create(school=self.school_b, grade="7", section="A")
        self.student_a = Student.objects.create(
            account=self.student_a_user,
            school_class=self.class_a,
            student_id="SCA7A01",
            roll_number=1,
            name="Student A",
        )
        self.student_b = Student.objects.create(
            account=self.student_b_user,
            school_class=self.class_b,
            student_id="SCB7A01",
            roll_number=1,
            name="Student B",
        )

        self.trainer = Trainer.objects.create(
            account=self.trainer_user,
            trainer_id="TR-901",
            name="Trainer A",
        )
        TrainerSchoolAssignment.objects.create(
            trainer=self.trainer,
            school=self.school_a,
            assigned_from=date.today(),
            status="active",
        )

        self.unit_a = CurriculumUnit.objects.create(
            grade="7", level="Level 1", unit_code="U1", title="A Unit 1",
            week="Unit 1", topic="A Topic", objectives="A objectives", status="published", created_by=self.admin,
        )
        self.unit_b = CurriculumUnit.objects.create(
            grade="7", level="Level 1", unit_code="U2", title="B Unit 2",
            week="Unit 2", topic="B Topic", objectives="B objectives", status="published", created_by=self.admin,
        )
        CurriculumClassAssignment.objects.create(
            curriculum_unit=self.unit_a, school_class=self.class_a, assigned_by=self.admin
        )
        CurriculumClassAssignment.objects.create(
            curriculum_unit=self.unit_b, school_class=self.class_b, assigned_by=self.admin
        )

        self.content_a = LearningContent.objects.create(
            title="A Video", content_type="video", grade="7", level="Level 1", unit_code="U1",
            url="https://example.com/a.mp4", target_role="student", status="published", created_by=self.admin,
        )
        self.content_b = LearningContent.objects.create(
            title="B Video", content_type="video", grade="7", level="Level 1", unit_code="U2",
            url="https://example.com/b.mp4", target_role="student", status="published", created_by=self.admin,
        )
        ContentClassAssignment.objects.create(content=self.content_a, school_class=self.class_a, assigned_by=self.admin)
        ContentClassAssignment.objects.create(content=self.content_b, school_class=self.class_b, assigned_by=self.admin)

        self.quiz_a = Quiz.objects.create(
            title="A Quiz", grade="7", level="Level 1", unit_code="U1", status="active", created_by=self.admin
        )
        self.quiz_b = Quiz.objects.create(
            title="B Quiz", grade="7", level="Level 1", unit_code="U2", status="active", created_by=self.admin
        )
        for quiz in (self.quiz_a, self.quiz_b):
            QuizQuestion.objects.create(
                quiz=quiz, question_order=1, question_text="Question",
                option_a="A", option_b="B", option_c="C", option_d="D",
                correct_option="A", points=1,
            )
        QuizClassAssignment.objects.create(quiz=self.quiz_a, school_class=self.class_a, assigned_by=self.admin)
        QuizClassAssignment.objects.create(quiz=self.quiz_b, school_class=self.class_b, assigned_by=self.admin)

        self.session_a = Session.objects.create(
            school_class=self.class_a, curriculum_unit=self.unit_a, trainer=self.trainer,
            date=date.today(), start_time=time(10, 0), end_time=time(11, 0), topic="A Topic",
            status="planned", created_by=self.admin,
        )
        self.session_b = Session.objects.create(
            school_class=self.class_b, curriculum_unit=self.unit_b, trainer=self.trainer,
            date=date.today(), start_time=time(12, 0), end_time=time(13, 0), topic="B Topic",
            status="planned", created_by=self.admin,
        )

    def test_student_cannot_see_other_school_learning_resources(self):
        self.client.force_authenticate(self.student_a_user)

        content_response = self.client.get(reverse("v1-content-list"))
        self.assertEqual(content_response.status_code, 200)
        self.assertEqual({row["id"] for row in content_response.data}, {str(self.content_a.id)})

        quiz_response = self.client.get(reverse("v1-quiz-list"))
        self.assertEqual(quiz_response.status_code, 200)
        self.assertEqual({row["id"] for row in quiz_response.data}, {str(self.quiz_a.id)})

        session_response = self.client.get(reverse("v1-session-list"))
        self.assertEqual(session_response.status_code, 200)
        self.assertEqual({row["id"] for row in session_response.data}, {str(self.session_a.id)})

    def test_trainer_cannot_see_other_school_learning_classes_or_students(self):
        self.client.force_authenticate(self.trainer_user)

        class_response = self.client.get(reverse("v1-class-list"))
        self.assertEqual(class_response.status_code, 200)
        self.assertEqual({row["id"] for row in class_response.data}, {str(self.class_a.id)})

        student_response = self.client.get(reverse("v1-student-list"))
        self.assertEqual(student_response.status_code, 200)
        self.assertEqual({row["id"] for row in student_response.data}, {str(self.student_a.id)})

        quiz_response = self.client.get(reverse("v1-quiz-list"))
        self.assertEqual(quiz_response.status_code, 200)
        self.assertEqual({row["id"] for row in quiz_response.data}, {str(self.quiz_a.id)})

        session_response = self.client.get(reverse("v1-session-list"))
        self.assertEqual(session_response.status_code, 200)
        self.assertEqual({row["id"] for row in session_response.data}, {str(self.session_a.id)})

    def test_direct_session_creation_persists_real_curriculum_fk(self):
        self.client.force_authenticate(self.trainer_user)
        response = self.client.post(
            reverse("v1-session-list"),
            {
                "school_class": str(self.class_a.id),
                "trainer": str(self.trainer.id),
                "curriculum_unit": str(self.unit_a.id),
                "date": date.today().isoformat(),
                "start_time": "14:00",
                "end_time": "15:00",
                "topic": "Canonical session",
                "notes": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        created = Session.objects.get(pk=response.data["id"])
        self.assertEqual(created.school_class_id, self.class_a.id)
        self.assertEqual(created.curriculum_unit_id, self.unit_a.id)
        self.assertEqual(response.data["curriculum_unit"], str(self.unit_a.id))

    def test_curriculum_level_is_manual(self):
        self.client.force_authenticate(self.trainer_user)
        response = self.client.post(
            reverse("v1-curriculum-list"),
            {
                "grade": "7",
                "week": "Unit 3",
                "unit_code": "U3",
                "title": "Unit 3",
                "topic": "Topic 3",
                "objectives": "Objective 3",
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("level", response.data)
