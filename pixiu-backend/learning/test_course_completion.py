from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from learning.course_completion_v3 import admin_complete, evaluate_last_session, issue_certificate, request_completion, summary
from learning.course_completion_models import Certificate, CompletionPolicy, CurriculumUnitProfile, ProgrammeCompletion, SessionWorkflow, Technology, UnitCompletion
from learning.models import AttendanceRecord, CurriculumClassAssignment, CurriculumUnit, Quiz, QuizClassAssignment, QuizQuestion, QuizAttempt, Session, StudentAssessment


class CourseCompletionWorkflowTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('cc-admin', 'admin-pass', role=UserRole.ADMIN, is_staff=True)
        self.trainer_user = User.objects.create_user('cc-trainer', 'trainer-pass', role=UserRole.TRAINER)
        self.school_user = User.objects.create_user('CCS', 'school-pass', role=UserRole.SCHOOL)
        self.school = School.objects.create(school_code='CCS', name='Completion School', account=self.school_user)
        self.trainer = Trainer.objects.create(trainer_id='CC-TR', name='Completion Trainer', account=self.trainer_user)
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date(2026, 1, 1))
        self.cls = SchoolClass.objects.create(school=self.school, grade='6', section='A')
        self.student = Student.objects.create(school_class=self.cls, roll_number=1, name='Completion Student')
        self.technology, _ = Technology.objects.get_or_create(code='robotics', defaults={'name': 'Robotics', 'sort_order': 10, 'active': True})
        self.unit = CurriculumUnit.objects.create(grade='6', unit_code='R-01', title='Robotics Basics', objectives='Build a simple robot', status='published', created_by=self.admin)
        CurriculumUnitProfile.objects.create(curriculum_unit=self.unit, technology=self.technology, certificate_required=True)
        CurriculumClassAssignment.objects.create(curriculum_unit=self.unit, school_class=self.cls, assigned_by=self.admin)
        self.session = Session.objects.create(school_class=self.cls, curriculum_unit=self.unit, trainer=self.trainer, date=date(2026, 9, 12), start_time=time(10, 0), end_time=time(11, 0), topic='Robotics final build', created_by=self.trainer_user, status='completed', is_locked=True)
        SessionWorkflow.objects.create(session=self.session, technology=self.technology, is_last_session_for_unit=True)
        AttendanceRecord.objects.create(session=self.session, student=self.student, status='present', marked_by=self.trainer_user)
        self.quiz = Quiz.objects.create(title='Robotics Unit Quiz', grade='6', unit_code='R-01', status='active', created_by=self.admin)
        QuizClassAssignment.objects.create(quiz=self.quiz, school_class=self.cls, assigned_by=self.admin)
        question = QuizQuestion.objects.create(quiz=self.quiz, question_order=1, question_text='Robot brain?', option_a='Arduino', option_b='Wire', option_c='Wheel', option_d='Battery', correct_option='A', points=10)
        QuizAttempt.objects.create(quiz=self.quiz, student=self.student, attempt_number=1, status='completed', total_marks=10, total_questions=1, attempted_count=1, correct_count=1, score=10, percentage=100, answers={str(question.id): 'A'}, completed_at=timezone.now())
        StudentAssessment.objects.create(student=self.student, trainer=self.trainer, unit_code='R-01', title='Robotics final assessment', score=80, rating=4, status='published', assessment_date=date(2026, 9, 12), feedback='Good build')

    def test_last_session_requires_all_enabled_criteria(self):
        completion = evaluate_last_session(self.session)[0]
        self.assertEqual(completion.status, 'passed')
        self.assertEqual(completion.quiz_pct, 100.0)
        self.assertEqual(completion.practical_pct, Decimal('80'))
        self.assertEqual(completion.trainer_review_avg, Decimal('4'))
        self.assertEqual(completion.attendance_pct, Decimal('100'))
        self.assertEqual(UnitCompletion.objects.get(student=self.student, curriculum_unit=self.unit).status, 'passed')

    def test_last_session_flag_is_required_before_unit_can_pass(self):
        self.session.workflow.is_last_session_for_unit = False
        self.session.workflow.save(update_fields=['is_last_session_for_unit', 'updated_at'])
        with self.assertRaises(ValueError): evaluate_last_session(self.session)

    def test_programme_requires_trainer_request_then_admin_gate_then_certificate(self):
        self.assertRaises(ValueError, issue_certificate, self.trainer_user, self.student)
        with self.assertRaises(ValueError): admin_complete(self.admin, self.student)
        request_completion(self.trainer_user, self.student)
        programme = ProgrammeCompletion.objects.get(student=self.student)
        self.assertEqual(programme.status, 'trainer_requested')
        admin_complete(self.admin, self.student)
        programme.refresh_from_db()
        self.assertEqual(programme.status, 'admin_completed')
        certificate = issue_certificate(self.trainer_user, self.student)
        self.assertEqual(certificate.status, 'issued')
        self.assertEqual(certificate.technologies_snapshot[0]['name'], 'Robotics')
        self.assertEqual(certificate.rank, 1)
        self.assertTrue(certificate.rank_printed)
        self.assertEqual(certificate.snapshot['certificate_id'], certificate.certificate_id)

    def test_technology_is_data_driven_and_session_count_is_preserved(self):
        second = Session.objects.create(school_class=self.cls, curriculum_unit=self.unit, trainer=self.trainer, date=date(2026, 9, 10), start_time=time(10, 0), end_time=time(11, 0), topic='Robotics build', created_by=self.trainer_user, status='completed', is_locked=True)
        SessionWorkflow.objects.create(session=second, technology=self.technology, is_last_session_for_unit=False)
        data = summary(self.student)
        self.assertEqual(data['technologies'][0]['name'], 'Robotics')
        self.assertEqual(data['sessions_by_technology'][0]['sessions'], 2)
        self.assertEqual(data['units'][0]['sessions'], 2)

    def test_class_policy_overrides_global_policy(self):
        global_policy = CompletionPolicy.objects.get(school_class__isnull=True)
        self.assertEqual(global_policy.min_attendance_pct, Decimal('75.00'))
        class_policy = CompletionPolicy.objects.create(school_class=self.cls, min_attendance_pct=90, min_quiz_pct=70, min_practical_pct=80, min_trainer_review_rating=4)
        data = summary(self.student)
        self.assertEqual(data['policy']['school_class_id'], str(self.cls.id))
        self.assertEqual(data['policy']['min_attendance_pct'], 90.0)
        self.assertEqual(data['policy']['min_quiz_pct'], 70.0)
        class_policy.delete()

    def test_certificate_uses_snapshot_and_combined_technology_list(self):
        request_completion(self.trainer_user, self.student)
        admin_complete(self.admin, self.student)
        certificate = issue_certificate(self.trainer_user, self.student)
        self.assertEqual(Certificate.objects.filter(student=self.student).count(), 1)
        self.assertEqual(certificate.snapshot['technologies'][0]['code'], 'robotics')
        self.assertIn(certificate.certificate_id, certificate.snapshot['verification_url'])
