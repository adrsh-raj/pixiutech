from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole


class Phase6APITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="phase6-admin", password="TestPassword123!", role=UserRole.ADMIN)
        self.trainer = User.objects.create_user(username="phase6-trainer", password="TestPassword123!", role=UserRole.TRAINER)

    def _authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_admin_can_read_dashboard(self):
        self._authenticate(self.admin)
        response = self.client.get("/api/phase6/dashboard/summary/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("academics", response.json())
        self.assertIn("finance", response.json())

    def test_non_admin_is_denied(self):
        self._authenticate(self.trainer)
        response = self.client.get("/api/phase6/dashboard/summary/")
        self.assertEqual(response.status_code, 403)
