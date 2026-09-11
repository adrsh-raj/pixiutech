from datetime import date, time

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from learning.models import CurriculumClassAssignment, CurriculumUnit, Quiz, QuizAttempt, QuizClassAssignment, QuizQuestion, Session

User = get_user_model()


class TrainerSessionAndQuizResultTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='verify-admin', password='pass1234', role='admin', display_name='Admin')
        self.trainer_user = User.objects.create_user(username='verify-trainer', password='pass1234', role='trainer', display_name='Trainer')
        self.student_user = User.objects.create_user(username='verify-student', password='pass1234', role='student', display_name='Student')
        self.school = School.objects.create(school_code='VERIFY', name='Verify School')
        self.school_class = SchoolClass.objects.create(school=self.school, grade='6', section='A')
        self.student = Student.objects.create(account=self.student_user, school_class=self.school_class, student_id='VERIFY6A01', roll_number=1, name='Student')
        self.trainer = Trainer.objects.create(account=self.trainer_user, trainer_id='TR-VERIFY', name='Trainer')
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date.today(), status='active')
        self.unit = CurriculumUnit.objects.create(grade='6', level='Level 1', unit_code='U1', title='Unit 1', week='Unit 1', topic='Robotics', objectives='Build', status='published', created_by=self.admin)
        CurriculumClassAssignment.objects.create(curriculum_unit=self.unit, school_class=self.school_class, assigned_by=self.admin)
        self.quiz = Quiz.objects.create(title='Robotics Quiz', grade='6', level='Level 1', unit_code='U1', duration_seconds=60, duration_minutes=1, status='active', created_by=self.admin)
        QuizQuestion.objects.create(quiz=self.quiz, question_order=1, question_text='Which is a robot?', option_a='Robot', option_b='Book', option_c='Chair', option_d='Bag', correct_option='A', points=1)
        QuizClassAssignment.objects.create(quiz=self.quiz, school_class=self.school_class, assigned_by=self.admin)

    def test_trainer_can_create_session_and_admin_sees_same_record(self):
        self.client.force_authenticate(self.trainer_user)
        payload = {
            'school_class': str(self.school_class.id),
            'trainer': str(self.trainer.id),
            'curriculum_unit': str(self.unit.id),
            'date': date.today().isoformat(),
            'start_time': '10:00',
            'end_time': '11:00',
            'topic': 'Trainer created session',
            'notes': 'Created from trainer portal',
        }
        response = self.client.post(reverse('v1-session-list'), payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        session = Session.objects.get(pk=response.data['id'])
        self.assertEqual(session.trainer_id, self.trainer.id)
        self.assertEqual(session.school_class_id, self.school_class.id)
        self.assertEqual(session.curriculum_unit_id, self.unit.id)

        self.client.force_authenticate(self.admin)
        admin_response = self.client.get(reverse('v1-session-list'))
        self.assertEqual(admin_response.status_code, 200, admin_response.data)
        self.assertIn(str(session.id), {row['id'] for row in admin_response.data})

    def test_student_completed_attempt_has_score_and_two_pdf_documents(self):
        attempt = QuizAttempt.objects.create(
            quiz=self.quiz,
            student=self.student,
            attempt_number=1,
            answers={},
            score=0,
            total_marks=1,
            percentage=0,
            correct_count=0,
            attempted_count=1,
            total_questions=1,
            time_taken_seconds=8,
            violation_count=0,
            status='completed',
        )
        self.client.force_authenticate(self.student_user)
        submissions = self.client.get(reverse('v1-quiz-submission-list'))
        self.assertEqual(submissions.status_code, 200, submissions.data)
        row = next(item for item in submissions.data if item['id'] == str(attempt.id))
        self.assertEqual(float(row['score']), 0.0)
        self.assertEqual(float(row['total_marks']), 1.0)

        result = self.client.get(reverse('v1-quiz-result', kwargs={'pk': attempt.id}))
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['quiz_title'], self.quiz.title)
        self.assertEqual(result.data['total_questions'], 1)

        answers_pdf = self.client.get(reverse('v1-quiz-result-pdf', kwargs={'pk': attempt.id}), {'kind': 'answers'})
        self.assertEqual(answers_pdf.status_code, 200)
        self.assertEqual(answers_pdf['Content-Type'], 'application/pdf')
        self.assertTrue(answers_pdf.content.startswith(b'%PDF'))

        key_pdf = self.client.get(reverse('v1-quiz-result-pdf', kwargs={'pk': attempt.id}), {'kind': 'key'})
        self.assertEqual(key_pdf.status_code, 200)
        self.assertEqual(key_pdf['Content-Type'], 'application/pdf')
        self.assertTrue(key_pdf.content.startswith(b'%PDF'))
