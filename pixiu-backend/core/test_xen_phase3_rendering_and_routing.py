"""
Phase 3 Regression Tests — Response Quality, Markdown/Entity Sanitization,
Streaming & Short-Completion Boundaries, Small-Talk vs Circuit Routing,
Multi-Turn Context Preservation, and Canonical Xen Identity.
"""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User, UserRole, UserStatus
from academics.models_xen import XenJob, XenJobStatus
from core.xen_decoder import decode_model_response, normalize_markdown_and_entities
from core.xen_intent import (
    XenResponseMode,
    build_xen_effective_prompt,
    is_circuit_specific_query,
    resolve_xen_response_mode,
)
from core.xen_views import COMPOSITE_SYSTEM_PROMPT, XenChatView, compact_xen_history


def _sample_circuit_env():
    return {
        "schema_version": "3.0",
        "session_id": "p3-sess",
        "circuit_revision": 4,
        "board": {"id": "arduino-uno", "partId": "uno1", "name": "Arduino Uno R3"},
        "parts": [
            {"id": "uno1", "type": "arduino-uno", "name": "Arduino Uno R3"},
            {"id": "r1", "type": "resistor", "props": {"resistance": 220}},
            {"id": "led1", "type": "led", "props": {"color": "red"}},
        ],
        "wires": [
            {"from": {"partId": "uno1", "pinId": "d5"}, "to": {"partId": "r1", "pinId": "a"}},
            {"from": {"partId": "r1", "pinId": "b"}, "to": {"partId": "led1", "pinId": "anode"}},
        ],
        "simulation": {"running": False, "status": "stopped"},
    }


