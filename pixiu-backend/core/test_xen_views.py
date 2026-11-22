"""
Unit tests for core.xen_views
Verifies role-aware access, intent enforcement, A05 qualification gate,
upstream proxying, and response post-processing.
"""

import json
import uuid
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import UserRole, UserStatus
from core.xen_views import XenChatView, XenHealthView, XenAttestationView


class XenViewsUnitTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.chat_view = XenChatView.as_view()
        self.health_view = XenHealthView.as_view()
        self.attest_view = XenAttestationView.as_view()

        # Mock Student User
        self.mock_student = MagicMock()
        self.mock_student.id = uuid.uuid4()
        self.mock_student.is_authenticated = True
        self.mock_student.is_active = True
        self.mock_student.status = UserStatus.ACTIVE
        self.mock_student.role = UserRole.STUDENT

        # Mock Trainer User (Non-A05)
        self.mock_trainer = MagicMock()
        self.mock_trainer.id = uuid.uuid4()
        self.mock_trainer.is_authenticated = True
        self.mock_trainer.is_active = True
        self.mock_trainer.status = UserStatus.ACTIVE
        self.mock_trainer.role = UserRole.TRAINER
        self.mock_trainer.trainer_profile = MagicMock()
        self.mock_trainer.trainer_profile.xen_identity = MagicMock()
        self.mock_trainer.trainer_profile.xen_identity.is_a05_qualified = False

        # Mock Trainer User (A05 Qualified)
        self.mock_trainer_a05 = MagicMock()
        self.mock_trainer_a05.id = uuid.uuid4()
        self.mock_trainer_a05.is_authenticated = True
        self.mock_trainer_a05.is_active = True
        self.mock_trainer_a05.status = UserStatus.ACTIVE
        self.mock_trainer_a05.role = UserRole.TRAINER
        self.mock_trainer_a05.trainer_profile = MagicMock()
        self.mock_trainer_a05.trainer_profile.xen_identity = MagicMock()
        self.mock_trainer_a05.trainer_profile.xen_identity.is_a05_qualified = True

        # Mock Admin User
        self.mock_admin = MagicMock()
        self.mock_admin.id = uuid.uuid4()
        self.mock_admin.is_authenticated = True
        self.mock_admin.is_active = True
        self.mock_admin.status = UserStatus.ACTIVE
        self.mock_admin.role = UserRole.ADMIN

    def test_unauthenticated_chat_rejected(self):
        request = self.factory.post("/api/v1/xen/chat", {"prompt": "Hello"}, format="json")
        response = self.chat_view(request)
        self.assertEqual(response.status_code, 401)

    def test_empty_prompt_returns_bad_request(self):
        request = self.factory.post("/api/v1/xen/chat", {"prompt": "  "}, format="json")
        force_authenticate(request, user=self.mock_student)
        response = self.chat_view(request)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("code"), "INVALID_PROMPT")

    def test_trainer_without_a05_rejected_for_personal_learning(self):
        request = self.factory.post(
            "/api/v1/xen/chat",
            {"prompt": "Teach me advanced deep learning", "intent": "PERSONAL_LEARNING"},
            format="json",
        )
        force_authenticate(request, user=self.mock_trainer)
        response = self.chat_view(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("code"), "FORBIDDEN_INTENT")

    def test_student_attestation_rejected(self):
        request = self.factory.get("/api/v1/xen/attestation")
        force_authenticate(request, user=self.mock_student)
        response = self.attest_view(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get("code"), "PERMISSION_DENIED")

    @override_settings(PIXIUMIND_ENDPOINT_URL="")
    def test_missing_endpoint_fails_safely_503(self):
        request = self.factory.post("/api/v1/xen/chat", {"prompt": "Hello"}, format="json")
        force_authenticate(request, user=self.mock_student)
        response = self.chat_view(request)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data.get("code"), "PROVIDER_UNCONFIGURED")

    @override_settings(
        PIXIUMIND_ENDPOINT_URL="https://gpu-inference.pixiutech.local",
        PIXIUMIND_API_KEY="test-gpu-secret",
        PIXIUMIND_MODEL_ID="pixiumind-step-700",
    )
    @patch("urllib.request.urlopen")
    def test_successful_chat_proxy_and_decoder_sanitization(self, mock_urlopen):
        raw_output_with_tokens = (
            "Here is the complete, tested Python implementation of `is_even(n)`:\n\n"
            "```python\n"
            "def is_even(n):\n"
            "    return n % 2 == 0\n"
            "```\n<|im_end|>"
        )

        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.read.return_value = json.dumps({
            "id": "chatcmpl-test-700",
            "model": "pixiumind-step-700",
            "choices": [
                {
                    "message": {"role": "assistant", "content": raw_output_with_tokens},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"total_tokens": 42},
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        request = self.factory.post(
            "/api/v1/xen/chat",
            {"prompt": "Write a function to check if a number is even", "intent": "STUDENT_LEARNING"},
            format="json",
        )
        force_authenticate(request, user=self.mock_student)
        response = self.chat_view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("status"), "ok")
        self.assertEqual(response.data.get("model"), "pixiumind-step-700")

        resp_data = response.data.get("response", {})
        # Special token stripped
        self.assertNotIn("<|im_end|>", resp_data.get("text", ""))
        # Unverified tested claim sanitized
        self.assertIn("complete Python implementation (syntax verified)", resp_data.get("text", ""))
        self.assertNotIn("complete, tested Python implementation", resp_data.get("text", ""))
        # Completeness and AST valid
        self.assertTrue(resp_data.get("is_complete"))
        self.assertTrue(resp_data.get("syntax_valid"))
        self.assertTrue(resp_data.get("display_ast_valid"))
        self.assertFalse(resp_data.get("tested"))
