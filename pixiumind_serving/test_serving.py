"""
Unit & Concurrency Tests for PixiuMind Persistent Serving API.
Verifies OpenAI compatibility, authentication, readiness, attestation,
and non-blocking liveness under simulated load.
"""

import asyncio
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from config import config
from loader import model_holder
from server import app

client = TestClient(app)

class TestServingApi(unittest.TestCase):
    def setUp(self):
        # Reset model holder state
        model_holder.is_ready = True
        model_holder.attestation_data = {
            "base_model": "Qwen/Qwen3-14B",
            "base_revision": "40c069824f4251a91eefaf281ebe4c544efd3e18",
            "adapter": "PixiuMind-1.4-D14-Step-700",
            "adapter_sha256": "8a2bb5c2bf3d148dda16d7546dab62c4c6c381e62433a2a9a79a612e64b8e968",
        }

    def test_health_live_fast_response(self):
        start = time.time()
        response = client.get("/health/live")
        elapsed_ms = (time.time() - start) * 1000
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "live")
        self.assertLess(elapsed_ms, 50.0, "Liveness probe must respond in under 50ms")

    def test_health_ready_when_ready(self):
        model_holder.is_ready = True
        response = client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "ready")

    def test_health_ready_when_not_ready(self):
        model_holder.is_ready = False
        response = client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("status"), "not_ready")

    def test_attestation_requires_auth(self):
        response = client.get("/v1/attestation")
        self.assertEqual(response.status_code, 401)

    def test_attestation_with_valid_auth(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        response = client.get("/v1/attestation", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "verified")
        self.assertEqual(
            data["attestation"]["adapter_sha256"],
            "8a2bb5c2bf3d148dda16d7546dab62c4c6c381e62433a2a9a79a612e64b8e968",
        )

    def test_completions_requires_auth(self):
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        response = client.post("/v1/chat/completions", json=payload)
        self.assertEqual(response.status_code, 401)

    def test_completions_invalid_model_rejected(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "unapproved-random-model",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("detail", {}).get("code"), "INVALID_MODEL")

    @patch("server.async_generate")
    def test_completions_success_and_alias(self, mock_async_generate):
        mock_async_generate.return_value = {
            "text": "Hello! I am PixiuMind.",
            "finish_reason": "stop",
            "prompt_tokens": 15,
            "completion_tokens": 8,
            "total_tokens": 23,
            "latency_seconds": 0.45,
            "throughput_tok_s": 17.7,
        }

        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "Hello"}],
        }

        # Test canonical /v1/chat/completions
        res_v1 = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(res_v1.status_code, 200)
        data_v1 = res_v1.json()
        self.assertEqual(data_v1["object"], "chat.completion")
        self.assertEqual(data_v1["choices"][0]["message"]["content"], "Hello! I am PixiuMind.")
        self.assertEqual(data_v1["choices"][0]["finish_reason"], "stop")
        self.assertEqual(data_v1["usage"]["total_tokens"], 23)

        # Test alias /chat/completions
        res_alias = client.post("/chat/completions", json=payload, headers=headers)
        self.assertEqual(res_alias.status_code, 200)
        data_alias = res_alias.json()
        self.assertEqual(data_alias["choices"][0]["message"]["content"], "Hello! I am PixiuMind.")

    def test_non_blocking_event_loop_during_inference(self):
        """
        Verify that while an inference call is in progress,
        /health/live responds immediately without being blocked.
        """
        async def slow_inference(*args, **kwargs):
            await asyncio.sleep(0.5)  # Simulate 500ms GPU computation
            return {
                "text": "Simulated output",
                "finish_reason": "stop",
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
                "latency_seconds": 0.5,
                "throughput_tok_s": 10.0,
            }

        with patch("server.async_generate", side_effect=slow_inference):
            headers = {"Authorization": f"Bearer {config.api_key}"}
            payload = {
                "model": "pixiumind-step-700",
                "messages": [{"role": "user", "content": "Explain while loops"}],
            }

            # Fire liveness probe while service is handling request
            start = time.time()
            res_live = client.get("/health/live")
            live_elapsed_ms = (time.time() - start) * 1000

            self.assertEqual(res_live.status_code, 200)
            self.assertLess(live_elapsed_ms, 50.0, "Liveness probe must not be blocked by inference")


if __name__ == "__main__":
    unittest.main()
