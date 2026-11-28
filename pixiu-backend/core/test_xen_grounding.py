"""
Phase 2 Comprehensive Grounding, History Integrity & Cross-Layer Diagnosis Tests.

Covers:
1. Deterministic endpoint-to-net lookup & independent resistor terminal A/B resolution
2. History contamination prevention & multi-revision isolation (rev 1 -> rev 2)
3. Post-generation grounding verifier (all failure classes + negation & suggestion handling)
4. Sync (XenChatView) and Async (XenWorkerCompleteView) single constrained retry &
   deterministic fail-closed fallback + unsupported claim tracking
5. Cross-layer LED diagnosis (Layers A-F) & full 5-turn conversation replay across
   empty, correct (stopped & running), and deliberately broken fixtures (plus arbitrary pin fixtures)
6. Academic STEM isolation even when CyberLab workspace context is attached
"""

import json
from unittest.mock import patch
import uuid

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User, UserRole, UserStatus
from academics.models_xen import XenJob, XenJobStatus
from core.xen_grounding import (
    build_authoritative_grounding_spec,
    build_constrained_regeneration_prompt,
    build_deterministic_grounded_fallback,
    extract_and_validate_grounding_claims,
)
from core.xen_intent import (
    XenResponseMode,
    build_xen_effective_prompt,
    format_context_envelope,
    is_circuit_specific_query,
    sanitize_context_envelope,
)
from core.xen_views import XenChatView, compact_xen_history


def _make_empty_env(session_id="p2-sess", rev=1):
    return {
        "schema_version": "3.0",
        "session_id": session_id,
        "circuit_revision": rev,
        "interaction_revision": 0,
        "state_revision": rev,
        "board": None,
        "components": [],
        "connections": [],
        "netlist": [],
        "simulation": {"running": False, "paused": False, "status": "ready", "run_time_s": 0},
        "diagnostics": {
            "health_status": "empty",
            "health_score": None,
            "critical_count": 0,
            "warning_count": 0,
            "issues": [],
        },
        "runtime_status": {"component_count": 0, "wire_count": 0, "is_empty": True},
    }


def _make_led_circuit_env(
    *,
    session_id="p2-sess",
    rev=2,
    phys_pin="d9",
    code_pin="5",
    running=False,
    led_level=0.0,
    led_ma=0.0,
    broken_missing_gnd=False,
):
    phys_pin_l = phys_pin.lower()
    wires = [
        {
            "id": "w1",
            "from_part_id": "uno",
            "from_pin_id": phys_pin_l,
            "to_part_id": "r1",
            "to_pin_id": "a",
            "from": f"uno:{phys_pin_l}",
            "to": "r1:a",
            "status": "complete",
            "net_id": 1,
            "net_name": phys_pin_l.upper(),
        },
        {
            "id": "w2",
            "from_part_id": "r1",
            "from_pin_id": "b",
            "to_part_id": "led1",
            "to_pin_id": "anode",
            "from": "r1:b",
            "to": "led1:anode",
            "status": "complete",
            "net_id": 2,
            "net_name": "N2",
        },
    ]
    netlist = [
        {"net_id": 1, "name": phys_pin_l.upper(), "is_power_rail": False, "is_ground_rail": False, "pin_keys": [f"uno:{phys_pin_l}", "r1:a"]},
        {"net_id": 2, "name": "N2", "is_power_rail": False, "is_ground_rail": False, "pin_keys": ["r1:b", "led1:anode"]},
    ]
    issues = []
    if not broken_missing_gnd:
        wires.append({
            "id": "w3",
            "from_part_id": "led1",
            "from_pin_id": "cathode",
            "to_part_id": "uno",
            "to_pin_id": "gnd",
            "from": "led1:cathode",
            "to": "uno:gnd",
            "status": "complete",
            "net_id": 3,
            "net_name": "GND",
        })
        netlist.append({"net_id": 3, "name": "GND", "is_power_rail": False, "is_ground_rail": True, "nominal_voltage": 0.0, "pin_keys": ["led1:cathode", "uno:gnd"]})
        health_status = "healthy"
        health_score = 100
        critical = 0
    else:
        issues.append({
            "rule_id": "open-led-cathode",
            "severity": "critical",
            "title": "Open Circuit on LED Cathode",
            "message": "led1:cathode is disconnected from Ground (GND).",
        })
        health_status = "danger"
        health_score = 45
        critical = 1

    return {
        "schema_version": "3.0",
        "session_id": session_id,
        "circuit_revision": rev,
        "interaction_revision": 1,
        "state_revision": rev + 1,
        "board": {"id": "arduino-uno", "part_id": "uno", "name": "Arduino Uno R3", "logic_voltage": 5.0},
        "components": [
            {"id": "uno", "type": "arduino-uno", "name": "Arduino Uno R3", "category": "board", "props": {}},
            {"id": "r1", "type": "resistor", "name": "220Ω Resistor", "category": "passive", "props": {"resistance": 220}},
            {"id": "led1", "type": "led", "name": "Red LED", "category": "output", "props": {"color": "red"}},
        ],
        "connections": wires,
        "netlist": netlist,
        "simulation": {
            "running": running,
            "paused": False,
            "status": "running" if running else "ready",
            "run_time_s": 2.4 if running else 0.0,
            "component_runtime": {
                "led1": {"level": led_level, "currentMa": led_ma, "burnt": False},
            },
        },
        "blockly_context": {
            "has_program": bool(code_pin),
            "pin_bindings": [{"pin_id": code_pin, "mode": "OUTPUT", "snippet": f'<field name="PIN">{code_pin}</field>'}] if code_pin else [],
            "code": f"void loop() {{ digitalWrite({code_pin}, HIGH); delay(500); digitalWrite({code_pin}, LOW); delay(500); }}" if code_pin else "",
        },
        "diagnostics": {
            "health_status": health_status,
            "health_score": health_score,
            "critical_count": critical,
            "warning_count": 0,
            "issues": issues,
        },
        "runtime_status": {
            "component_count": 3,
            "wire_count": len(wires),
            "is_empty": False,
        },
    }


