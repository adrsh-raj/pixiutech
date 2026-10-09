from datetime import timedelta

from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .credentials import build_student_username
from .models import User, UserRole, UserStatus


class AuthenticationAndCredentialTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf=True)
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

    def csrf_headers(self):
        response = self.client.get(reverse("v1-csrf-token"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {"HTTP_X_CSRFTOKEN": response.json()["csrfToken"]}

    def test_password_is_hashed_not_stored_plaintext(self):
        self.assertNotEqual(self.student.password, "StudentStrong!123")
        self.assertTrue(self.student.check_password("StudentStrong!123"))

    def test_login_requires_csrf_and_sets_role_scoped_httponly_refresh_cookie(self):
        response = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123", "role": UserRole.STUDENT},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123", "role": UserRole.STUDENT},
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertEqual(response.data["user"]["role"], UserRole.STUDENT)
        token = AccessToken(response.data["access"])
        self.assertEqual(int(token.get("auth_version", 0)), self.student.auth_version)
        cookie = response.cookies[f"{settings.JWT_REFRESH_COOKIE_NAME}_student"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], settings.JWT_REFRESH_COOKIE_PATH)
        self.assertTrue(cookie["secure"])

    def test_login_errors_do_not_enumerate_accounts(self):
        headers = self.csrf_headers()
        cases = [
            {"username": "does-not-exist", "password": "WrongPassword!123", "role": UserRole.STUDENT},
            {"username": self.student.username, "password": "WrongPassword!123", "role": UserRole.STUDENT},
            {"username": self.student.username, "password": "StudentStrong!123", "role": UserRole.TRAINER},
        ]
        responses = [
            self.client.post(reverse("v1-login"), payload, format="json", **headers)
            for payload in cases
        ]
        self.assertTrue(all(item.status_code == status.HTTP_401_UNAUTHORIZED for item in responses))
        def _unwrap(d):
            val = d.get("detail")
            return str(val[0]) if isinstance(val, list) and val else str(val)

        self.assertEqual({_unwrap(item.data) for item in responses}, {"Invalid username or password."})

        self.student.status = UserStatus.SUSPENDED
        self.student.is_active = True
        self.student.save(update_fields=["status", "is_active"])
        inactive = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123", "role": UserRole.STUDENT},
            format="json",
            **headers,
        )
        self.assertEqual(inactive.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(_unwrap(inactive.data), "Invalid username or password.")

    def test_failed_logins_lock_account_and_unlock_after_timeout(self):
        headers = self.csrf_headers()
        payload = {"username": self.student.username, "password": "WrongPassword!123", "role": UserRole.STUDENT}
        for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
            response = self.client.post(reverse("v1-login"), payload, format="json", **headers)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.student.refresh_from_db()
        self.assertEqual(self.student.failed_login_attempts, settings.LOGIN_MAX_FAILED_ATTEMPTS)
        self.assertIsNotNone(self.student.locked_until)

        blocked = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123", "role": UserRole.STUDENT},
            format="json",
            **headers,
        )
        self.assertEqual(blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(blocked.data.get("detail"), "Invalid username or password.")

        self.student.locked_until = timezone.now() - timedelta(minutes=1)
        self.student.save(update_fields=["locked_until"])
        recovered = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123", "role": UserRole.STUDENT},
            format="json",
            **headers,
        )
        self.assertEqual(recovered.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.failed_login_attempts, 0)
        self.assertIsNone(self.student.locked_until)

    def test_refresh_requires_csrf_and_uses_role_scoped_cookie(self):
        login = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123"},
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        refresh_cookie = self.client.cookies[f"{settings.JWT_REFRESH_COOKIE_NAME}_student"].value
        self.assertTrue(refresh_cookie)

        response = self.client.post(reverse("v1-refresh"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.post(reverse("v1-refresh"), {}, format="json", **self.csrf_headers())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertEqual(self.client.cookies[f"{settings.JWT_REFRESH_COOKIE_NAME}_student"].value, refresh_cookie)

    def test_me_requires_bearer_token(self):
        response = self.client.get(reverse("v1-me"))
        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_logout_blacklists_cookie_refresh_token(self):
        headers = self.csrf_headers()
        login = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123"},
            format="json",
            **headers,
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertTrue(self.client.cookies.get(f"{settings.JWT_REFRESH_COOKIE_NAME}_student"))

        response = self.client.post(reverse("v1-logout"), {"role": UserRole.STUDENT}, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)
        self.assertFalse(self.client.cookies[f"{settings.JWT_REFRESH_COOKIE_NAME}_student"].value)

        response = self.client.post(reverse("v1-refresh"), {"role": UserRole.STUDENT}, format="json", **self.csrf_headers())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_change_invalidates_access_and_refresh_sessions(self):
        headers = self.csrf_headers()
        login = self.client.post(
            reverse("v1-login"),
            {"username": self.student.username, "password": "StudentStrong!123"},
            format="json",
            **headers,
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        access = login.data["access"]
        old_version = self.student.auth_version

        change_response = self.client.post(
            reverse("v1-password-change"),
            {"current_password": "StudentStrong!123", "new_password": "NewStudentStrong!123"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )
        self.assertEqual(change_response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertGreater(self.student.auth_version, old_version)
        self.assertFalse(self.client.cookies[f"{settings.JWT_REFRESH_COOKIE_NAME}_student"].value)

        response = self.client.get(reverse("v1-me"), HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(reverse("v1-refresh"), {"role": UserRole.STUDENT}, format="json", **self.csrf_headers())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

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

    def test_student_username_generation_is_stable(self):
        self.assertEqual(build_student_username("xyz", "8", "a", 3), "XYZ8A 03")

    def test_password_reset_timeout_is_defined(self):
        self.assertEqual(settings.PASSWORD_RESET_TIMEOUT, 60 * 60)
