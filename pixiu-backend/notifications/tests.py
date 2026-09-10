from datetime import date

from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer
from .models import Notification
from .services import notify


class NotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("notif-user", "strong-pass", role=UserRole.STUDENT)

    def test_notification_is_recipient_bound_and_deduplicated(self):
        first = notify(recipient=self.user, title="Payment", message="Paid", notification_type="payment", event_key="payment:1")
        second = notify(recipient=self.user, title="Payment again", message="Paid again", notification_type="payment", event_key="payment:1")
        self.assertEqual(first.id, second.id)
        self.assertEqual(Notification.objects.filter(recipient=self.user).count(), 1)


class NotificationAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("notif-admin", "StrongAdminPass!123", role=UserRole.ADMIN, status="active")
        self.trainer_user = User.objects.create_user("notif-trainer", "StrongTrainerPass!123", role=UserRole.TRAINER, status="active")
        self.student_user = User.objects.create_user("notif-student", "StrongStudentPass!123", role=UserRole.STUDENT, status="active")
        self.other_student_user = User.objects.create_user("notif-other", "StrongOtherPass!123", role=UserRole.STUDENT, status="active")
        self.school = School.objects.create(school_code="NTS", name="Notification School")
        self.trainer = Trainer.objects.create(trainer_id="NTR-01", name="Notification Trainer", account=self.trainer_user)
        self.school_class = SchoolClass.objects.create(school=self.school, grade="8", section="A")
        Student.objects.create(account=self.student_user, school_class=self.school_class, student_id="NTS8A 01", roll_number=1, name="Student One", status="active")
        other_class = SchoolClass.objects.create(school=self.school, grade="9", section="A")
        Student.objects.create(account=self.other_student_user, school_class=other_class, student_id="NTS9A 01", roll_number=1, name="Student Two", status="active")

    def authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_non_admin_cannot_send_targeted_notification(self):
        self.authenticate(self.trainer_user)
        response = self.client.post("/api/v1/notifications", {"target_type": "specific_trainer", "target_trainer_id": str(self.trainer.id), "title": "No", "message": "No"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_target_specific_trainer(self):
        self.authenticate(self.admin)
        response = self.client.post("/api/v1/notifications", {"target_type": "specific_trainer", "target_trainer_id": str(self.trainer.id), "title": "Trainer Notice", "message": "Session reminder", "notification_type": "action"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["recipient_id"], str(self.trainer_user.id))

    def test_specific_class_targets_only_students_in_that_class(self):
        self.authenticate(self.admin)
        response = self.client.post("/api/v1/notifications", {"target_type": "specific_class", "target_class_id": str(self.school_class.id), "title": "Class Notice", "message": "Bring your kit"}, format="json")
        self.assertEqual(response.status_code, 201)
        recipients = {item["recipient_id"] for item in response.data}
        self.assertEqual(recipients, {str(self.student_user.id)})

    def test_admin_does_not_receive_school_targeted_notification(self):
        school_user = User.objects.create_user("notif-school", "StrongSchoolPass!123", role=UserRole.SCHOOL, status="active")
        self.school.account = school_user
        self.school.save(update_fields=["account"])
        self.authenticate(self.admin)
        response = self.client.post("/api/v1/notifications", {"target_type": "specific_school", "target_school_id": str(self.school.id), "title": "School Notice", "message": "Classes start tomorrow"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data[0]["recipient_id"], str(school_user.id))
        school_notification_id = response.data[0]["id"]
        admin_inbox = self.client.get("/api/v1/notifications")
        self.assertEqual(admin_inbox.status_code, 200)
        self.assertFalse(any(item["id"] == school_notification_id for item in admin_inbox.data))
        self.assertEqual(self.client.post(f"/api/v1/notifications/{school_notification_id}/read").status_code, 404)

    def test_student_cannot_read_another_users_notification(self):
        notification = Notification.objects.create(recipient=self.other_student_user, notification_type="info", title="Private", message="Only for other student", event_key="private:test")
        self.authenticate(self.student_user)
        response = self.client.get(f"/api/v1/notifications/{notification.id}")
        self.assertEqual(response.status_code, 404)

    def test_read_and_read_all_are_server_backed(self):
        notification = Notification.objects.create(recipient=self.student_user, notification_type="info", title="Notice", message="Read me", event_key="read:test")
        self.authenticate(self.student_user)
        response = self.client.post(f"/api/v1/notifications/{notification.id}/read")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.get(pk=notification.id).read_at)
        unread = Notification.objects.create(recipient=self.student_user, notification_type="info", title="Notice 2", message="Read all", event_key="read:test:2")
        response = self.client.post("/api/v1/notifications/read-all")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.get(pk=unread.id).read_at)
