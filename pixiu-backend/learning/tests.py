from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.services import provision_student

from .models import AttendanceRecord, CurriculumClassAssignment, CurriculumUnit, LearningContent, Project, ProjectEvidence, Quiz, QuizClassAssignment, QuizQuestion, Session, StudentAssessment
from .serializers import AttendanceRecordSerializer, ContentClassAssignmentSerializer, CurriculumClassAssignmentSerializer, LearningContentSerializer, ProjectSerializer, QuizClassAssignmentSerializer
from .services import accessible_quizzes, grade_attempt
from .views import AttendanceViewSet, CurriculumAssignmentViewSet, ProjectViewSet, QuizViewSet, SessionViewSet


class Phase4DomainTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create_user("admin-test", "admin-pass", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("ZPS", "school-pass", role=UserRole.SCHOOL)
        self.trainer_user = User.objects.create_user("TR-001", "trainer-pass", role=UserRole.TRAINER)
        self.school = School.objects.create(school_code="ZPS", name="Zenith Public School", account=self.school_user)
        self.trainer = Trainer.objects.create(trainer_id="TR-001", name="Trainer One", account=self.trainer_user)
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date(2026, 1, 1))
        self.cls = SchoolClass.objects.create(school=self.school, grade="8", section="A")
        self.student = Student.objects.create(school_class=self.cls, roll_number=3, name="Student One")
        self.student, self.student_password = provision_student(student=self.student)

    def request(self, method, path, user, data=None):
        req = getattr(self.factory, method)(path, data=data or {}, format="json")
        force_authenticate(req, user=user)
        req.user = user
        return req

    def test_session_and_attendance_are_class_bound(self):
        session = Session.objects.create(school_class=self.cls, trainer=self.trainer, date=date(2026, 9, 7), start_time=time(10, 0), topic="Arduino", created_by=self.trainer_user)
        request = self.request("post", "/api/learning/attendance/", self.trainer_user)
        serializer = AttendanceRecordSerializer(data={"session": str(session.id), "student": str(self.student.id), "status": "present"}, context={"request": request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        record = serializer.save()
        self.assertEqual(record.student_id, self.student.id)
        self.assertEqual(AttendanceRecord.objects.filter(session=session, student=self.student).count(), 1)

    def test_attendance_update_cannot_bypass_locked_session(self):
        session = Session.objects.create(school_class=self.cls, trainer=self.trainer, date=date(2026, 9, 7), start_time=time(10, 0), topic="Arduino", created_by=self.trainer_user)
        record = AttendanceRecord.objects.create(session=session, student=self.student, status="present", marked_by=self.trainer_user)
        session.status = "completed"
        session.is_locked = True
        session.save(update_fields=["status", "is_locked", "updated_at"])
        request = self.request("patch", f"/api/learning/attendance/{record.id}/", self.trainer_user, {"status": "absent"})
        serializer = AttendanceRecordSerializer(record, data={"status": "absent"}, partial=True, context={"request": request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError): serializer.save()
        record.refresh_from_db()
        self.assertEqual(record.status, "present")

    def test_student_cannot_mark_attendance(self):
        session = Session.objects.create(school_class=self.cls, trainer=self.trainer, date=date(2026, 9, 7), start_time=time(10, 0), topic="Arduino", created_by=self.trainer_user)
        request = self.request("post", "/api/learning/attendance/", self.student.account, {"session": str(session.id), "student": str(self.student.id), "status": "present"})
        response = AttendanceViewSet.as_view({"post": "create"})(request)
        self.assertEqual(response.status_code, 403)

    def test_curriculum_content_and_quiz_assignments_match_grade(self):
        unit = CurriculumUnit.objects.create(grade="8", level="Level 1", unit_code="UNIT 2", title="Arduino", objectives="Build circuits", created_by=self.admin)
        assignment_data = {"curriculum_unit": str(unit.id), "school_class": str(self.cls.id)}
        req = self.request("post", "/api/learning/curriculum-assignments/", self.admin, assignment_data)
        serializer = CurriculumClassAssignmentSerializer(data=assignment_data, context={"request": req})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        assignment = serializer.save()
        self.assertEqual(assignment.school_class_id, self.cls.id)
        content = LearningContent.objects.create(title="Arduino PDF", grade="8", level="Level 1", unit_code="UNIT 2", created_by=self.admin, status="published", url="https://example.com/arduino.pdf")
        content_req = self.request("post", "/api/learning/content-assignments/", self.admin)
        content_serializer = ContentClassAssignmentSerializer(data={"content": str(content.id), "school_class": str(self.cls.id)}, context={"request": content_req})
        self.assertTrue(content_serializer.is_valid(), content_serializer.errors)
        self.assertEqual(content_serializer.save().content_id, content.id)
        quiz = Quiz.objects.create(title="Arduino MCQ", grade="8", level="Level 1", status="active", created_by=self.admin)
        quiz_req = self.request("post", "/api/learning/quiz-assignments/", self.admin)
        quiz_serializer = QuizClassAssignmentSerializer(data={"quiz": str(quiz.id), "school_class": str(self.cls.id)}, context={"request": quiz_req})
        self.assertTrue(quiz_serializer.is_valid(), quiz_serializer.errors)
        self.assertEqual(quiz_serializer.save().school_class_id, self.cls.id)

    def test_published_content_requires_source(self):
        req = self.request("post", "/api/learning/content/", self.admin)
        serializer = LearningContentSerializer(data={"title": "Missing source", "grade": "8", "status": "published", "content_type": "pdf"}, context={"request": req})
        self.assertFalse(serializer.is_valid())
        self.assertIn("Published content must have a URL or file.", str(serializer.errors))

    def test_quiz_never_exposes_answer_to_student_and_server_grades(self):
        quiz = Quiz.objects.create(title="Arduino MCQ", grade="8", level="Level 1", duration_minutes=10, max_attempts=2, status="active", created_by=self.admin)
        QuizClassAssignment.objects.create(quiz=quiz, school_class=self.cls, assigned_by=self.admin)
        q = QuizQuestion.objects.create(quiz=quiz, question_order=1, question_text="Arduino brain?", option_a="UNO", option_b="LED", option_c="Resistor", option_d="Wire", correct_option="A", points=2)
        attempt = grade_attempt(quiz=quiz, student=self.student, answers={str(q.id): "A"})
        self.assertEqual(attempt.score, Decimal("2"))
        self.assertEqual(attempt.percentage, Decimal("100.00"))
        request = self.request("get", f"/api/learning/quizzes/{quiz.id}/", self.student.account)
        response = QuizViewSet.as_view({"get": "retrieve"})(request, pk=str(quiz.id))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("correct_option", str(response.data))
        self.assertNotIn("explanation", str(response.data))

    def test_trainer_sees_owned_quiz_even_before_class_assignment(self):
        quiz = Quiz.objects.create(title="Trainer Draft Quiz", grade="8", level="Level 1", status="active", created_by=self.trainer_user)
        visible = accessible_quizzes(self.trainer_user).filter(pk=quiz.pk).exists()
        self.assertTrue(visible)

    def test_quiz_attempt_limit_is_enforced(self):
        quiz = Quiz.objects.create(title="Retry Test", grade="8", level="Level 1", max_attempts=1, status="active", created_by=self.admin)
        QuizClassAssignment.objects.create(quiz=quiz, school_class=self.cls, assigned_by=self.admin)
        q = QuizQuestion.objects.create(quiz=quiz, question_order=1, question_text="Q", option_a="A", option_b="B", option_c="C", option_d="D", correct_option="A", points=1)
        grade_attempt(quiz=quiz, student=self.student, answers={str(q.id): "B"})
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError): grade_attempt(quiz=quiz, student=self.student, answers={str(q.id): "A"})

    def test_quiz_rejects_answers_for_other_questions(self):
        quiz = Quiz.objects.create(title="Answer Scope", grade="8", level="Level 1", status="active", created_by=self.admin)
        QuizClassAssignment.objects.create(quiz=quiz, school_class=self.cls, assigned_by=self.admin)
        q = QuizQuestion.objects.create(quiz=quiz, question_order=1, question_text="Q", option_a="A", option_b="B", option_c="C", option_d="D", correct_option="A")
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError): grade_attempt(quiz=quiz, student=self.student, answers={str(q.id): "A", "not-a-question": "B"})

    def test_student_cannot_change_project_score_or_status(self):
        project = Project.objects.create(student=self.student, title="Smart Dustbin")
        request = self.request("patch", f"/api/learning/projects/{project.id}/", self.student.account, {"score": 100, "status": "completed"})
        serializer = ProjectSerializer(project, data={"score": 100, "status": "completed"}, partial=True, context={"request": request})
        self.assertFalse(serializer.is_valid())
        self.assertIn("Students cannot change evaluation fields.", str(serializer.errors))

    def test_student_can_submit_only_own_project(self):
        project = Project.objects.create(student=self.student, title="Smart Dustbin")
        request = self.request("post", f"/api/learning/projects/{project.id}/submit/", self.student.account)
        response = ProjectViewSet.as_view({"post": "submit"})(request, pk=str(project.id))
        self.assertEqual(response.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.status, "submitted")
        self.assertIsNotNone(project.submitted_at)

    def test_cross_school_assignment_detail_is_denied(self):
        other_school_user = User.objects.create_user("RPS", "school-pass", role=UserRole.SCHOOL)
        other_trainer_user = User.objects.create_user("TR-002", "trainer-pass", role=UserRole.TRAINER)
        other_school = School.objects.create(school_code="RPS", name="River Public School", account=other_school_user)
        other_trainer = Trainer.objects.create(trainer_id="TR-002", name="Trainer Two", account=other_trainer_user)
        TrainerSchoolAssignment.objects.create(trainer=other_trainer, school=other_school, assigned_from=date(2026, 1, 1))
        other_class = SchoolClass.objects.create(school=other_school, grade="8", section="A")
        unit = CurriculumUnit.objects.create(grade="8", level="Level 1", unit_code="UNIT 9", title="Robotics", objectives="Build", created_by=self.admin)
        assignment = CurriculumClassAssignment.objects.create(curriculum_unit=unit, school_class=self.cls, assigned_by=self.admin)
        request = self.request("get", f"/api/learning/curriculum-assignments/{assignment.id}/", other_trainer_user)
        response = CurriculumAssignmentViewSet.as_view({"get": "retrieve"})(request, pk=str(assignment.id))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(other_class.school_id, other_school.id)

    def test_session_completion_locks_attendance(self):
        session = Session.objects.create(school_class=self.cls, trainer=self.trainer, date=date(2026, 9, 7), start_time=time(10, 0), topic="Arduino", created_by=self.trainer_user)
        start_request = self.request("post", f"/api/learning/sessions/{session.id}/start/", self.trainer_user)
        start_response = SessionViewSet.as_view({"post": "start"})(start_request, pk=str(session.id))
        self.assertEqual(start_response.status_code, 200, start_response.data)
        request = self.request("post", f"/api/learning/sessions/{session.id}/complete/", self.trainer_user)
        response = SessionViewSet.as_view({"post": "complete"})(request, pk=str(session.id))
        self.assertEqual(response.status_code, 200)
        session.refresh_from_db()
        self.assertTrue(session.is_locked)
        self.assertEqual(session.status, "completed")

    def test_relational_records_preserve_source_of_truth(self):
        project = Project.objects.create(student=self.student, title="Smart Dustbin")
        evidence = ProjectEvidence.objects.create(project=project, title="Prototype", note="Working", uploaded_by=self.trainer_user)
        assessment = StudentAssessment.objects.create(student=self.student, trainer=self.trainer, assessment_date=date(2026, 9, 7), score=85, rating=4.5, feedback="Good")
        self.assertEqual(evidence.project.student_id, self.student.id)
        self.assertEqual(assessment.student.school_class_id, self.cls.id)
