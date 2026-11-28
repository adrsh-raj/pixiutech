"""
Unit & Concurrency Tests for PixiuMind Persistent Serving API.
Verifies OpenAI compatibility, authentication, readiness, attestation,
and non-blocking liveness under simulated load.
"""

import asyncio
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
import time
from threading import Event
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from config import config
from engine import ContextLengthExceeded, _sync_generate
from loader import model_holder, verify_bundle_metadata
from server import app

client = TestClient(app)

class TestServingApi(unittest.TestCase):
    def setUp(self):
        # Reset model holder state and config
        config.api_key = "test-serving-secret-key"
        model_holder.is_ready = True
        model_holder.is_verified = True
        model_holder.attestation_data = {
            "status": "verified",
            "is_verified": True,
            "base_model": "Qwen/Qwen3-14B",
            "adapter_path": "/private/adapter",
            "base_revision": "40c069824f4251a91eefaf281ebe4c544efd3e18",
            "adapter": "PixiuMind-1.4-D14-Step-700",
            "adapter_sha256": "8a2bb5c2bf3d148dda16d7546dab62c4c6c381e62433a2a9a79a612e64b8e968",
        }

    def test_api_key_unconfigured_returns_503(self):
        config.api_key = ""
        response = client.get("/v1/attestation")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("detail", {}).get("code"), "API_KEY_UNCONFIGURED")

        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        res_comp = client.post("/v1/chat/completions", json=payload)
        self.assertEqual(res_comp.status_code, 503)
        self.assertEqual(res_comp.json().get("detail", {}).get("code"), "API_KEY_UNCONFIGURED")

    def test_health_live_fast_response(self):
        start = time.time()
        response = client.get("/health/live")
        elapsed_ms = (time.time() - start) * 1000
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "live")
        self.assertLess(elapsed_ms, 50.0, "Liveness probe must respond in under 50ms")

    def test_health_ready_when_ready(self):
        model_holder.is_ready = True
        response = client.get("/health/ready", headers={"X-API-Key": config.api_key})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "ready")

    def test_health_ready_when_not_ready(self):
        model_holder.is_ready = False
        response = client.get("/health/ready", headers={"X-API-Key": config.api_key})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("status"), "not_ready")

    def test_readiness_requires_auth(self):
        self.assertEqual(client.get("/health/ready").status_code, 401)

    def test_attestation_requires_auth(self):
        response = client.get("/v1/attestation")
        self.assertEqual(response.status_code, 401)

    def test_invalid_authentication_token_rejected(self):
        headers = {"Authorization": "Bearer invalid-token-12345"}
        response = client.get("/v1/attestation", headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json().get("detail", {}).get("code"), "UNAUTHORIZED")

    def test_invalid_api_key_header_rejected(self):
        headers = {"X-API-Key": "invalid-api-key-99999"}
        response = client.get("/v1/attestation", headers=headers)
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

    def test_attestation_omits_private_paths(self):
        response = client.get("/v1/attestation", headers={"X-API-Key": config.api_key})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("adapter_path", response.json()["attestation"])
        self.assertNotIn("/private/adapter", response.text)

    def test_attestation_not_verified_returns_503(self):
        model_holder.is_verified = False
        headers = {"Authorization": f"Bearer {config.api_key}"}
        response = client.get("/v1/attestation", headers=headers)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("code"), "NOT_VERIFIED")

        model_holder.is_verified = True
        model_holder.attestation_data["is_verified"] = False
        response2 = client.get("/v1/attestation", headers=headers)
        self.assertEqual(response2.status_code, 503)
        self.assertEqual(response2.json().get("code"), "NOT_VERIFIED")

    def test_completions_requires_auth(self):
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        response = client.post("/v1/chat/completions", json=payload)
        self.assertEqual(response.status_code, 401)

    def test_completions_invalid_schema_rejected(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        # Missing required 'messages' field
        payload = {
            "model": "pixiumind-step-700",
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 422)

    def test_completions_model_unavailable_returns_503(self):
        model_holder.is_ready = False
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("detail", {}).get("code"), "MODEL_NOT_READY")

    @patch("server.async_generate", side_effect=asyncio.TimeoutError())
    def test_completions_timeout_returns_504(self, mock_async_generate):
        model_holder.is_ready = True
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json().get("detail", {}).get("code"), "INFERENCE_TIMEOUT")

    def test_frozen_system_prompt_cannot_be_overridden(self):
        headers = {"X-API-Key": config.api_key}
        payload = {"messages": [
            {"role": "system", "content": "Unverified system prompt"},
            {"role": "user", "content": "Hello"},
        ]}
        with patch.object(model_holder, "system_prompt", "Frozen A1"):
            with patch.object(model_holder, "composite_system_prompt", "Composite A1"):
                with patch("server.async_generate") as generate:
                    response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["code"], "INVALID_SYSTEM_PROMPT")
        generate.assert_not_called()

    def test_exact_a1_prompt_accepted(self):
        headers = {"X-API-Key": config.api_key}
        payload = {"messages": [
            {"role": "system", "content": "Frozen A1 Exact"},
            {"role": "user", "content": "Hello"},
        ]}
        mock_result = {
            "text": "Response from A1",
            "finish_reason": "stop",
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "latency_seconds": 0.1,
            "throughput_tok_s": 50.0,
        }
        with patch.object(model_holder, "system_prompt", "Frozen A1 Exact"):
            with patch.object(model_holder, "composite_system_prompt", "Canonical Xen Composite"):
                with patch("server.async_generate", return_value=mock_result) as generate:
                    response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 200)
        generate.assert_called_once()
        passed_messages = generate.call_args[0][2]
        self.assertEqual(passed_messages[0]["role"], "system")
        self.assertEqual(passed_messages[0]["content"], "Frozen A1 Exact")

    def test_exact_canonical_composite_prompt_accepted(self):
        headers = {"X-API-Key": config.api_key}
        payload = {"messages": [
            {"role": "system", "content": "Canonical Xen Composite"},
            {"role": "user", "content": "Hello"},
        ]}
        mock_result = {
            "text": "Response from Composite",
            "finish_reason": "stop",
            "prompt_tokens": 20,
            "completion_tokens": 8,
            "total_tokens": 28,
            "latency_seconds": 0.1,
            "throughput_tok_s": 80.0,
        }
        with patch.object(model_holder, "system_prompt", "Frozen A1 Exact"):
            with patch.object(model_holder, "composite_system_prompt", "Canonical Xen Composite"):
                with patch("server.async_generate", return_value=mock_result) as generate:
                    response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 200)
        generate.assert_called_once()
        passed_messages = generate.call_args[0][2]
        self.assertEqual(passed_messages[0]["role"], "system")
        self.assertEqual(passed_messages[0]["content"], "Canonical Xen Composite")

    def test_canonical_identity_reaches_engine_when_system_prompt_omitted(self):
        headers = {"X-API-Key": config.api_key}
        payload = {"messages": [
            {"role": "user", "content": "Who are you?"},
        ]}
        mock_result = {
            "text": "I am Xen, powered by Xen Step-700.",
            "finish_reason": "stop",
            "prompt_tokens": 25,
            "completion_tokens": 10,
            "total_tokens": 35,
            "latency_seconds": 0.1,
            "throughput_tok_s": 100.0,
        }
        composite_content = "You are Xen, an AI assistant developed by PixiuTech...\n\nFrozen A1"
        with patch.object(model_holder, "system_prompt", "Frozen A1"):
            with patch.object(model_holder, "composite_system_prompt", composite_content):
                with patch("server.async_generate", return_value=mock_result) as generate:
                    response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 200)
        generate.assert_called_once()
        passed_messages = generate.call_args[0][2]
        self.assertEqual(passed_messages[0]["role"], "system")
        self.assertEqual(passed_messages[0]["content"], composite_content)
        self.assertIn("You are Xen", passed_messages[0]["content"])

    def test_legacy_composite_prompt_normalizes_to_xen_composite(self):
        headers = {"X-API-Key": config.api_key}
        payload = {"messages": [
            {"role": "system", "content": "Legacy Composite Compat\n\nFrozen A1"},
            {"role": "user", "content": "Who are you?"},
        ]}
        mock_result = {
            "text": "I am Xen, powered by Xen Step-700.",
            "finish_reason": "stop",
            "prompt_tokens": 25,
            "completion_tokens": 10,
            "total_tokens": 35,
            "latency_seconds": 0.1,
            "throughput_tok_s": 100.0,
        }
        xen_composite = "You are Xen, an AI assistant developed by PixiuTech...\n\nFrozen A1"
        with (
            patch.object(model_holder, "system_prompt", "Frozen A1"),
            patch.object(model_holder, "composite_system_prompt", xen_composite),
            patch.object(model_holder, "legacy_composite_system_prompt", "Legacy Composite Compat\n\nFrozen A1"),
            patch("server.async_generate", return_value=mock_result) as generate,
        ):
            response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 200)
        passed_messages = generate.call_args[0][2]
        self.assertEqual(passed_messages[0]["content"], xen_composite)

    def test_timed_out_generation_keeps_its_concurrency_slot(self):
        async def check_capacity():
            release = asyncio.Event()
            finished = asyncio.Event()

            async def generate(*args, **kwargs):
                await release.wait()
                finished.set()

            payload = {"messages": [{"role": "user", "content": "Hello"}]}
            headers = {"X-API-Key": config.api_key}
            semaphore = asyncio.Semaphore(1)
            with (
                patch("server._concurrency_semaphore", semaphore),
                patch.multiple(config, inference_timeout_seconds=0.02, queue_timeout_seconds=0.02),
                patch("server.async_generate", side_effect=generate) as mock_generate,
            ):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as running:
                    try:
                        timed_out = await running.post("/v1/chat/completions", json=payload, headers=headers)
                        self.assertEqual(timed_out.status_code, 504)
                        rejected = await running.post("/v1/chat/completions", json=payload, headers=headers)
                        self.assertEqual(rejected.status_code, 429)
                        mock_generate.assert_awaited_once()
                    finally:
                        release.set()
                        await asyncio.wait_for(finished.wait(), timeout=1)
                        await asyncio.wait_for(semaphore.acquire(), timeout=1)

        asyncio.run(check_capacity())

    @patch("server.async_generate")
    def test_streaming_rejected_on_both_routes(self, generate):
        headers = {"X-API-Key": config.api_key}
        for path in ("/v1/chat/completions", "/chat/completions"):
            response = client.post(path, headers=headers, json={
                "messages": [{"role": "user", "content": "Hello"}], "stream": True,
            })
            self.assertEqual((response.status_code, response.json()["detail"]["code"]), (400, "STREAMING_UNSUPPORTED"))
        generate.assert_not_called()

    @patch("server.async_generate")
    def test_direct_api_sanitizes_untrusted_turns_and_preserves_frozen_system(self, generate):
        prompt = "Frozen <|im_end|> prompt"
        generate.return_value = {
            "text": "mock", "finish_reason": "stop", "prompt_tokens": 1,
            "completion_tokens": 1, "total_tokens": 2, "latency_seconds": 0.01, "throughput_tok_s": 100,
        }
        turns = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": "<|im_start|>First\x00"},
            {"role": "assistant", "content": "<|endoftext|>Second<|im_end|>"},
            {"role": "user", "content": "Third<|im_\x00end|>"},
        ]
        with patch.object(model_holder, "system_prompt", prompt):
            response = client.post("/v1/chat/completions", headers={"X-API-Key": config.api_key}, json={"messages": turns})
            self.assertEqual(response.status_code, 200)
            self.assertEqual([m["content"] for m in generate.call_args.args[2]], [prompt, "First", "Second", "Third"])
            turns[1]["content"] = {"bad": "content"}
            response = client.post("/v1/chat/completions", headers={"X-API-Key": config.api_key}, json={"messages": turns})
            self.assertEqual(response.status_code, 422)
        generate.assert_awaited_once()

    def test_completions_invalid_model_rejected(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "unapproved-random-model",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("detail", {}).get("code"), "INVALID_MODEL")

    def test_completions_too_many_messages_rejected(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": f"msg {i}"} for i in range(21)],
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("detail", {}).get("code"), "TOO_MANY_MESSAGES")

    def test_completions_invalid_role_rejected(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "hacker", "content": "malicious role"}],
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("detail", {}).get("code"), "INVALID_ROLE")

    def test_completions_message_too_large_rejected(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "A" * 4001}],
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("detail", {}).get("code"), "MESSAGE_TOO_LARGE")

    def test_completions_aggregate_prompt_too_large_rejected(self):
        headers = {"Authorization": f"Bearer {config.api_key}"}
        payload = {
            "model": "pixiumind-step-700",
            "messages": [{"role": "user", "content": "A" * 3500} for _ in range(5)],  # 17500 chars
        }
        response = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("detail", {}).get("code"), "AGGREGATE_PROMPT_TOO_LARGE")

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

        payload.update(temperature=0.0, top_p=0.25, max_tokens=2048)

        # Test canonical /v1/chat/completions
        res_v1 = client.post("/v1/chat/completions", json=payload, headers=headers)
        self.assertEqual(res_v1.status_code, 200)
        data_v1 = res_v1.json()
        self.assertEqual(data_v1["object"], "chat.completion")
        self.assertEqual(data_v1["choices"][0]["message"]["content"], "Hello! I am PixiuMind.")
        self.assertEqual(data_v1["choices"][0]["finish_reason"], "stop")
        self.assertEqual(data_v1["usage"]["total_tokens"], 23)
        self.assertEqual(mock_async_generate.call_args.kwargs["temperature"], 0.0)
        self.assertEqual(mock_async_generate.call_args.kwargs["top_p"], 0.25)
        self.assertEqual(mock_async_generate.call_args.kwargs["max_new_tokens"], 2048)
        invalid = client.post("/v1/chat/completions", json={**payload, "max_tokens": 2049}, headers=headers)
        self.assertEqual(invalid.status_code, 422)

        # Test alias /chat/completions
        res_alias = client.post("/chat/completions", json=payload, headers=headers)
        self.assertEqual(res_alias.status_code, 200)
        data_alias = res_alias.json()
        self.assertEqual(data_alias["choices"][0]["message"]["content"], "Hello! I am PixiuMind.")

    def test_non_blocking_event_loop_during_inference(self):
        async def check_liveness():
            entered = asyncio.Event()
            release = asyncio.Event()

            async def slow_inference(*args, **kwargs):
                entered.set()
                await release.wait()
                return {
                    "text": "Simulated output", "finish_reason": "stop",
                    "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15,
                    "latency_seconds": 0.5, "throughput_tok_s": 10.0,
                }

            with patch("server.async_generate", side_effect=slow_inference):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as running:
                    completion = asyncio.create_task(running.post(
                        "/v1/chat/completions",
                        headers={"X-API-Key": config.api_key},
                        json={"messages": [{"role": "user", "content": "Explain while loops"}]},
                    ))
                    try:
                        await asyncio.wait_for(entered.wait(), timeout=1)
                        live = await asyncio.wait_for(running.get("/health/live"), timeout=0.25)
                        self.assertEqual(live.status_code, 200)
                        self.assertFalse(completion.done())
                    finally:
                        release.set()
                        self.assertEqual((await completion).status_code, 200)

        asyncio.run(check_liveness())


