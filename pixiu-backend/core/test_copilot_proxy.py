import json
from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import UserStatus
from core.copilot_views import CopilotProposalProxyView


class CopilotProposalProxySimpleTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = CopilotProposalProxyView.as_view()
        self.mock_user = MagicMock()
        self.mock_user.is_authenticated = True
        self.mock_user.is_active = True
        self.mock_user.status = UserStatus.ACTIVE

    def test_unauthenticated_request_is_rejected(self):
        request = self.factory.post(
            "/api/v1/copilot/propose",
            {"task": "Blink an LED on Pin 13"},
            format="json",
        )
        response = self.view(request)
        self.assertEqual(response.status_code, 401)

    def test_empty_task_returns_bad_request(self):
        request = self.factory.post(
            "/api/v1/copilot/propose",
            {"task": "   "},
            format="json",
        )
        force_authenticate(request, user=self.mock_user)
        response = self.view(request)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("code"), "INVALID_TASK")

    @override_settings(PIXIUMIND_ENDPOINT_URL="")
    def test_missing_inference_endpoint_fails_safely_with_503(self):
        request = self.factory.post(
            "/api/v1/copilot/propose",
            {"task": "Blink an LED on Pin 13"},
            format="json",
        )
        force_authenticate(request, user=self.mock_user)
        response = self.view(request)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data.get("code"), "PROVIDER_UNCONFIGURED")

    @override_settings(
        PIXIUMIND_ENDPOINT_URL="https://gpu-inference.pixiutech.local",
        PIXIUMIND_API_KEY="test-gpu-secret-key-12345",
        PIXIUMIND_MODEL_ID="pixiumind-14b-checkpoint-400",
    )
    @patch("urllib.request.urlopen")
    def test_authenticated_proxy_calls_upstream_and_returns_proposal(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.getcode.return_value = 200
        mock_response.read.return_value = json.dumps({
            "id": "chatcmpl-test-400",
            "model": "pixiumind-14b-checkpoint-400",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "```xml\n<xml xmlns=\"https://developers.google.com/blockly/xml\">\n  <block type=\"arduino_pin_digital_write\" x=\"50\" y=\"50\">\n    <field name=\"PIN\">13</field>\n    <field name=\"STATE\">HIGH</field>\n  </block>\n</xml>\n```"
                    }
                }
            ]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        request = self.factory.post(
            "/api/v1/copilot/propose",
            {
                "task": "Blink an LED on Pin 13",
                "workspace_xml": "",
                "context": {"board": "arduino-uno"}
            },
            format="json",
        )
        force_authenticate(request, user=self.mock_user)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("status"), "ok")
        self.assertEqual(response.data.get("model"), "pixiumind-14b-checkpoint-400")
        self.assertIn("<block type=\"arduino_pin_digital_write\"", response.data.get("proposal"))

        # Verify that upstream request included Authorization header with server secret
        called_req = mock_urlopen.call_args[0][0]
        self.assertEqual(called_req.get_header("Authorization"), "Bearer test-gpu-secret-key-12345")
        self.assertEqual(called_req.full_url, "https://gpu-inference.pixiutech.local/v1/chat/completions")
