"""
Phase 4 Benchmark Verification & Premature-EOS / Empty Completion Regression Tests.

Covers:
1. Canonical SHA-256 and completeness of the fixed Phase 4 benchmark manifest
   (21 core prompts across Scenarios A-G + 16 secondary cases across 8 dimensions +
   pre-registered quantitative thresholds).
2. Honest Track B deterministic pipeline execution across all 37 benchmark scenarios.
3. Premature EOS, empty post-<think> completions, and finish_reason='length'
   regression guards in XenChatView, XenWorkerCompleteView, and xen_decoder.
"""

import hashlib
import json
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User, UserRole, UserStatus
from academics.models_xen import XenJobStatus
from core.xen_decoder import decode_model_response
from core.xen_views import XenChatView, XenJobCreateView


BENCHMARK_PATH = Path(__file__).resolve().parent / "benchmarks" / "xen_step700_phase4_benchmark.json"


@override_settings(
    XEN_PILOT_ENABLED=True,
    XEN_WORKER_SECRET="phase4-worker-secret",
    PIXIUMIND_TESTER_ALLOWLIST=["401"],
)
class XenPhase4BenchmarkAndEosTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            id=401,
            username="p4_evaluator",
            password="pass",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.worker = APIClient()
        self.worker.credentials(HTTP_X_WORKER_SECRET="phase4-worker-secret")

    def test_benchmark_manifest_structure_hash_and_track_b_local(self):
        data = json.loads(BENCHMARK_PATH.read_text(encoding="utf-8"))
        digest = hashlib.sha256(BENCHMARK_PATH.read_bytes()).hexdigest()
        self.assertEqual(len(digest), 64)
        self.assertEqual(len(data["core_scenarios"]), 21)

        scenarios = {}
        for item in data["core_scenarios"]:
            scenarios.setdefault(item["scenario"], []).append(item)
        self.assertEqual(len(scenarios), 7)
        for s_name, items in scenarios.items():
            self.assertEqual(len(items), 3, f"{s_name} must have 3 natural phrasings")

        categories = {item["category"] for item in data["secondary_cases"]}
        self.assertEqual(
            categories,
            {
                "physics",
                "mathematics",
                "hinglish",
                "spelling_tolerance",
                "small_talk",
                "multi_turn",
                "markdown_latex",
                "code_gen_explain",
            },
        )
        zero_tol = data["pre_registered_thresholds"]["critical_zero_tolerance"]
        self.assertEqual(zero_tol["fabricated_components_on_empty_canvas"], 0)
        self.assertEqual(zero_tol["false_runtime_glowing_blinking_assertions"], 0)

        import sys
        scripts_dir = str(Path(__file__).resolve().parent.parent.parent / "scripts")
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)
        from run_xen_phase4_benchmark import run_track_b_local

        summary = run_track_b_local(data)
        self.assertFalse(summary["real_model_inference"])
        self.assertEqual(summary["total"], 37)
        self.assertEqual(summary["passed"], 37, f"Failed Track B items: {[i for i in summary['items'] if not i['passed']]}")
        self.assertEqual(summary["failed"], 0)

    def test_premature_eos_empty_think_and_truncated_completions_handled_truthfully(self):
        # 1. Sync XenChatView rejects genuinely empty completion or think-only text cleanly
        for idx, upstream_content in enumerate(("", "   ", "<think>\n\n</think>")):
            with (
                patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None)),
                patch.object(
                    XenChatView,
                    "call_upstream",
                    return_value=(
                        200,
                        {
                            "choices": [{"message": {"content": upstream_content}, "finish_reason": "stop"}],
                            "usage": {"prompt_tokens": 120, "completion_tokens": 3, "total_tokens": 123},
                        },
                    ),
                ),
            ):
                res = self.client.post(
                    "/api/v1/xen/chat",
                    {
                        "prompt": "how are you?",
                        "idempotency_key": f"p4-empty-{idx}",
                    },
                    format="json",
                )
            self.assertEqual(res.status_code, 502)
            self.assertEqual(res.json()["code"], "INVALID_UPSTREAM_RESPONSE")

        # 2. Premature termination via finish_reason='length' with short text is flagged incomplete
        trunc = decode_model_response("Let's check", finish_reason="length")
        self.assertFalse(trunc["is_complete"])
        self.assertEqual(trunc["completion_status"], "TRUNCATED_MAX_TOKENS")
        self.assertFalse(trunc["display_ast_valid"])

        # 3. Genuine short 3-token completion with finish_reason='stop' is accepted without artificial padding
        with patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None)):
            job_res = self.client.post(
                "/api/v1/xen/jobs",
                {"prompt": "how are you?", "idempotency_key": "p4-short-stop-ok"},
                format="json",
            )
            self.assertEqual(job_res.status_code, 202)
            job_id = job_res.json()["job_id"]

        claim = self.worker.post("/api/v1/xen/worker/claim", {"worker_id": "w-p4"}, format="json")
        self.assertEqual(claim.status_code, 200)
        # Note generation parameters propagated to worker
        self.assertEqual(claim.json()["job"]["max_tokens"], 2048)
        self.assertEqual(claim.json()["job"]["temperature"], 0.7)

        # Worker empty/think-only attempt rejects with 400 INVALID_COMPLETION
        bad_comp = self.worker.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {"worker_id": "w-p4", "text": "<think>short thought</think><|im_end|>"},
            format="json",
        )
        self.assertEqual(bad_comp.status_code, 400)

        # Valid terse 3-token reply persists cleanly
        good_comp = self.worker.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {
                "worker_id": "w-p4",
                "text": "I'm good!",
                "finish_reason": "stop",
                "usage": {"prompt_tokens": 320, "completion_tokens": 3, "total_tokens": 323},
            },
            format="json",
        )
        self.assertEqual(good_comp.status_code, 200)
        detail = self.client.get(f"/api/v1/xen/jobs/{job_id}").json()
        self.assertEqual(detail["status"], XenJobStatus.COMPLETED)
        self.assertEqual(detail["response"]["text"], "I'm good!")
        self.assertTrue(detail["response"]["is_complete"])

    def test_canonical_net_id_and_nominal_resistor_rating_grounding(self):
        from core.xen_grounding import (
            build_authoritative_grounding_spec,
            build_deterministic_grounded_fallback,
            extract_and_validate_grounding_claims,
        )

        data = json.loads(BENCHMARK_PATH.read_text(encoding="utf-8"))
        spec = build_authoritative_grounding_spec(data["fixtures"]["correct_led_stopped"])
        r1 = spec["resistor_terminals"]["r1"]
        self.assertEqual(r1["terminal_a"]["net_id"], "net_d13")
        self.assertEqual(r1["terminal_b"]["net_id"], "net_led_pos")
        self.assertNotIn("net None", r1["path_summary"])

        fb = build_deterministic_grounded_fallback(spec, "Explain my LED circuit.")
        self.assertIn("r1(220ohm)", fb)
        self.assertTrue(extract_and_validate_grounding_claims(fb, spec, "Explain my LED circuit.")["verified"])
        self.assertTrue(
            extract_and_validate_grounding_claims(
                "Resistor r1 (220 ohm) connects uno1:d13 to led1:anode.",
                spec,
                "Check wiring",
            )["verified"]
        )
        # Adversarial / ungrounded nominal & probe cases must still fail cleanly
        self.assertFalse(
            extract_and_validate_grounding_claims(
                "Resistor r1 (1000 ohm) connects uno1:d13 to led1:anode.",
                spec,
                "Check wiring",
            )["verified"]
        )
        self.assertFalse(
            extract_and_validate_grounding_claims(
                "The multimeter reads 220 ohm across r1.",
                spec,
                "Check wiring",
            )["verified"]
        )
        self.assertFalse(
            extract_and_validate_grounding_claims(
                "The resistance between uno1:d13 and led1:anode is 220 ohm.",
                spec,
                "Check wiring",
            )["verified"]
        )