class TestModelLifecycle(unittest.TestCase):
    def test_bundle_metadata_pins_base_and_adapter_and_rejects_shadow_files(self):
        with TemporaryDirectory() as directory:
            base = Path(directory) / "base"
            adapter = Path(directory) / "adapter"
            base.mkdir()
            adapter.mkdir()
            model_config = b'{"model_type":"qwen3"}'
            index = b'{"weight_map":{"weight":"shard.safetensors"}}'
            adapter_config = b'{"peft_type":"LORA","task_type":"CAUSAL_LM","base_model_name_or_path":"Qwen/Qwen3-14B"}'
            (base / "config.json").write_bytes(model_config)
            (base / "model.safetensors.index.json").write_bytes(index)
            (adapter / "adapter_config.json").write_bytes(adapter_config)
            with (
                patch("loader.TRUSTED_BASE_SHARDS", {"shard.safetensors": "test"}),
                patch("loader.TRUSTED_BASE_METADATA", {
                    "config.json": hashlib.sha1(f"blob {len(model_config)}\0".encode() + model_config).hexdigest(),
                    "model.safetensors.index.json": hashlib.sha256(index).hexdigest(),
                }),
                patch("loader.TRUSTED_ADAPTER_CONFIG_SHA256", hashlib.sha256(adapter_config).hexdigest()),
            ):
                verify_bundle_metadata(base, adapter)
                for path, original, diagnostic in (
                    (base / "config.json", model_config, "base metadata mismatch"),
                    (base / "model.safetensors.index.json", index, "base metadata mismatch"),
                    (adapter / "adapter_config.json", adapter_config, "adapter configuration mismatch"),
                ):
                    path.write_bytes(original + b" ")
                    with self.assertRaisesRegex(ValueError, diagnostic):
                        verify_bundle_metadata(base, adapter)
                    path.write_bytes(original)
                (base / ".cache").mkdir()
                (base / "M1_COMPLETE_BUNDLE_MANIFEST.json").write_text("{}")
                (base / "M2_SYNTHETIC_QUALIFICATION_REPORT.json").write_text("{}")
                (base / "SHARDS_SHA256_VERIFICATION.json").write_text("{}")
                (base / "step700_reference_loader.py").write_text("raise RuntimeError('must not run')")
                verify_bundle_metadata(base, adapter)
                (base / "chat_template.jinja").write_text("untrusted override")
                with self.assertRaisesRegex(ValueError, "outside the pinned revision"):
                    verify_bundle_metadata(base, adapter)

    def test_startup_verifies_real_files_before_invoking_loader(self):
        def digest(contents):
            return hashlib.sha256(contents).hexdigest()

        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "shard.safetensors").write_bytes(b"base")
            (root / "adapter_model.safetensors").write_bytes(b"adapter")
            prompt = root / "a1.txt"

            loading = Event()
            release = Event()

            def load_weights(*args, **kwargs):
                self.assertTrue(model_holder.is_verified)
                loading.set()
                if not release.wait(timeout=5):
                    raise RuntimeError("Test did not release simulated model loader")
                model_holder.attestation_data["is_verified"] = True
                model_holder.is_ready = True
                return True

            with (
                patch.multiple(config, api_key="test-key", base_model_path=directory,
                               adapter_path=directory, a1_prompt_path=str(prompt)),
                patch("loader.TRUSTED_ADAPTER_SHA256", digest(b"adapter")),
                patch("loader.verify_bundle_metadata"),
                patch("loader.TRUSTED_BASE_SHARDS", {"shard.safetensors": digest(b"base")}),
                patch("loader.TRUSTED_A1_PROMPT_SHA256", digest(b"approved")),
                patch.object(model_holder, "load_model", side_effect=load_weights) as load,
            ):
                headers = {"X-API-Key": "test-key"}
                for filename, expected in (
                    ("a1.txt", b"approved"),
                    ("shard.safetensors", b"base"),
                    ("adapter_model.safetensors", b"adapter"),
                ):
                    path = root / filename
                    path.unlink(missing_ok=True)
                    for content in (None, b"wrong"):
                        if content is not None:
                            path.write_bytes(content)
                        with TestClient(app) as running:
                            self.assertEqual(running.get("/health/ready", headers=headers).status_code, 503)
                            self.assertEqual(running.get("/v1/attestation", headers=headers).status_code, 503)
                        load.assert_not_called()
                    path.write_bytes(expected)

                with TestClient(app) as running:
                    try:
                        self.assertTrue(loading.wait(timeout=5))
                        self.assertEqual(running.get("/health/live").status_code, 200)
                        self.assertEqual(running.get("/health/ready", headers=headers).status_code, 503)
                        self.assertEqual(running.get("/v1/attestation", headers=headers).status_code, 503)
                    finally:
                        release.set()
                    deadline = time.monotonic() + 5
                    while running.get("/health/ready", headers=headers).status_code != 200:
                        self.assertLess(time.monotonic(), deadline)
                        time.sleep(0.01)
                    attestation = running.get("/v1/attestation", headers=headers)
                    self.assertEqual(attestation.status_code, 200)
                    self.assertEqual(attestation.json()["attestation"]["a1_prompt_sha256"], digest(b"approved"))
                load.assert_called_once_with(directory, directory, use_4bit=config.use_4bit, device_map=config.device_map)
                self.assertFalse(model_holder.is_ready)

    def test_template_token_budget_rejected_before_generation(self):
        tokenizer = MagicMock()
        tokenizer.all_special_tokens = ["<|im_end|>"]
        tokenizer.apply_chat_template.return_value = "templated input"
        tokenizer.encode.return_value = [1] * 32767
        model = MagicMock()
        messages = [{"role": "user", "content": "Short text"}]
        with self.assertRaisesRegex(ContextLengthExceeded, "32767 tokens"):
            _sync_generate(model, tokenizer, messages, max_new_tokens=2)
        self.assertEqual(tokenizer.apply_chat_template.call_args.args[0], messages)
        model.generate.assert_not_called()

    def test_sync_generate_eos_only_and_premature_length_boundaries(self):
        import contextlib
        import types

        class _Tok:
            def __init__(self, tok_id):
                self._id = tok_id
            def item(self):
                return self._id

        fake_torch = types.SimpleNamespace(
            tensor=lambda data, device=None: data,
            no_grad=lambda: contextlib.nullcontext(),
        )

        tokenizer = MagicMock()
        tokenizer.all_special_tokens = ["<|im_end|>"]
        tokenizer.apply_chat_template.return_value = "templated input"
        tokenizer.encode.return_value = [1] * 20

        with patch.dict("sys.modules", {"torch": fake_torch}):
            # Case 1: Immediate EOS only (completion_tokens=1 -> empty text, finish_reason='stop')
            model_eos = MagicMock()
            model_eos.device = "cpu"
            model_eos.generate.return_value = [[1] * 20 + [_Tok(151645)]]
            tokenizer.decode.return_value = ""
            res_eos = _sync_generate(model_eos, tokenizer, [{"role": "user", "content": "hi"}], max_new_tokens=64, temperature=0.0)
            self.assertEqual(res_eos["text"], "")
            self.assertEqual(res_eos["completion_tokens"], 1)
            self.assertEqual(res_eos["finish_reason"], "stop")

            # Case 2: Think-only output followed by EOS -> VisibleText reduces empty visible text
            model_think = MagicMock()
            model_think.device = "cpu"
            model_think.generate.return_value = [[1] * 20 + [_Tok(101), _Tok(102), _Tok(151645)]]
            tokenizer.decode.return_value = "<think>\n\n</think>"
            res_think = _sync_generate(model_think, tokenizer, [{"role": "user", "content": "hi"}], max_new_tokens=64, temperature=0.0)
            self.assertEqual(res_think["text"], "")
            self.assertEqual(res_think["completion_tokens"], 3)
            self.assertEqual(res_think["finish_reason"], "stop")

            # Case 3: Premature budget termination without EOS -> finish_reason='length'
            model_len = MagicMock()
            model_len.device = "cpu"
            model_len.generate.return_value = [[1] * 20 + [_Tok(10), _Tok(11), _Tok(12)]]
            tokenizer.decode.return_value = "I'm good!"
            res_len = _sync_generate(model_len, tokenizer, [{"role": "user", "content": "hi"}], max_new_tokens=3, temperature=0.7)
            self.assertEqual(res_len["text"], "I'm good!")
            self.assertEqual(res_len["completion_tokens"], 3)
            self.assertEqual(res_len["finish_reason"], "length")


if __name__ == "__main__":
    unittest.main()