class Phase2GroundingUnitTests(TestCase):
    def test_deterministic_resistor_terminal_lookup_and_arbitrary_pins(self):
        """
        Priority 1: Resistor terminal_a and terminal_b must resolve independently and
        deterministically across repeated calls and arbitrary pin configurations (D7, D9, etc.).
        """
        for phys, code in (("d9", "5"), ("d7", "12"), ("d4", "8")):
            env = _make_led_circuit_env(phys_pin=phys, code_pin=code, running=False)
            sanitized = sanitize_context_envelope(env)
            circuit = sanitized["circuit"]
            self.assertEqual(len(circuit["resistor_terminals"]), 1)
            rt = circuit["resistor_terminals"][0]
            self.assertIn(f"uno:{phys}", rt["terminal_a"]["direct_peers"])
            self.assertNotIn("led1:anode", rt["terminal_a"]["direct_peers"])
            self.assertIn("led1:anode", rt["terminal_b"]["direct_peers"])
            self.assertNotIn(f"uno:{phys}", rt["terminal_b"]["direct_peers"])

            # Cross-layer LED separates wiring from code mismatch regardless of pin numbers
            cl = circuit["cross_layer_led"][0]
            self.assertTrue(cl["topology_ok"])
            self.assertTrue(cl["safety_ok"])
            self.assertEqual(cl["physical_pins"], [phys])
            expected_code = f"d{code}" if code.isdigit() else code.lower()
            self.assertEqual(cl["code_pins"], [expected_code])
            self.assertFalse(cl["matches_physical_pin"])
            self.assertEqual(cl["observed_state"], "stopped_not_running")

            # Format context envelope preserves resistor_terminals, cross_layer_led & simulation under tight cap
            formatted = format_context_envelope(sanitized, max_chars=2400)
            self.assertLessEqual(len(formatted), 2400)
            self.assertIn("resistor_terminals", formatted)
            self.assertIn("cross_layer_led", formatted)
            self.assertIn("running", formatted)

    def test_grounding_verifier_checks_all_claim_domains(self):
        """Priority 3 & 4: Verifier catches false claims without false-flagging negations/suggestions/code-vs-wire facts."""
        # A. Empty canvas checks
        empty_spec = build_authoritative_grounding_spec(_make_empty_env(rev=1))
        self.assertFalse(extract_and_validate_grounding_claims("All connections are intact. Health score is 100/100.", empty_spec)["verified"])
        self.assertFalse(extract_and_validate_grounding_claims("I see an Arduino Uno and LED connected to D13.", empty_spec)["verified"])
        self.assertFalse(extract_and_validate_grounding_claims("The multimeter reads 5.0V on the LED anode.", empty_spec)["verified"])
        # Valid truthful empty canvas response + beginner guidance MUST pass
        good_empty = (
            "Your canvas is currently Empty (0 components and 0 wires; health score is N/A, not 100/100). "
            "To get started, place an Arduino Uno, a 220-ohm resistor, and an LED on the workspace."
        )
        self.assertTrue(extract_and_validate_grounding_claims(good_empty, empty_spec)["verified"])

        # B. D9 wired / D5 code / simulator stopped checks
        d9_d5_spec = build_authoritative_grounding_spec(_make_led_circuit_env(phys_pin="d9", code_pin="5", running=False))
        # Pin hallucination
        self.assertFalse(extract_and_validate_grounding_claims("Your resistor r1 is connected to D5.", d9_d5_spec)["verified"])
        # Terminal A/B swap
        self.assertFalse(extract_and_validate_grounding_claims("r1 terminal a is connected to led1:anode.", d9_d5_spec)["verified"])
        self.assertFalse(extract_and_validate_grounding_claims("r1 terminal b is connected to uno:d9.", d9_d5_spec)["verified"])
        # Runtime hallucination while simulation stopped
        self.assertFalse(extract_and_validate_grounding_claims("The LED is currently blinking every 500ms.", d9_d5_spec)["verified"])
        self.assertFalse(extract_and_validate_grounding_claims("The simulation is running and the LED is glowing.", d9_d5_spec)["verified"])
        # Unknown component ID
        self.assertFalse(extract_and_validate_grounding_claims("led2 is connected to GND.", d9_d5_spec)["verified"])

        # Valid cross-layer grounded response + negation MUST pass
        good_d9_d5 = (
            "The physical wiring is valid: r1 terminal a connects to uno:d9, and r1 terminal b connects to led1:anode. "
            "However, your Blockly code targets pin D5 rather than D9, and the simulation is not running yet so the LED is not blinking. "
            "Start the simulation after moving the wire to D5 (or update code to D9) so it will blink."
        )
        res_good = extract_and_validate_grounding_claims(good_d9_d5, d9_d5_spec)
        self.assertTrue(res_good["verified"], f"Unexpected violations: {res_good['unsupported_claims']}")

    def test_history_integrity_quarantines_ungrounded_error_and_stale_revisions(self):
        """Priority 2: Stale rev 1 claims and poisoned hallucinated claims never remain authoritative at rev 2."""
        rev2_env = _make_led_circuit_env(phys_pin="d9", code_pin="5", rev=2, running=False)
        rev2_spec = build_authoritative_grounding_spec(rev2_env)

        poisoned_history = [
            {"role": "user", "content": "Check my circuit"},
            {
                "role": "assistant",
                "content": "Connections are intact! Health score 100/100 and resistor r1 is connected to D5.",
                "provenance": {"response_source": "local_fallback", "circuit_revision": 1, "grounding_verified": False},
            },
            {"role": "user", "content": "done"},
            {
                "role": "assistant",
                "content": "API Error",
                "provenance": {"response_source": "error", "circuit_revision": 1},
            },
            {"role": "user", "content": "Check my resistor pin again"},
            {
                "role": "assistant",
                "content": "Your canvas is empty and r1 connects to D5, and the LED is blinking.",
                "provenance": {"response_source": "xen_step700", "circuit_revision": 1, "grounding_verified": True},
            },
        ]

        compacted = compact_xen_history(
            poisoned_history,
            XenResponseMode.DEFAULT_EDUCATIONAL,
            current_circuit_revision=2,
            current_spec=rev2_spec,
        )
        joined = "\n".join(m["content"] for m in compacted)
        # Rejected grounding_verified=False and error turns must be excluded
        self.assertNotIn("API Error", joined)
        self.assertNotIn("Connections are intact", joined)
        self.assertNotIn("100/100", joined)
        # Stale / contradicted factual claims ("connected to D5", "LED is blinking") scrubbed/quarantined
        self.assertNotIn("r1 connects to D5", joined)
        self.assertNotIn("LED is blinking", joined)
        self.assertIn("rev=2", joined)

    def test_done_prompt_never_fabricates_empty_circuit_facts(self):
        """Sending 'done' on an empty canvas keeps empty grounding and flags hallucinated success."""
        empty_env = _make_empty_env(rev=3)
        hist = [
            {"role": "user", "content": "Check my circuit"},
            {"role": "assistant", "content": "Your workspace canvas is currently empty (0 components, 0 wires). Place an Arduino Uno first."},
        ]
        self.assertTrue(is_circuit_specific_query("done", hist, context_envelope=empty_env))
        eff = build_xen_effective_prompt("done", XenResponseMode.DEFAULT_EDUCATIONAL, context_envelope=empty_env, history=hist)
        self.assertIn("0 components", eff)
        spec = build_authoritative_grounding_spec(empty_env)
        v_check = extract_and_validate_grounding_claims("Great! I see your Arduino Uno and LED are now wired with 100/100 health score.", spec, "done")
        self.assertFalse(v_check["verified"])
        self.assertGreaterEqual(len(v_check["unsupported_claims"]), 2)


