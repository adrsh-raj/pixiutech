from datetime import date

from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from .models import Notification


class NotificationAudienceAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create(username='phase17-admin', role=UserRole.ADMIN, status='active', is_active=True)
        self.school_user = User.objects.create(username='phase17-school', role=UserRole.SCHOOL, status='active', is_active=True)
        self.trainer_user = User.objects.create(username='phase17-trainer', role=UserRole.TRAINER, status='active', is_active=True)
        self.student_user = User.objects.create(username='phase17-student', role=UserRole.STUDENT, status='active', is_active=True)
        self.other_student_user = User.objects.create(username='phase17-other', role=UserRole.STUDENT, status='active', is_active=True)
        self.other_trainer_user = User.objects.create(username='phase17-trainer-2', role=UserRole.TRAINER, status='active', is_active=True)
        self.school = School.objects.create(school_code='P17', name='Phase 17 School', account=self.school_user)
        self.trainer = Trainer.objects.create(trainer_id='PTR-01', name='Phase 17 Trainer', account=self.trainer_user)
        self.other_trainer = Trainer.objects.create(trainer_id='PTR-02', name='Phase 17 Trainer Two', account=self.other_trainer_user)
        TrainerSchoolAssignment.objects.create(trainer=self.trainer, school=self.school, assigned_from=date(2026, 2, 1), status='active')
        self.school_class = SchoolClass.objects.create(school=self.school, grade='8', section='A')
        other_class = SchoolClass.objects.create(school=self.school, grade='9', section='A')
        Student.objects.create(account=self.student_user, school_class=self.school_class, student_id='P178A01', roll_number=1, name='Student One', status='active')
        Student.objects.create(account=self.other_student_user, school_class=other_class, student_id='P179A01', roll_number=1, name='Student Two', status='active')

    def authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_specific_school_reaches_school_trainer_and_students(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/v1/notifications', {'target_type': 'specific_school', 'target_school_id': str(self.school.id), 'title': 'School Notice', 'message': 'Important update'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual({row['recipient_id'] for row in response.data}, {str(self.school_user.id), str(self.trainer_user.id), str(self.student_user.id)})

    def test_all_schools_targets_active_school_accounts(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/v1/notifications', {'target_type': 'all_schools', 'title': 'Network Notice', 'message': 'For every school'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual({row['recipient_id'] for row in response.data}, {str(self.school_user.id)})

    def test_all_trainers_targets_active_trainer_accounts(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/v1/notifications', {'target_type': 'all_trainers', 'title': 'Trainer Notice', 'message': 'For every trainer'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual({row['recipient_id'] for row in response.data}, {str(self.trainer_user.id), str(self.other_trainer_user.id)})

    def test_all_students_targets_active_student_accounts(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/v1/notifications', {'target_type': 'all_students', 'title': 'Student Notice', 'message': 'For every student'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual({row['recipient_id'] for row in response.data}, {str(self.student_user.id), str(self.other_student_user.id)})

    def test_notification_update_and_delete_are_not_exposed(self):
        notification = Notification.objects.create(recipient=self.student_user, notification_type='info', title='Immutable', message='Keep me', event_key='phase17:immutable')
        self.authenticate(self.admin)
        self.assertEqual(self.client.put(f'/api/v1/notifications/{notification.id}', {'title': 'Changed'}, format='json').status_code, 405)
        self.assertEqual(self.client.delete(f'/api/v1/notifications/{notification.id}').status_code, 405)
