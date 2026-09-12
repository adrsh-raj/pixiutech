from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .credentials import build_student_password, build_student_username
from .models import User, UserRole, UserStatus


class AuthenticationAndCredentialTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="testadmin",
            password="AdminStrongPassword!123",
        )
        self.student = User.objects.create_user(
            username="TEST6A 01",
            password="StudentStrong!123",
            role=UserRole.STUDENT,
            display_name="Test Student",
        )

    def test_password_is_hashed_not_stored_plaintext(self):
        self.assertNotEqual(self.student.password, "StudentStrong!123")
        self.assertTrue(self.student.check_password("StudentStrong!123"))

    def test_login_returns_access_user_and_sets_httponly_refresh_cookie(self):
        response = self.client.post(
            reverse("login"),
            {
                "username": self.student.username,
                "password": "StudentStrong!123",
                "role": UserRole.STUDENT,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertEqual(response.data["user"]["role"], UserRole.STUDENT)
        cookie = response.cookies[settings.JWT_REFRESH_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], settings.JWT_REFRESH_COOKIE_PATH)

    def test_refresh_uses_httponly_cookie_and_does_not_return_refresh(self):
        login = self.client.post(
            reverse("login"),
            {"username": self.student.username, "password": "StudentStrong!123"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        refresh_cookie = self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
        self.assertTrue(refresh_cookie)

        response = self.client.post(reverse("token-refresh"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertNotEqual(self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME].value, refresh_cookie)

    def test_role_mismatch_is_forbidden(self):
        response = self.client.post(
            reverse("login"),
            {
                "username": self.student.username,
                "password": "StudentStrong!123",
                "role": UserRole.TRAINER,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inactive_account_cannot_login(self):
        self.student.status = UserStatus.SUSPENDED
        self.student.save(update_fields=["status"])
        response = self.client.post(
            reverse("login"),
            {"username": self.student.username, "password": "StudentStrong!123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_bearer_token(self):
        response = self.client.get(reverse("me"))
        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_logout_blacklists_cookie_refresh_token(self):
        login = self.client.post(
            reverse("login"),
            {"username": self.student.username, "password": "StudentStrong!123"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertTrue(self.client.cookies.get(settings.JWT_REFRESH_COOKIE_NAME))

        response = self.client.post(reverse("logout"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)
        self.assertFalse(self.client.cookies.get(settings.JWT_REFRESH_COOKIE_NAME).value)

        refresh_response = self.client.post(reverse("token-refresh"), {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_create_managed_trainer_account(self):
        access = RefreshToken.for_user(self.admin).access_token
        response = self.client.post(
            reverse("managed-account"),
            {
                "username": "TR-001",
                "password": "TrainerStrong!123",
                "role": UserRole.TRAINER,
                "display_name": "Trainer One",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {str(access)}",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data["user"])
        trainer = User.objects.get(username="TR-001")
        self.assertEqual(trainer.role, UserRole.TRAINER)
        self.assertTrue(trainer.check_password("TrainerStrong!123"))
        self.assertTrue(trainer.must_change_password)

    def test_non_admin_cannot_manage_credentials(self):
        access = RefreshToken.for_user(self.student).access_token
        response = self.client.post(
            reverse("managed-account"),
            {
                "username": "SCH-001",
                "password": "SchoolStrong!123",
                "role": UserRole.SCHOOL,
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {str(access)}",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_credentials_are_deterministic(self):
        username = build_student_username("xyz", "8", "a", 3)
        self.assertEqual(username, "XYZ8A 03")
        self.assertEqual(build_student_password("xyz", username), "XYZxyz8A3@hata")

    def test_password_change_revokes_old_refresh_token_and_cookie(self):
        login = self.client.post(
            reverse("login"),
            {"username": self.student.username, "password": "StudentStrong!123"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        refresh = self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
        access = login.data["access"]

        change_response = self.client.post(
            reverse("password-change"),
            {
                "current_password": "StudentStrong!123",
                "new_password": "NewStudentStrong!123",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )
        self.assertEqual(change_response.status_code, status.HTTP_200_OK)
        self.assertFalse(self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME].value)

        response = self.client.post(reverse("token-refresh"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(refresh)