@override_settings(
    XEN_PILOT_ENABLED=True,
    PIXIUMIND_TESTER_ALLOWLIST=["401"],
    XEN_WORKER_SECRET="test-worker-secret",
)
class Phase2EndToEndGroundingAndReplayTests(TestCase):
    def setUp(self):
        self.limiter_patch = patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None))
        self.limiter_patch.start()
        self.addCleanup(self.limiter_patch.stop)
        self.trainer = User.objects.create_user(
            id=401,
            username="p2_trainer",
            email="p2trainer@pixiutech.com",
            password="pass",
            role=UserRole.TRAINER,
            status=UserStatus.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.trainer)
        self.worker = APIClient()
        self.worker.credentials(HTTP_X_WORKER_SECRET="test-worker-secret")

    def test_sync_chat_constrained_retry_succeeds_then_fail_closed_fallback(self):
        """Priority 3: Sync XenChatView retries once on hallucination; if retry succeeds uses Xen; if still ungrounded fails closed deterministically."""
        env = _make_led_circuit_env(phys_pin="d9", code_pin="5", rev=5, running=False)

        # Case 1: Attempt 1 hallucinates D5 + blinking, Attempt 2 fixes -> xen_step700 with retry_attempted=True
        with patch.object(XenChatView, "call_upstream") as up:
            up.side_effect = [
                (200, {
                    "worker_id": "sync-w1",
                    "choices": [{"message": {"content": "r1 is connected to D5 and the LED is blinking!"}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 20, "completion_tokens": 12, "total_tokens": 32},
                }),
                (200, {
                    "worker_id": "sync-w1",
                    "choices": [{"message": {"content": "r1 terminal a is connected to uno:d9 and terminal b connects to led1:anode. Code targets D5 and simulation is not running yet."}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 30, "completion_tokens": 24, "total_tokens": 54},
                }),
            ]
            r = self.client.post(
                "/api/v1/xen/chat",
                {"prompt": "Check resistor connection and blinking", "idempotency_key": f"sync-retry-ok-{uuid.uuid4().hex[:8]}", "context_envelope": env},
                format="json",
            )
            self.assertEqual(r.status_code, status.HTTP_200_OK)
            self.assertEqual(up.call_count, 2)
            # Ensure retry prompt carried constrained correction header
            retry_msgs = up.call_args_list[1].kwargs["payload"]["messages"]
            self.assertIn("GROUNDING CORRECTION REQUIRED", retry_msgs[-1]["content"])
            self.assertEqual(r.data["provenance"]["response_source"], "xen_step700")
            gv = r.data["grounding_verification"]
            self.assertTrue(gv["retry_attempted"])
            self.assertFalse(gv["fallback_applied"])
            self.assertTrue(gv["model_verified"])
            self.assertGreaterEqual(len(gv["unsupported_claims"]), 2)
            self.assertIn("uno:d9", r.data["response"]["text"].lower())

        # Case 2: Both attempts hallucinate -> deterministic fail-closed fallback
        with patch.object(XenChatView, "call_upstream") as up2:
            up2.return_value = (200, {
                "worker_id": "sync-w1",
                "choices": [{"message": {"content": "Everything is connected intact (100/100). r1 terminal a is connected to led1:anode and D5 is blinking."}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 20, "completion_tokens": 18, "total_tokens": 38},
            })
            r2 = self.client.post(
                "/api/v1/xen/chat",
                {"prompt": "Where does resistor r1 connect?", "idempotency_key": f"sync-fb-{uuid.uuid4().hex[:8]}", "context_envelope": env},
                format="json",
            )
            self.assertEqual(r2.status_code, status.HTTP_200_OK)
            self.assertEqual(up2.call_count, 2)
            self.assertEqual(r2.data["provenance"]["response_source"], "local_fallback")
            self.assertEqual(r2.data["provenance"]["fallback_reason"], "GROUNDING_VERIFICATION_FAILED")
            gv2 = r2.data["grounding_verification"]
            self.assertTrue(gv2["retry_attempted"])
            self.assertTrue(gv2["fallback_applied"])
            self.assertFalse(gv2["model_verified"])
            self.assertGreaterEqual(len(gv2["unsupported_claims"]), 2)
            reply_txt = r2.data["response"]["text"]
            self.assertIn("d9", reply_txt.lower())
            self.assertIn("D5", reply_txt)
            self.assertNotIn("D5 is blinking", reply_txt)

    def test_async_worker_requeue_once_and_fail_closed_with_provenance(self):
        """Priority 3 Async: XenWorkerCompleteView requeues ungrounded attempt 1, fails closed on attempt 2."""
        env = _make_empty_env(session_id="async-g-sess", rev=2)
        idem = f"async-g-{uuid.uuid4().hex[:8]}"
        q_res = self.client.post(
            "/api/v1/xen/jobs",
            {"prompt": "done", "idempotency_key": idem, "context_envelope": env},
            format="json",
        )
        self.assertEqual(q_res.status_code, status.HTTP_202_ACCEPTED)
        job_id = q_res.data["job_id"]

        c1 = self.worker.post("/api/v1/xen/worker/claim", {"worker_id": "w-gpu-1"}, format="json")
        self.assertEqual(c1.data["job"]["id"], job_id)

        # Attempt 1 fails grounding (claims 100/100 on empty canvas) -> requeues
        comp1 = self.worker.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {
                "worker_id": "w-gpu-1",
                "choices": [{"message": {"content": "Your circuit is healthy with a 100/100 health score."}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 40, "completion_tokens": 12, "total_tokens": 52},
            },
            format="json",
        )
        self.assertEqual(comp1.status_code, status.HTTP_200_OK)
        self.assertEqual(comp1.data["status"], "requeued_for_retry")
        self.assertEqual(comp1.data["reason"], "grounding_verification")
        self.assertGreaterEqual(len(comp1.data["unsupported_claims"]), 1)

        # Attempt 2 claim receives constrained retry prompt <= 4000 chars
        c2 = self.worker.post("/api/v1/xen/worker/claim", {"worker_id": "w-gpu-1"}, format="json")
        self.assertEqual(c2.data["job"]["id"], job_id)
        self.assertIn("GROUNDING CORRECTION REQUIRED", c2.data["job"]["prompt"])
        self.assertLessEqual(len(c2.data["job"]["prompt"]), 4000)

        # Attempt 2 STILL hallucinates -> fails closed to deterministic empty template
        comp2 = self.worker.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {
                "worker_id": "w-gpu-1",
                "choices": [{"message": {"content": "All connections are intact on your Arduino Uno!"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 60, "completion_tokens": 10, "total_tokens": 70},
            },
            format="json",
        )
        self.assertEqual(comp2.status_code, status.HTTP_200_OK)
        self.assertEqual(comp2.data["status"], "completed")

        chunks_res = self.client.get(f"/api/v1/xen/jobs/{job_id}/chunks")
        detail_res = self.client.get(f"/api/v1/xen/jobs/{job_id}")
        for res_view in (chunks_res, detail_res):
            self.assertEqual(res_view.data["provenance"]["response_source"], "local_fallback")
            self.assertEqual(res_view.data["provenance"]["fallback_reason"], "GROUNDING_VERIFICATION_FAILED")
            gv = res_view.data["grounding_verification"]
            self.assertTrue(gv["retry_attempted"])
            self.assertTrue(gv["fallback_applied"])
            self.assertFalse(gv["model_verified"])
            self.assertGreaterEqual(len(gv["unsupported_claims"]), 2)
            self.assertIn("Empty", res_view.data["response"]["text"])
            self.assertIn("N/A", res_view.data["response"]["text"])

    def test_multi_fixture_5_turn_conversation_replay_and_academic_isolation(self):
        """
        Replay the exact multi-turn conversation pattern across empty, correct (stopped & running),
        broken D9-vs-D5, and broken missing-GND fixtures, plus academic query isolation.
        """
        conversation_turns = [
            "Hi Xen",
            "Can you check my circuit?",
            "done",
            "Which pins do the resistor terminals connect to?",
            "Is the LED blinking right now?",
        ]

        fixtures = [
            ("empty", _make_empty_env(session_id="replay-empty", rev=1)),
            ("correct_stopped", _make_led_circuit_env(session_id="replay-ok-stop", rev=2, phys_pin="d9", code_pin="9", running=False)),
            ("correct_running_lit", _make_led_circuit_env(session_id="replay-ok-run", rev=3, phys_pin="d9", code_pin="9", running=True, led_level=1.0, led_ma=13.6)),
            ("broken_code_pin_d9_vs_d5", _make_led_circuit_env(session_id="replay-pin-swap", rev=4, phys_pin="d9", code_pin="5", running=True, led_level=0.0, led_ma=0.0)),
            ("broken_missing_gnd", _make_led_circuit_env(session_id="replay-no-gnd", rev=5, phys_pin="d9", code_pin="9", running=True, broken_missing_gnd=True)),
        ]

        for fx_name, env in fixtures:
            history = []
            # Poison the simulated LLM on EVERY turn to verify enforcement fail-closes across the entire replay
            poisoned_llm = (
                200,
                {
                    "worker_id": "adversarial-replay",
                    "choices": [{
                        "message": {
                            "content": "Connections are intact (100/100)! r1 connects to D5 and the LED is blinking!"
                        },
                        "finish_reason": "stop",
                    }],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 16, "total_tokens": 26},
                },
            )
            for idx, user_msg in enumerate(conversation_turns):
                with patch.object(XenChatView, "call_upstream", return_value=poisoned_llm):
                    res = self.client.post(
                        "/api/v1/xen/chat",
                        {
                            "prompt": user_msg,
                            "history": history,
                            "idempotency_key": f"rep-{fx_name}-{idx}-{uuid.uuid4().hex[:6]}",
                            "context_envelope": env,
                        },
                        format="json",
                    )
                self.assertEqual(res.status_code, status.HTTP_200_OK)
                txt = res.data["response"]["text"]

                if idx == 0:
                    # Pure greeting does NOT treat greeting as circuit query
                    self.assertNotIn("grounding_verification", res.data)
                else:
                    # Circuit queries ("check", "done", "resistor", "blinking") MUST fail-close accurately for every fixture
                    gv = res.data["grounding_verification"]
                    if fx_name == "empty":
                        self.assertTrue(gv["fallback_applied"])
                        self.assertIn("Empty", txt)
                        self.assertIn("N/A", txt)
                        self.assertNotIn("100/100", txt)
                    elif fx_name == "correct_stopped":
                        self.assertTrue(gv["fallback_applied"])
                        self.assertIn("d9", txt.lower())
                        self.assertIn("not running", txt.lower())
                        self.assertIn("terminal a", txt.lower().replace("a->", "terminal a->"))
                    elif fx_name == "correct_running_lit":
                        # Running & illuminated: D5 hallucination still caught!
                        self.assertTrue(gv["fallback_applied"])
                        self.assertIn("d9", txt.lower())
                        self.assertIn("illuminated", txt.lower())
                    elif fx_name == "broken_code_pin_d9_vs_d5":
                        self.assertTrue(gv["fallback_applied"])
                        self.assertIn("d9", txt.lower())
                        self.assertIn("D5", txt)
                        self.assertIn("off_code_mismatch", txt)
                    elif fx_name == "broken_missing_gnd":
                        self.assertTrue(gv["fallback_applied"])
                        self.assertIn("45/100", txt)
                        self.assertIn("danger", txt.lower())

                history.append({"role": "user", "content": user_msg})
                history.append({
                    "role": "assistant",
                    "content": txt,
                    "provenance": {
                        "response_source": res.data["provenance"]["response_source"],
                        "circuit_revision": env["circuit_revision"],
                        "grounding_verified": True,
                    },
                })

            # Verify general STEM query inside CyberLab remains cleanly isolated from circuit verifier
            with patch.object(XenChatView, "call_upstream", return_value=(
                200,
                {
                    "worker_id": "replay-w",
                    "choices": [{"message": {"content": "Kinetic energy is $KE = \\frac{1}{2}mv^2$."}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 12, "completion_tokens": 14, "total_tokens": 26},
                },
            )):
                acad = self.client.post(
                    "/api/v1/xen/chat",
                    {
                        "prompt": "Explain kinetic energy formula",
                        "history": history,
                        "idempotency_key": f"acad-{fx_name}-{uuid.uuid4().hex[:6]}",
                        "context_envelope": env,
                    },
                    format="json",
                )
                self.assertEqual(acad.status_code, status.HTTP_200_OK)
                self.assertNotIn("grounding_verification", acad.data)
                self.assertEqual(acad.data["provenance"]["response_source"], "xen_step700")
                self.assertIn("Kinetic energy", acad.data["response"]["text"])

    def test_multi_revision_evolution_same_circuit_stale_history_cannot_override(self):
        """Testing same circuit across rev 1 (broken D5 mismatch) -> rev 2 (repaired D9 running & glowing)."""
        rev1_env = _make_led_circuit_env(session_id="evolve-1", rev=1, phys_pin="d9", code_pin="5", running=True, led_level=0.0, led_ma=0.0)
        with patch.object(XenChatView, "call_upstream", return_value=(
            200,
            {
                "worker_id": "w1",
                "choices": [{
                    "message": {
                        "content": "r1 terminal a connects to uno:d9, r1 terminal b connects to led1:anode. Code targets pin D5 rather than D9, so LED is off_code_mismatch."
                    },
                    "finish_reason": "stop",
                }],
                "usage": {"prompt_tokens": 20, "completion_tokens": 25, "total_tokens": 45},
            },
        )):
            t1 = self.client.post(
                "/api/v1/xen/chat",
                {"prompt": "Check why LED is off", "idempotency_key": f"e1-{uuid.uuid4().hex[:6]}", "context_envelope": rev1_env},
                format="json",
            )
            self.assertEqual(t1.status_code, status.HTTP_200_OK)
            self.assertIn("D5", t1.data["response"]["text"])

        # Now user fixes code pin to D9 (rev=2), starts simulation -> LED illuminated!
        # Even with rev=1 D5 history passed, backend must scrub stale claims & report rev=2 accurately.
        rev2_env = _make_led_circuit_env(session_id="evolve-1", rev=2, phys_pin="d9", code_pin="9", running=True, led_level=1.0, led_ma=13.6)
        hist_from_rev1 = [
            {"role": "user", "content": "Check why LED is off"},
            {
                "role": "assistant",
                "content": "Code targets pin D5 rather than D9, and LED is off.",
                "provenance": {"response_source": "xen_step700", "circuit_revision": 1, "grounding_verified": True},
            },
        ]
        with patch.object(XenChatView, "call_upstream", return_value=(
            200,
            {
                "worker_id": "w1",
                "choices": [{
                    "message": {
                        "content": "At revision 2, r1 terminal a connects to uno:d9 and terminal b connects to led1:anode, matching code pin D9, and the LED is illuminated."
                    },
                    "finish_reason": "stop",
                }],
                "usage": {"prompt_tokens": 20, "completion_tokens": 24, "total_tokens": 44},
            },
        )) as mock_up:
            t2 = self.client.post(
                "/api/v1/xen/chat",
                {"prompt": "Is the LED illuminated now?", "history": hist_from_rev1, "idempotency_key": f"e2-{uuid.uuid4().hex[:6]}", "context_envelope": rev2_env},
                format="json",
            )
            self.assertEqual(t2.status_code, status.HTTP_200_OK)
            self.assertFalse(t2.data["grounding_verification"]["fallback_applied"])
            sent_history = mock_up.call_args.kwargs["payload"]["messages"][1:-1]
            self.assertIn("superseded", sent_history[-1]["content"].lower())
            self.assertNotIn("targets pin D5", sent_history[-1]["content"])
            self.assertEqual(t2.data["provenance"]["circuit_revision"], 2)


class NumericGroundingIdentityTests(TestCase):
    def spec(self, readings=(), *, d5_on_rail=False, solved=True, reported_current=True, scope=None):
        env = _make_led_circuit_env(running=True, led_ma=12.34)
        env["components"] += [
            {"id": "r2", "type": "resistor", "props": {"resistance": 470}},
            {"id": "r3", "type": "resistor", "props": {"resistance": 220}},
        ]
        env["netlist"].extend([
            {"net_id": 4, "pin_keys": ["uno:5v", "r2:a"] + (["uno:d5"] if d5_on_rail else []), "is_power": True},
            {"net_id": 5, "pin_keys": ["r2:b"] + ([] if d5_on_rail else ["uno:d5"])},
        ])
        env["netlist"][0]["pin_keys"].append("r3:a")
        env["netlist"][1]["pin_keys"].append("r3:b")
        if solved:
            for net, voltage in zip(env["netlist"], (4.25, 1.9, 0, 5, 2.5)):
                net.update(solved_voltage=voltage, is_floating=False, is_conflicted=False)
        if not reported_current:
            env["simulation"]["component_runtime"]["led1"].pop("currentMa")
        env["readings"] = list(readings)
        if scope is not None:
            env["scope"] = scope
        return build_authoritative_grounding_spec(env)

    @staticmethod
    def meter(value=5, a="uno:v5", b="uno:ground", **fields):
        return {"instrument": "multimeter", "mode": "voltage", "probeA": a, "probeB": b,
                "value": value, "unit": "V", "source": "simulated", "state": "available", **fields}

    def assert_numeric(self, spec, clause, accepted):
        result = extract_and_validate_grounding_claims(clause, spec)
        self.assertEqual(result["verified"], accepted, result)
        self.assertIn(
            ("measurements", "supported" if accepted else "unsupported"),
            {(claim["domain"], claim["status"]) for claim in result["claim_ledger"]}, clause,
        )
        return result

    def test_unrelated_d5_does_not_borrow_5v_but_same_net_alias_passes(self):
        off = self.spec([self.meter()])
        on = self.spec([self.meter()], d5_on_rail=True)
        for sentence in ("D5 is at 5 V.", "The DMM reads 5 volts on uno:GPIO5.",
                         "The multimeter reads 5 V between uno:D5 and GND."):
            with self.subTest(sentence=sentence):
                self.assert_numeric(off, sentence, False)
                self.assert_numeric(on, sentence, True)
        self.assert_numeric(on, "The DMM reads 5 V on D99.", False)
        self.assert_numeric(on, "The DMM reads 5 V on pin 99.", False)
        self.assert_numeric(off, "The DMM reads **5** V, on `D5`.", False)
        self.assert_numeric(off, "The DMM reads 5 V between 5V and GND.", True)
        self.assert_numeric(off, "D9 is at 4.25 V and D5 is at 5 V.", False)
        structural = extract_and_validate_grounding_claims("r1 is connected to D5.", off)
        self.assertFalse(structural["verified"])
        self.assertIn("endpoint_connection", {entry["domain"] for entry in structural["claim_ledger"]})

    def test_ordered_voltage_reference_and_component_identity(self):
        spec = self.spec([self.meter(2.35, "r1:1", "r1:2")])
        self.assert_numeric(spec, "The meter reads 2.35 V across R1.", True)
        self.assert_numeric(spec, "The meter reads 2.35 V across R2.", False)
        self.assert_numeric(spec, "The meter reads 2.35 V across R3.", False)
        self.assert_numeric(spec, "The meter reads -2.35 V between R1:B and R1:A.", True)
        self.assert_numeric(spec, "The meter reads minus 2.35 V between R1:B and R1:A.", True)
        self.assert_numeric(spec, "The meter reads 2.35 V between R1:B and R1:A.", False)
        self.assert_numeric(spec, "The meter reads 2.35 V on R1:A.", False)
        self.assert_numeric(spec, "The meter reads 2.35 V between terminal A of R1 and terminal B of R1.", True)
        reverse = self.spec([self.meter(-5, "uno:gnd", "uno:5v")])
        self.assert_numeric(reverse, "5V is at 5 V relative to GND.", True)

    def test_zero_requires_available_reading_and_resolved_probes(self):
        claim = "The multimeter reads 0 V on GND."
        self.assert_numeric(self.spec([self.meter(0, "uno:gnd")]), claim, True)
        for sample in (self.meter(0, "uno:gnd", state="unavailable"),
                       self.meter(0, "uno:gnd", state="invalid"),
                       self.meter(0, "uno:gnd", ""),
                       self.meter(0, "uno:gnd", "uno:d99")):
            with self.subTest(sample=sample):
                self.assert_numeric(self.spec([sample]), claim, False)
        invalid = self.spec([self.meter(0, "", "uno:gnd")])
        self.assert_numeric(invalid, "The multimeter reads 0 V.", False)
        self.assert_numeric(self.spec(), claim, False)

    def test_nominal_and_solver_facts_cannot_satisfy_hardware_or_meter_claims(self):
        spec = self.spec()
        self.assert_numeric(spec, "R1 is a 220 Ω resistor.", True)
        self.assert_numeric(spec, "R1 is a 220-ohm resistor.", True)
        self.assert_numeric(spec, "R2 is a 220 Ω resistor.", False)
        self.assert_numeric(spec, "The multimeter reads 220 Ω across R1.", False)
        self.assert_numeric(spec, "The simulator voltage at D9 is 4.25 V.", True)
        self.assert_numeric(spec, "The simulator voltage at D5 is 4.25 V.", False)
        self.assert_numeric(self.spec(solved=False), "The solver voltage at D9 is 4.25 V.", False)
        self.assert_numeric(spec, "The simulator current through LED1 is 12.34 mA.", True)
        self.assert_numeric(self.spec(reported_current=False), "The simulator current through LED1 is 0 mA.", False)
        self.assert_numeric(spec, "The meter reports a simulated reading of 12.34 mA through LED1.", False)
        self.assert_numeric(spec, "The board logic voltage is 5 volts.", True)
        self.assert_numeric(spec, "The simulator voltage at D5 is 5 V.", False)
        self.assert_numeric(self.spec([self.meter()]), "The physical multimeter reads 5 V.", False)
        self.assert_numeric(self.spec([self.meter()]), "The hardware DMM reads 5 V.", False)

    def test_scope_channel_probe_and_rounding(self):
        def scope(mode, probe, value):
            return {"instrument": "oscilloscope", "probeA": probe, "mode": mode, "unit": "volt",
                    "source": "simulated", "state": "available", "value": value}
        readings = [scope("CH1", "uno:d9", 1.234), scope("CH2", "uno:d5", 1.234)]
        configured = {"ch1_probe": "uno:d9", "ch2_probe": "uno:d5"}
        spec = self.spec(readings, scope=configured)
        self.assert_numeric(spec, "Scope CH1 reads 1.23 volts on D9.", True)
        self.assert_numeric(spec, "Scope CH1 reads 1.24634 V on D9.", True)
        self.assert_numeric(spec, "Scope CH1 reads 1.24635 V on D9.", False)
        self.assert_numeric(spec, "Scope CH1 reads 1.23 V on D5.", False)
        self.assert_numeric(spec, "Scope CH2 reads 1.23 V on D5.", True)
        self.assert_numeric(spec, "Scope channel 3 reads 1.234 V on D5.", False)
        self.assert_numeric(spec, "Scope CH1 reads 1234 mV on D9.", False)
        self.assert_numeric(self.spec(readings, scope={**configured, "ch1_probe": "uno:d5"}),
                            "Scope CH1 reads 1.234 V on D9.", False)
        self.assert_numeric(self.spec(readings, scope={**configured, "ch1_probe": None}),
                            "Scope CH1 reads 1.234 V on D9.", False)
        self.assert_numeric(self.spec([self.meter(0)]), "The DMM reads 0.005 V.", True)
        self.assert_numeric(self.spec([self.meter(0)]), "The DMM reads 0.0051 V.", False)
