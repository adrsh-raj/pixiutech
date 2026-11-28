"""
Backend regression tests for Human UAT Blockers B1-B10:
- Empty canvas + 'done' poisoning/retry/fallback
- Swapped LED anode/cathode & missing GND endpoint claims rejected
- Tampered/stale health_score=100 reconciled against cross-layer LED faults (D9 vs D5)
- Unfounded 'MNA valid' and stopped-simulation runtime hallucinations rejected
- False series-resistor reverse-polarity protection claim rejected & retried
- Multi-revision conversation history isolation
"""

import json
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import UserRole, UserStatus
from academics.models_xen import XenSession
from core.xen_grounding import (
    build_authoritative_grounding_spec,
    build_deterministic_grounded_fallback,
    extract_and_validate_grounding_claims,
    filter_and_compact_xen_history,
)
from core.xen_intent import CYBERLAB_GROUNDING_DIRECTIVE, XenResponseMode
from core.xen_views import sanitize_xen_message


def _empty_envelope(rev=0):
    return {
        "schema_version": "3.0",
        "session_id": "uat-empty",
        "circuit_revision": rev,
        "interaction_revision": 0,
        "state_revision": rev,
        "parts": [],
        "wires": [],
        "netlist": [],
        "simulation": {"running": False, "status": "ready"},
        "diagnostics": {"health_status": "empty", "health_score": None, "critical_count": 0, "warning_count": 0, "issues": []},
        "runtime_status": {"component_count": 0, "wire_count": 0, "is_empty": True},
    }


def _reversed_led_envelope(rev=2, running=False):
    return {
        "schema_version": "3.0",
        "session_id": "uat-rev-led",
        "circuit_revision": rev,
        "interaction_revision": 0,
        "state_revision": rev,
        "board": {"id": "arduino-uno", "partId": "uno1", "name": "Arduino Uno R3"},
        "parts": [
            {"id": "uno1", "type": "arduino-uno", "name": "Arduino Uno R3", "props": {}},
            {"id": "r1", "type": "resistor", "name": "220Ω Resistor", "props": {"resistance": 220}},
            {"id": "led1", "type": "led", "name": "Red LED", "props": {"color": "red"}},
        ],
        "wires": [
            {"from": {"partId": "uno1", "pinId": "d13"}, "to": {"partId": "r1", "pinId": "a"}},
            {"from": {"partId": "r1", "pinId": "b"}, "to": {"partId": "led1", "pinId": "cathode"}},
            {"from": {"partId": "led1", "pinId": "anode"}, "to": {"partId": "uno1", "pinId": "gnd"}},
        ],
        "netlist": [
            {"id": "net_1", "label": "D13", "endpoints": ["uno1:d13", "r1:a"]},
            {"id": "net_2", "label": "LED_CATHODE", "endpoints": ["r1:b", "led1:cathode"]},
            {"id": "net_3", "label": "GND", "endpoints": ["led1:anode", "uno1:gnd"], "is_ground": True},
        ],
        "simulation": {"running": running, "paused": False, "status": "running" if running else "ready"},
        "diagnostics": {"health_status": "danger", "health_score": 65, "critical_count": 1, "warning_count": 0, "issues": []},
    }


def _missing_gnd_envelope(rev=3):
    return {
        "schema_version": "3.0",
        "session_id": "uat-miss-gnd",
        "circuit_revision": rev,
        "interaction_revision": 0,
        "state_revision": rev,
        "board": {"id": "arduino-uno", "partId": "uno1", "name": "Arduino Uno R3"},
        "parts": [
            {"id": "uno1", "type": "arduino-uno", "name": "Arduino Uno R3", "props": {}},
            {"id": "r1", "type": "resistor", "name": "220Ω Resistor", "props": {"resistance": 220}},
            {"id": "led1", "type": "led", "name": "Red LED", "props": {"color": "red"}},
        ],
        "wires": [
            {"from": {"partId": "uno1", "pinId": "d13"}, "to": {"partId": "r1", "pinId": "a"}},
            {"from": {"partId": "r1", "pinId": "b"}, "to": {"partId": "led1", "pinId": "anode"}},
        ],
        "netlist": [
            {"id": "net_1", "label": "D13", "endpoints": ["uno1:d13", "r1:a"]},
            {"id": "net_2", "label": "LED_ANODE", "endpoints": ["r1:b", "led1:anode"]},
        ],
        "simulation": {"running": False, "status": "ready"},
        "diagnostics": {"health_status": "danger", "health_score": 65, "critical_count": 1, "warning_count": 0, "issues": []},
    }


class XenUatBlockerRegressionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            id=491,
            username="uat_admin",
            email="uat_admin@pixiutech.test",
            password="pass-uat-check",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_b4_b7_swapped_led_anode_cathode_and_missing_gnd_rejected(self):
        rev_spec = build_authoritative_grounding_spec(_reversed_led_envelope(running=False))
        # Swapped LED claims must FAIL
        bad_cathode = extract_and_validate_grounding_claims("led1:cathode is connected to uno1:gnd.", rev_spec)
        self.assertFalse(bad_cathode["verified"])
        bad_anode = extract_and_validate_grounding_claims("led1:anode connects to r1:b.", rev_spec)
        self.assertFalse(bad_anode["verified"])
        # Accurate reversed polarity description must PASS
        good_rev = extract_and_validate_grounding_claims(
            "led1:cathode connects to r1:b and led1:anode is wired to uno1:gnd. Swap the LED leads so anode faces r1:b.",
            rev_spec,
        )
        self.assertTrue(good_rev["verified"], good_rev["unsupported_claims"])

        # Missing GND: claiming LED cathode or LED is connected to GND must FAIL
        miss_spec = build_authoritative_grounding_spec(_missing_gnd_envelope())
        bad_gnd = extract_and_validate_grounding_claims("led1:cathode is connected to gnd.", miss_spec)
        self.assertFalse(bad_gnd["verified"])
        bad_gen_gnd = extract_and_validate_grounding_claims("The LED is wired to ground.", miss_spec)
        self.assertFalse(bad_gen_gnd["verified"])

    def test_b8_reconciles_tampered_100_health_score_when_cross_layer_mismatch_exists(self):
        tampered = {
            "schema_version": "3.0",
            "circuit_revision": 4,
            "board": {"id": "arduino-uno", "partId": "uno1", "name": "Arduino Uno R3"},
            "parts": [
                {"id": "uno1", "type": "arduino-uno"},
                {"id": "r1", "type": "resistor", "props": {"resistance": 220}},
                {"id": "led1", "type": "led"},
            ],
            "wires": [
                {"from": {"partId": "uno1", "pinId": "d9"}, "to": {"partId": "r1", "pinId": "a"}},
                {"from": {"partId": "r1", "pinId": "b"}, "to": {"partId": "led1", "pinId": "anode"}},
                {"from": {"partId": "led1", "pinId": "cathode"}, "to": {"partId": "uno1", "pinId": "gnd"}},
            ],
            "cross_layer_led": [
                {
                    "led_id": "led1",
                    "topology_ok": True,
                    "safety_ok": True,
                    "pin_mapping_ok": False,
                    "observed_state": "off_code_mismatch",
                    "physical_pins": ["d9"],
                    "code_pins": ["d5"],
                    "mismatch_reason": "Code drives D5 while physical LED is wired to D9.",
                }
            ],
            "simulation": {"running": False, "status": "ready"},
            # Simulated stale/buggy client falsely reporting 100/100 healthy!
            "diagnostics": {"health_status": "healthy", "health_score": 100, "critical_count": 0, "warning_count": 0},
        }
        spec = build_authoritative_grounding_spec(tampered)
        self.assertEqual(spec["health_status"], "danger")
        self.assertLess(spec["health_score"], 100)
        self.assertFalse(extract_and_validate_grounding_claims("Health score: 100/100! Circuit is healthy.", spec)["verified"])

    def test_b9_rejects_unfounded_mna_valid_and_stopped_live_claims(self):
        stopped_spec = build_authoritative_grounding_spec(_reversed_led_envelope(running=False))
        self.assertFalse(extract_and_validate_grounding_claims("MNA valid. LED is glowing.", stopped_spec)["verified"])
        self.assertFalse(extract_and_validate_grounding_claims("MNA: valid, solver checks passed.", stopped_spec)["verified"])
        self.assertFalse(
            extract_and_validate_grounding_claims(
                "The multimeter reads 5.0 V on uno1:d13 and 14.1 mA through r1.", stopped_spec
            )["verified"]
        )
        empty_spec = build_authoritative_grounding_spec(_empty_envelope())
        self.assertFalse(extract_and_validate_grounding_claims("MNA status is valid!", empty_spec)["verified"])

    def test_b1_empty_canvas_done_triggers_deterministic_fallback(self):
        empty_spec = build_authoritative_grounding_spec(_empty_envelope(rev=0))
        bad = extract_and_validate_grounding_claims("All connections are intact! Health score: 100/100.", empty_spec, "done")
        self.assertFalse(bad["verified"])
        fb = build_deterministic_grounded_fallback(empty_spec, "done", "", bad["unsupported_claims"], bad["unsupported_clauses"])
        self.assertIn("0 components", fb)
        self.assertNotIn("100/100", fb)

    def test_b10_rejects_resistor_reverse_polarity_protection_myth_and_retries(self):
        rev_spec = build_authoritative_grounding_spec(_reversed_led_envelope(running=False))
        self.assertIn("never claim a resistor protects against reverse polarity", CYBERLAB_GROUNDING_DIRECTIVE.lower())

        bad_claim = "The 220Ω resistor protects against reverse polarity so the LED won't suffer burnout."
        res_bad = extract_and_validate_grounding_claims(bad_claim, rev_spec)
        self.assertFalse(res_bad["verified"])
        self.assertTrue(any("reverse polarity" in c.lower() for c in res_bad["unsupported_claims"]))

        # Truthful negation passes cleanly
        good_claim = "A 220Ω series resistor does not protect against reverse polarity; swap led1:anode to r1:b and led1:cathode to uno1:gnd."
        res_good = extract_and_validate_grounding_claims(good_claim, rev_spec)
        self.assertTrue(res_good["verified"], res_good["unsupported_claims"])

    @override_settings(
        PIXIUMIND_ENDPOINT_URL="https://upstream.invalid/v1",
        XEN_PILOT_ENABLED=True,
        PIXIUMIND_TESTER_ALLOWLIST=["491"],
    )
    def test_b1_b10_end_to_end_chat_retries_and_quarantines_poisoned_turns(self):
        fake_upstream = [
            (200, {"choices": [{"message": {"content": "MNA valid! The 220Ω resistor protects the LED against reverse polarity."}}], "usage": {}}),
            (200, {"choices": [{"message": {"content": "led1:anode connects to uno1:gnd and led1:cathode connects to r1:b, so it is reverse-biased. A 220Ω series resistor does not protect against reverse polarity."}}], "usage": {}}),
        ]
        with patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None)), patch(
            "core.xen_views.XenBaseView.call_upstream", side_effect=fake_upstream
        ):
            res = self.client.post(
                "/api/v1/xen/chat",
                {
                    "prompt": "Does the 220Ω resistor protect my reversed LED?",
                    "idempotency_key": f"uat-b10-{uuid.uuid4().hex[:8]}",
                    "context_envelope": _reversed_led_envelope(rev=2, running=False),
                },
                format="json",
            )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertTrue(res.data["grounding_verification"]["retry_attempted"])
        self.assertTrue(res.data["grounding_verification"]["verified"])
        self.assertIn("does not protect against reverse polarity", res.data["response"]["text"].lower())

        # Stale rev=1 hallucination cannot poison rev=3 history
        spec_r3 = build_authoritative_grounding_spec(_missing_gnd_envelope(rev=3))
        compacted = filter_and_compact_xen_history(
            [
                {"role": "user", "content": "Check circuit"},
                {
                    "role": "assistant",
                    "content": "Health score: 100/100! Connections intact! MNA valid!",
                    "provenance": {"response_source": "xen_step700", "circuit_revision": 1},
                },
            ],
            XenResponseMode.DEFAULT_EDUCATIONAL,
            sanitize_fn=sanitize_xen_message,
            current_circuit_revision=3,
            current_spec=spec_r3,
        )
        self.assertNotIn("100/100", json.dumps(compacted))
        self.assertNotIn("MNA valid", json.dumps(compacted))