@override_settings(
    XEN_PILOT_ENABLED=True,
    XEN_WORKER_SECRET="phase3-worker-secret",
    PIXIUMIND_TESTER_ALLOWLIST=["301"],
)
class XenPhase3RenderingAndRoutingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            id=301,
            username="p3_trainer",
            password="pass",
            role=UserRole.TRAINER,
            status=UserStatus.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.worker = APIClient()
        self.worker.credentials(HTTP_X_WORKER_SECRET="phase3-worker-secret")

    def test_small_talk_isolated_from_circuit_context_even_after_circuit_turns(self):
        circuit_history = [
            {"role": "user", "content": "Why is led1 not glowing?"},
            {"role": "assistant", "content": "led1 cathode (-) is not connected to Arduino GND."},
        ]
        env = _sample_circuit_env()
        for msg in (
            "Hi Xen",
            "Hello!",
            "How are you bro?",
            "Hey Xen, How are you bro, and introduce yourself lil bit",
            "Thank you",
            "Thanks a lot!",
            "Okay thank you",
            "Who are you?",
            "Bye",
        ):
            self.assertFalse(
                is_circuit_specific_query(msg, circuit_history, context_envelope=env),
                f"Expected small-talk query {msg!r} NOT to route as circuit",
            )
            eff = build_xen_effective_prompt(
                prompt=msg,
                format_mode=XenResponseMode.DEFAULT_EDUCATIONAL,
                context_envelope=env,
                history=circuit_history,
            )
            self.assertNotIn("[CYBERLAB GROUNDING DIRECTIVE:", eff)
            self.assertNotIn("[MISSION CONTEXT]", eff)

        # Sticky CODE_ONLY preference does not hijack casual social greetings
        mode, source = resolve_xen_response_mode(
            "How are you bro?",
            history=circuit_history,
            active_sticky_preference="CODE_ONLY",
        )
        self.assertEqual(mode, XenResponseMode.DEFAULT_EDUCATIONAL)
        self.assertEqual(source, "small_talk_default")

    def test_cyberlab_workspace_and_academic_routing_accuracy(self):
        env = _sample_circuit_env()
        circuit_history = [
            {"role": "user", "content": "Why is led1 not glowing?"},
            {"role": "assistant", "content": "Connect led1 cathode to Arduino GND."},
        ]
        self.assertTrue(is_circuit_specific_query("What are we building?", [], context_envelope=env))
        self.assertTrue(is_circuit_specific_query("done", [], context_envelope=env))
        self.assertTrue(is_circuit_specific_query("fixed it", [], context_envelope=env))
        self.assertTrue(is_circuit_specific_query("how to fix it", circuit_history, context_envelope=env))

        # Ohm's Law conceptual follow-up stays academic unless asking about hardware parts/circuit
        self.assertFalse(is_circuit_specific_query("What is Ohm's Law?", circuit_history, context_envelope=env))
        self.assertTrue(is_circuit_specific_query("Why does led1 need a resistor for Ohm's Law?", circuit_history, context_envelope=env))

    def test_multi_turn_history_preserves_general_threads_while_quarantining_ungrounded_claims(self):
        history = [
            {
                "role": "user",
                "content": "How does my circuit look?",
            },
            {
                "role": "assistant",
                "content": "Circuit Doctor snapshot: 100/100 (healthy). All connections intact!",
                "provenance": {"response_source": "xen_step700", "circuit_revision": 1, "grounding_verified": False},
            },
            {
                "role": "user",
                "content": "What is Kinetic Energy?",
            },
            {
                "role": "assistant",
                "content": "Kinetic energy is the energy of motion: $$\\mathrm{KE} = \\frac{1}{2}mv^2$$ where m is mass (in kg) and v is velocity (in m/s).",
                "provenance": {"response_source": "xen_step700", "circuit_revision": None, "grounding_verified": True},
            },
        ]
        compacted = compact_xen_history(history, XenResponseMode.DEFAULT_EDUCATIONAL)
        joined = " ".join(m["content"] for m in compacted)
        self.assertNotIn("100/100", joined)
        self.assertNotIn("All connections intact", joined)
        self.assertIn("\\frac{1}{2}mv^2", joined)

    def test_backend_markdown_and_entity_normalization_preserves_code_and_math(self):
        dirty = (
            "<think>internal notes</think>\n\n"
            "\\#\\# Conclusion&#x20;Here\n\n"
            "\\*\\*Result:\\*\\* Hello&#x20;world &amp;#x20;with \\(V = I \\times R\\) and \\[KE = \\frac{1}{2}mv^2\\].\n\n"
            "Multiply 2 \\* 3 = 6.\n\n"
            "```python\n"
            "# keep raw escapes and entity inside code block\n"
            "print('&#x20; \\*\\* <#>')\n"
            "print('<|im_end|>')\n"
            "```<|im_end|>"
        )
        res = decode_model_response(dirty, finish_reason="stop")
        txt = res["text"]
        self.assertTrue(res["is_complete"])
        self.assertNotIn("<think>", txt)
        self.assertNotIn("&#x20;with", txt)
        self.assertNotIn("&amp;#x20;", txt)
        self.assertIn("## Conclusion Here", txt)
        self.assertIn("**Result:** Hello world", txt)
        self.assertIn("$V = I \\times R$", txt)
        self.assertIn("$$KE = \\frac{1}{2}mv^2$$", txt)
        self.assertIn("2 \\* 3 = 6", txt)
        # Code block remains completely untouched (including &#x20; and literal <|im_end|>)
        self.assertIn("print('&#x20; \\*\\* <#>')", txt)
        self.assertIn("print('<|im_end|>')", txt)
        self.assertFalse(txt.endswith("<|im_end|>"))

        # Inline code escapes are preserved verbatim too
        self.assertEqual(normalize_markdown_and_entities("Use `&#x20;` cleanly&#x20;now."), "Use `&#x20;` cleanly now.")

    def test_empty_after_think_rejected_and_short_valid_reply_accepted(self):
        with patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None)):
            res = self.client.post(
                "/api/v1/xen/chat",
                {"prompt": "how are you?", "idempotency_key": "p3-short-1", "job_mode": True},
                format="json",
            )
            self.assertEqual(res.status_code, 202)
            job_id = res.json()["job_id"]

        claim = self.worker.post("/api/v1/xen/worker/claim", {"worker_id": "w-p3"}, format="json")
        self.assertEqual(claim.status_code, 200)
        self.assertEqual(claim.json()["job"]["id"], job_id)

        # Model output with ONLY <think>...</think> (empty visible answer) must be rejected cleanly
        empty_comp = self.worker.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {"worker_id": "w-p3", "text": "<think>\n\n</think><|im_end|>"},
            format="json",
        )
        self.assertEqual(empty_comp.status_code, 400)
        self.assertEqual(empty_comp.json()["code"], "INVALID_COMPLETION")

        # Valid 3-token short greeting completion is accepted and attributed to Xen
        ok_comp = self.worker.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {
                "worker_id": "w-p3",
                "text": "I'm good!",
                "usage": {"prompt_tokens": 220, "completion_tokens": 3, "total_tokens": 223},
            },
            format="json",
        )
        self.assertEqual(ok_comp.status_code, 200)
        detail = self.client.get(f"/api/v1/xen/jobs/{job_id}/chunks").json()
        self.assertEqual(detail["assistant"], "Xen")
        self.assertEqual(detail["response"]["text"], "I'm good!")
        self.assertEqual(detail["provenance"]["response_source"], "xen_step700")
        self.assertIn("identify yourself as Xen", COMPOSITE_SYSTEM_PROMPT)
        self.assertNotIn("identify yourself as 8square", COMPOSITE_SYSTEM_PROMPT)
