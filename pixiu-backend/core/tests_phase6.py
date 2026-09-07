import os
from datetime import datetime, timedelta, timezone

import jwt
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, UserRole


class Phase6APITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="phase6-admin", password="TestPassword123!", role=UserRole.ADMIN)
        self.trainer = User.objects.create_user(username="phase6-trainer", password="TestPassword123!", role=UserRole.TRAINER)

    def _token(self, user):
        secret = os.environ.get("EXPRESS_JWT_SECRET") or os.environ.get("JWT_SECRET") or "phase6-test-secret-12345678901234567890"
        return jwt.encode({"id": str(user.id), "username": user.username, "role": user.role, "name": user.display_name or user.username, "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, secret, algorithm="HS256")

    def test_admin_can_read_dashboard(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self._token(self.admin)}")
        response = self.client.get("/api/phase6/dashboard/summary/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("academics", response.json())
        self.assertIn("finance", response.json())

    def test_non_admin_is_denied(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self._token(self.trainer)}")
        response = self.client.get("/api/phase6/dashboard/summary/")
        self.assertEqual(response.status_code, 401)
