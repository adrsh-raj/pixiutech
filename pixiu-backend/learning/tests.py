from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.services import provision_student

from .models import Quiz, QuizQuestion, QuizClassAssignment, Session, AttendanceRecord, CurriculumUnit, CurriculumClassAssignment, LearningContent, ContentClassAssignment, Project, ProjectEvidence, StudentAssessment
from .services import grade_attempt
from .views import QuizViewSet


class Phase4DomainTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin-test", "admin-pass", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("ZPS", "school-pass", role=UserRole.SCHOOL)
        self.trainer_user = User.objects.create_user("TR-001", "trainer-pass", role=UserRole.TRAINER)
        self.school = School.objects.create(school_code="ZPS", name="Zenith Public School", account=self.school_user)
        self.trainer = Trainer.objects.create(trainer_id="TR-001", name="Trainer One", account=self.trainer_user)
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date(2026, 1, 1))
        self.cls = SchoolClass.objects.create(school=self.school, grade="8", section="A")
        self.student = Student.objects.create(school_class=self.cls, roll_number=3, name="Student One")
        self.student, self.student_password = provision_student(student=self.student)

    def test_session_and_attendance_are_class_bound(self):
        session = Session.objects.create(school_class=self.cls, trainer=self.trainer, date=date(2026, 9, 7), start_time=time(10, 0), topic="Arduino", created_by=self.trainer_user)
        request = APIRequestFactory().post("/api/learning/attendance/")
        force_authenticate(request, user=self.trainer_user)
        from .serializers import AttendanceRecordSerializer
        serializer = AttendanceRecordSerializer(data={"session": str(session.id), "student": str(self.student.id), "status": "present"}, context={"request": request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        record = serializer.save()
        self.assertEqual(record.student_id, self.student.id)
        self.assertEqual(AttendanceRecord.objects.filter(session=session, student=self.student).count(), 1)

    def test_curriculum_and_content_can_be_assigned_to_specific_class(self):
        unit = CurriculumUnit.objects.create(grade="8", level="Level 1", unit_code="UNIT 2", title="Arduino", objectives="Build circuits", created_by=self.admin)
        CurriculumClassAssignment.objects.create(curriculum_unit=unit, school_class=self.cls, assigned_by=self.admin)
        content = LearningContent.objects.create(title="Arduino PDF", grade="8", level="Level 1", unit_code="UNIT 2", created_by=self.admin, status="published")
        ContentClassAssignment.objects.create(content=content, school_class=self.cls, assigned_by=self.admin)
        self.assertEqual(unit.class_assignments.count(), 1)
        self.assertEqual(content.class_assignments.count(), 1)

    def test_quiz_never_exposes_answer_to_student_and_server_grades(self):
        quiz = Quiz.objects.create(title="Arduino MCQ", grade="8", level="Level 1", duration_minutes=10, max_attempts=2, status="active", created_by=self.admin)
        QuizClassAssignment.objects.create(quiz=quiz, school_class=self.cls, assigned_by=self.admin)
        q = QuizQuestion.objects.create(quiz=quiz, question_order=1, question_text="Arduino brain?", option_a="UNO", option_b="LED", option_c="Resistor", option_d="Wire", correct_option="A", points=2)
        attempt = grade_attempt(quiz=quiz, student=self.student, answers={str(q.id): "A"})
        self.assertEqual(attempt.score, Decimal("2"))
        self.assertEqual(attempt.percentage, Decimal("100.00"))

        factory = APIRequestFactory().get(f"/api/learning/quizzes/{quiz.id}/")
        force_authenticate(factory, user=self.student.account)
        response = QuizViewSet.as_view({"get": "retrieve"})(factory, pk=str(quiz.id))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("correct_option", str(response.data))
        self.assertNotIn("explanation", str(response.data))

    def test_quiz_attempt_limit_is_enforced(self):
        quiz = Quiz.objects.create(title="Retry Test", grade="8", level="Level 1", max_attempts=1, status="active", created_by=self.admin)
        QuizClassAssignment.objects.create(quiz=quiz, school_class=self.cls, assigned_by=self.admin)
        q = QuizQuestion.objects.create(quiz=quiz, question_order=1, question_text="Q", option_a="A", option_b="B", option_c="C", option_d="D", correct_option="A", points=1)
        grade_attempt(quiz=quiz, student=self.student, answers={str(q.id): "B"})
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            grade_attempt(quiz=quiz, student=self.student, answers={str(q.id): "A"})

    def test_project_evidence_is_relational(self):
        project = Project.objects.create(student=self.student, title="Smart Dustbin")
        evidence = ProjectEvidence.objects.create(project=project, title="Prototype", note="Working", uploaded_by=self.trainer_user)
        self.assertEqual(evidence.project.student_id, self.student.id)

    def test_assessment_is_trainer_and_student_bound(self):
        assessment = StudentAssessment.objects.create(student=self.student, trainer=self.trainer, assessment_date=date(2026, 9, 7), score=85, rating=4.5, feedback="Good")
        self.assertEqual(assessment.student.school_class_id, self.cls.id)
        self.assertEqual(assessment.trainer_id, self.trainer.id)
