"""
Comprehensive Regression & Integration Tests for Xen Live Circuit Awareness (CyberLab).
Covers:
- User & session ownership isolation + fail-closed cohort/auth gates on /api/v1/xen/cyberlab/context
- Monotonic circuit/interaction revision enforcement, idempotent event deduplication, TTL pruning
- Size bounds, allowlisted field clipping, secret/DOM rejection, state_revision = 0 preservation
- Immediate cancellation/completion clearing of in_progress_connection
- Server vs authoritative chat-submit snapshot reconciliation across XenChatView and XenJobCreateView
- Prompt budget enforcement (<= 4000 chars) keeping critical live-wire/board/diagnostic fields intact
- Empty-canvas vs live-draft grounding directives & Stage 9J query routing vs Physics regression
"""

from datetime import timedelta
import json
from unittest.mock import patch
import uuid

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from academics.models_xen import XenCyberLabContext, XenJob
from accounts.models import User, UserRole, UserStatus
from core.xen_intent import (
    XenResponseMode,
    build_xen_effective_prompt,
    get_cyberlab_grounding_directive,
    is_circuit_specific_query,
    sanitize_context_envelope,
)


def _sample_v3_envelope(
    *,
    session_id="cyberlab-sess-1",
    circuit_revision=1,
    interaction_revision=2,
    event_seq=3,
    with_draft=True,
    recent_target=False,
    duplicate_invalid=False,
    is_empty=False,
):
    if is_empty:
        return {
            "schema_version": "3.0",
            "session_id": session_id,
            "circuit_revision": circuit_revision,
            "interaction_revision": interaction_revision,
            "state_revision": circuit_revision + interaction_revision,
            "event_seq": event_seq,
            "captured_at": "2026-11-26T18:00:00Z",
            "board": None,
            "components": [],
            "connections": [],
            "in_progress_connection": None,
            "hovered_pin": None,
            "diagnostics": {
                "health_status": "empty",
                "health_score": None,
                "critical_count": 0,
                "warning_count": 0,
                "issues": [],
                "solver_diagnostics": [],
            },
            "runtime_status": {"component_count": 0, "wire_count": 0, "is_empty": True},
        }

    ipc = None
    if with_draft:
        ipc = {
            "draft_id": "draft-1",
            "status": "invalid" if duplicate_invalid else "valid",
            "source_part_id": "uno",
            "source_pin_id": "d13",
            "source_pin_canonical": "d13",
            "color": "#22c55e",
            "cursor": {"x": 210.4, "y": 135.2},
            "candidate_target": None if recent_target else {
                "part_id": "led1",
                "pin_id": "anode",
                "canonical_pin_id": "anode",
                "currently_hovered": True,
            },
            "recent_target": {
                "part_id": "led1",
                "pin_id": "anode",
                "canonical_pin_id": "anode",
                "currently_hovered": False,
                "left_at": "2026-11-26T18:00:01Z",
            } if recent_target else None,
            "validation": {
                "placement_allowed": not duplicate_invalid,
                "compatibility_status": "blocked_invalid_target" if duplicate_invalid else "compatible",
                "is_same_pin": False,
                "is_duplicate_wire": duplicate_invalid,
                "is_already_same_net": False,
                "reasons": [
                    {
                        "rule_id": "wiring-duplicate-connection",
                        "severity": "warning",
                        "title": "Duplicate Wire Connection",
                        "message": "A wire already connects uno:d13 and led1:anode.",
                    }
                ] if duplicate_invalid else [],
            },
        }

    return {
        "schema_version": "3.0",
        "session_id": session_id,
        "circuit_revision": circuit_revision,
        "interaction_revision": interaction_revision,
        "state_revision": circuit_revision + interaction_revision,
        "event_seq": event_seq,
        "captured_at": "2026-11-26T18:00:00Z",
        "board": {"id": "arduino-uno", "part_id": "uno", "name": "Arduino Uno R3", "logic_voltage": 5.0},
        "components": [
            {"id": "uno", "type": "arduino-uno", "name": "Arduino Uno R3", "category": "board", "x": 40, "y": 100, "rotation": 0, "props": {}},
            {"id": "r1", "type": "resistor", "name": "Resistor", "category": "passive", "x": 200, "y": 100, "rotation": 0, "props": {"resistance": 220}},
            {"id": "led1", "type": "led", "name": "LED", "category": "output", "x": 320, "y": 100, "rotation": 0, "props": {"color": "red"}},
        ],
        "connections": [
            {
                "id": "w1",
                "from_part_id": "uno",
                "from_pin_id": "d13",
                "to_part_id": "r1",
                "to_pin_id": "a",
                "from": "uno:d13",
                "to": "r1:a",
                "color": "#22c55e",
                "net_id": 1,
                "net_name": "D13",
                "status": "complete",
            }
        ],
        "in_progress_connection": ipc,
        "hovered_pin": None if recent_target else {
            "part_id": "led1",
            "pin_id": "anode",
            "canonical_pin_id": "anode",
            "label": "Anode (+)",
            "kind": "passive",
            "currently_hovered": True,
        },
        "recent_target_pin": {
            "part_id": "led1",
            "pin_id": "anode",
            "canonical_pin_id": "anode",
            "currently_hovered": False,
            "left_at": "2026-11-26T18:00:01Z",
        } if recent_target else None,
        "netlist": [
            {"net_id": 1, "name": "D13", "is_power_rail": False, "is_ground_rail": False, "pin_keys": ["uno:d13", "r1:a"]},
            {"net_id": 2, "name": "GND", "is_power_rail": False, "is_ground_rail": True, "nominal_voltage": 0.0, "pin_keys": ["uno:gnd"]},
        ],
        "meter": {"is_open": True, "mode": "voltage", "red_probe": "uno:d13", "black_probe": "uno:gnd", "value": "5.0", "unit": "V"},
        "scope": {"is_open": True, "is_hold": False, "timebase_label": "50ms", "ch1_probe": "uno:d13", "ch2_probe": None},
        "diagnostics": {
            "health_status": "needs-attention",
            "health_score": 65,
            "critical_count": 0,
            "warning_count": 1,
            "issues": [
                {
                    "id": "open-led-cathode-led1",
                    "severity": "warning",
                    "category": "wiring",
                    "title": "LED Cathode Floating",
                    "message": "LED led1 cathode is not connected to Ground.",
                    "suggestion": "Connect led1 cathode to uno:gnd.",
                    "involved_part_ids": ["led1"],
                    "involved_pin_ids": ["cathode"],
                }
            ],
            "solver_diagnostics": [],
        },
        "runtime_status": {"component_count": 3, "wire_count": 1, "is_empty": False, "total_current_ma": 0},
    }


@override_settings(
    XEN_PILOT_ENABLED=True,
    PIXIUMIND_TESTER_ALLOWLIST=["301", "302"],
)
class XenCyberLabContextTests(TestCase):
    def setUp(self):
        self.limiter_patch = patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None))
        self.limiter_patch.start()
        self.addCleanup(self.limiter_patch.stop)

        self.student_a = User.objects.create_user(id=301, username="student_a", role=UserRole.STUDENT, status=UserStatus.ACTIVE)
        self.student_b = User.objects.create_user(id=302, username="student_b", role=UserRole.STUDENT, status=UserStatus.ACTIVE)
        self.school = User.objects.create_user(id=303, username="school_x", role=UserRole.SCHOOL, status=UserStatus.ACTIVE)

        self.client_a = APIClient()
        self.client_a.force_authenticate(self.student_a)
        self.client_b = APIClient()
        self.client_b.force_authenticate(self.student_b)
        self.client_school = APIClient()
        self.client_school.force_authenticate(self.school)

    def test_auth_and_cohort_gating(self):
        anon = APIClient()
        self.assertEqual(anon.get("/api/v1/xen/cyberlab/context").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self.client_school.post("/api/v1/xen/cyberlab/context", {"session_id": "s1"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_cross_user_isolation_and_ttl_expiry(self):
        res = self.client_a.post(
            "/api/v1/xen/cyberlab/context",
            {
                "session_id": "sess-owned-a",
                "event_type": "wire_start",
                "event_id": "ev-a-1",
                "event_seq": 1,
                "circuit_revision": 1,
                "interaction_revision": 1,
                "context_envelope": _sample_v3_envelope(session_id="sess-owned-a"),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # User B must NEVER read User A's session snapshot
        get_b = self.client_b.get("/api/v1/xen/cyberlab/context?session_id=sess-owned-a")
        self.assertEqual(get_b.status_code, status.HTTP_404_NOT_FOUND)

        # Expired sessions are automatically pruned and unreadable
        XenCyberLabContext.objects.filter(user=self.student_a, session_id="sess-owned-a").update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        get_a_expired = self.client_a.get("/api/v1/xen/cyberlab/context?session_id=sess-owned-a")
        self.assertEqual(get_a_expired.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(XenCyberLabContext.objects.filter(session_id="sess-owned-a").count(), 0)

    def test_monotonic_revision_idempotency_and_wire_cancel_clearing(self):
        base = {
            "session_id": "sess-mono",
            "event_type": "wire_start",
            "event_id": "ev-1",
            "event_seq": 2,
            "circuit_revision": 2,
            "interaction_revision": 3,
            "context_envelope": _sample_v3_envelope(session_id="sess-mono", circuit_revision=2, interaction_revision=3, event_seq=2),
        }
        r1 = self.client_a.post("/api/v1/xen/cyberlab/context", base, format="json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)

        # Duplicate retry with same event_id is idempotent
        r_dup = self.client_a.post("/api/v1/xen/cyberlab/context", base, format="json")
        self.assertEqual(r_dup.status_code, status.HTTP_200_OK)
        self.assertEqual(r_dup.data["status"], "duplicate_ignored")

        # Stale out-of-order revision must be rejected with 409 without overwriting newer state
        stale = {
            "session_id": "sess-mono",
            "event_type": "target_hover_enter",
            "event_id": "ev-stale",
            "event_seq": 1,
            "circuit_revision": 1,
            "interaction_revision": 9,
            "context_envelope": _sample_v3_envelope(session_id="sess-mono", circuit_revision=1, interaction_revision=9, event_seq=1),
        }
        r_stale = self.client_a.post("/api/v1/xen/cyberlab/context", stale, format="json")
        self.assertEqual(r_stale.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(r_stale.data["code"], "STALE_CONTEXT_REVISION")

        # wire_cancel must clear in_progress_connection even if incoming payload omitted clearing it
        cancel_req = {
            "session_id": "sess-mono",
            "event_type": "wire_cancel",
            "event_id": "ev-3",
            "event_seq": 3,
            "circuit_revision": 2,
            "interaction_revision": 4,
            "context_envelope": _sample_v3_envelope(session_id="sess-mono", circuit_revision=2, interaction_revision=4, event_seq=3),
        }
        r_cancel = self.client_a.post("/api/v1/xen/cyberlab/context", cancel_req, format="json")
        self.assertEqual(r_cancel.status_code, status.HTTP_200_OK)
        row = XenCyberLabContext.objects.get(user=self.student_a, session_id="sess-mono")
        self.assertNotIn("in_progress_connection", row.context_payload.get("circuit", {}))

    def test_size_limit_and_secret_sanitization(self):
        oversized = {"session_id": "sess-big", "event_type": "circuit_snapshot", "blob": "x" * 140_000}
        res_big = self.client_a.post("/api/v1/xen/cyberlab/context", oversized, format="json")
        self.assertEqual(res_big.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_big.data["code"], "PAYLOAD_TOO_LARGE")

        env = _sample_v3_envelope(circuit_revision=0, interaction_revision=0, event_seq=0)
        env["api_token"] = "secret-bearer-token"
        env["dom_node"] = {"nodeType": 1, "innerHTML": "<script>alert(1)</script>"}
        clean = sanitize_context_envelope(env)
        # state_revision = 0 and circuit_revision = 0 MUST be preserved (never dropped by truthiness)
        self.assertEqual(clean.get("state_revision"), 0)
        self.assertEqual(clean.get("circuit_revision"), 0)
        self.assertEqual(clean["circuit"].get("state_revision"), 0)
        self.assertNotIn("api_token", json.dumps(clean))
        self.assertNotIn("innerHTML", json.dumps(clean))
        # Netlist preserves isPowerRail/isGroundRail normalized booleans
        self.assertEqual(clean["circuit"]["netlist"][1]["is_ground"], True)

    def test_job_creation_reconciles_server_vs_authoritative_chat_snapshot(self):
        # 1. Newer incoming chat snapshot overrides older stored state
        self.client_a.post(
            "/api/v1/xen/cyberlab/context",
            {
                "session_id": "sess-reconcile",
                "event_type": "wire_start",
                "event_id": "ev-1",
                "event_seq": 1,
                "circuit_revision": 1,
                "interaction_revision": 0,
                "context_envelope": _sample_v3_envelope(session_id="sess-reconcile", circuit_revision=1, interaction_revision=0, with_draft=False),
            },
            format="json",
        )
        res_newer = self.client_a.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "What am I connecting right now?",
                "idempotency_key": "reconcile-newer-1",
                "context_envelope": _sample_v3_envelope(
                    session_id="sess-reconcile",
                    circuit_revision=2,
                    interaction_revision=4,
                    event_seq=5,
                    recent_target=True,
                ),
            },
            format="json",
        )
        self.assertEqual(res_newer.status_code, status.HTTP_202_ACCEPTED, res_newer.data)
        job_newer = XenJob.objects.get(id=res_newer.data["job_id"])
        self.assertEqual(job_newer.context_session_id, "sess-reconcile")
        self.assertEqual(job_newer.context_revision, 2)
        self.assertIn("recent_target", job_newer.prompt)
        self.assertIn("currently_hovered\":false", job_newer.prompt)

        # 2. Stale chat submit must NOT silently revert to older revision (1, 0) when server has (2, 4)
        res_stale_chat = self.client_a.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "Why won't this wire connect?",
                "idempotency_key": "reconcile-stale-2",
                "context_envelope": _sample_v3_envelope(
                    session_id="sess-reconcile",
                    circuit_revision=1,
                    interaction_revision=0,
                    event_seq=1,
                    with_draft=False,
                ),
            },
            format="json",
        )
        self.assertEqual(res_stale_chat.status_code, status.HTTP_202_ACCEPTED)
        job_reconciled = XenJob.objects.get(id=res_stale_chat.data["job_id"])
        self.assertEqual(job_reconciled.context_revision, 2)
        self.assertIn("recent_target", job_reconciled.prompt)

    def test_empty_canvas_directive_and_live_budget_retention(self):
        empty_env = _sample_v3_envelope(is_empty=True, circuit_revision=0, interaction_revision=0)
        empty_clean = sanitize_context_envelope(empty_env)
        directive = get_cyberlab_grounding_directive(empty_clean)
        self.assertIn("0 components and 0 wires", directive)
        self.assertIn("never 100/100", get_cyberlab_grounding_directive(empty_clean, compact=True).lower())

        # Large envelope with active duplicate draft wire stays <= 4000 chars and retains draft & board & critical fault
        heavy = _sample_v3_envelope(circuit_revision=5, interaction_revision=9, with_draft=True, duplicate_invalid=True)
        heavy["components"] = [
            {"id": f"p{i}", "type": "resistor", "name": "Resistor", "category": "passive", "x": i * 20, "y": 50, "rotation": 0, "props": {"resistance": 220}}
            for i in range(30)
        ]
        heavy["components"][0] = {"id": "uno", "type": "arduino-uno", "name": "Arduino Uno R3", "category": "board", "x": 0, "y": 0, "rotation": 0, "props": {}}
        heavy["components"][1] = {"id": "led1", "type": "led", "name": "LED", "category": "output", "x": 100, "y": 50, "rotation": 0, "props": {"color": "red"}}
        heavy["connections"] = [
            {"id": f"w{i}", "from_part_id": "uno", "from_pin_id": "d13", "to_part_id": f"p{i+2}", "to_pin_id": "a", "from": "uno:d13", "to": f"p{i+2}:a", "color": "red", "status": "complete"}
            for i in range(28)
        ]
        heavy["diagnostics"]["issues"] = [
            {"id": "short-5v", "severity": "critical", "category": "safety", "title": "Direct 5V Short", "message": "5V shorted directly to GND.", "suggestion": "Remove short."}
        ]
        eff = build_xen_effective_prompt(
            prompt="Check my wiring and why won't it connect?\n" * 20,
            format_mode=XenResponseMode.CODE_ONLY,
            context_envelope=sanitize_context_envelope(heavy),
            max_chars=4000,
        )
        self.assertLessEqual(len(eff), 4000)
        self.assertIn("[MISSION CONTEXT]", eff)
        self.assertIn("in_progress_connection", eff)
        self.assertIn("arduino-uno", eff)
        self.assertIn("Direct 5V Short", eff)

    def test_stage_9j_query_routing_with_physics_non_regression(self):
        # Hardware / live wire queries route to circuit context
        for q in (
            "What am I connecting right now?",
            "Why didn't that connect?",
            "Check multimeter reading",
            "Is the LED cathode grounded?",
        ):
            self.assertTrue(is_circuit_specific_query(q), f"Expected True for: {q}")

        # Physics / general STEM queries NEVER route to circuit context
        for phys in (
            "BHAI KINETIC ENERFY AK FORMULA",
            "What is kinetic energy?",
            "Explain Newton's second law.",
        ):
            self.assertFalse(is_circuit_specific_query(phys), f"Expected False for: {phys}")
            eff = build_xen_effective_prompt(
                prompt=phys,
                format_mode=XenResponseMode.DEFAULT_EDUCATIONAL,
                context_envelope=sanitize_context_envelope(_sample_v3_envelope(with_draft=True)),
            )
            self.assertNotIn("arduino-uno", eff)
            self.assertNotIn("in_progress_connection", eff)

    @override_settings(XEN_WORKER_SECRET="test-worker-secret")
    def test_response_provenance_live_cache_and_failure_paths(self):
        from core.xen_views import XenChatView

        worker = APIClient()
        worker.credentials(HTTP_X_WORKER_SECRET="test-worker-secret")

        env = _sample_v3_envelope(session_id="sess-prov-1", circuit_revision=4, interaction_revision=7)
        idem = f"prov-job-{uuid.uuid4().hex[:8]}"

        # 1. Queue job -> queued provenance carries session_id, circuit_revision, schema_version, job_id
        q_res = self.client_a.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "Check resistor connection on this circuit.",
                "idempotency_key": idem,
                "context_envelope": env,
            },
            format="json",
        )
        self.assertEqual(q_res.status_code, status.HTTP_202_ACCEPTED)
        job_id = q_res.data["job_id"]
        self.assertEqual(q_res.data["provenance"]["job_id"], job_id)
        self.assertEqual(q_res.data["provenance"]["session_id"], "sess-prov-1")
        self.assertEqual(q_res.data["provenance"]["circuit_revision"], 4)
        self.assertEqual(q_res.data["provenance"]["context_schema_version"], "3.0")
        self.assertEqual(q_res.data["provenance"]["response_status"], "queued")

        # 2. Worker claims & completes -> /chunks and /jobs/<id> report xen_step700 provenance + worker_id
        claim_res = worker.post("/api/v1/xen/worker/claim", {"worker_id": "kaggle-dual-t4-prov"}, format="json")
        self.assertEqual(claim_res.status_code, status.HTTP_200_OK)
        self.assertEqual(claim_res.data["job"]["id"], job_id)

        comp_res = worker.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {
                "worker_id": "kaggle-dual-t4-prov",
                "choices": [{"message": {"content": "Verified pin mapping from context."}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 50, "completion_tokens": 12, "total_tokens": 62},
            },
            format="json",
        )
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)

        chunks_res = self.client_a.get(f"/api/v1/xen/jobs/{job_id}/chunks")
        self.assertEqual(chunks_res.status_code, status.HTTP_200_OK)
        self.assertEqual(chunks_res.data["worker_id"], "kaggle-dual-t4-prov")
        self.assertEqual(chunks_res.data["provenance"], {
            "response_source": "xen_step700",
            "job_id": job_id,
            "worker_id": "kaggle-dual-t4-prov",
            "session_id": "sess-prov-1",
            "circuit_revision": 4,
            "context_schema_version": "3.0",
            "response_status": "completed",
            "fallback_reason": None,
        })

        detail_res = self.client_a.get(f"/api/v1/xen/jobs/{job_id}")
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data["provenance"]["response_source"], "xen_step700")
        self.assertEqual(detail_res.data["provenance"]["worker_id"], "kaggle-dual-t4-prov")

        # 3. Duplicate submission hits COMPLETED idempotency cache -> response_source == "cache"
        cache_res = self.client_a.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "Check resistor connection on this circuit.",
                "idempotency_key": idem,
                "context_envelope": env,
            },
            format="json",
        )
        self.assertEqual(cache_res.status_code, status.HTTP_200_OK)
        self.assertTrue(cache_res.data["cached"])
        self.assertEqual(cache_res.data["provenance"], {
            "response_source": "cache",
            "job_id": job_id,
            "worker_id": "kaggle-dual-t4-prov",
            "session_id": "sess-prov-1",
            "circuit_revision": 4,
            "context_schema_version": "3.0",
            "response_status": "cached",
            "fallback_reason": None,
        })

        # 4. Failed job -> response_source == "error" with fallback_reason
        fail_q = self.client_a.post(
            "/api/v1/xen/jobs",
            {"prompt": "Another circuit question", "idempotency_key": f"fail-{uuid.uuid4().hex[:8]}", "context_envelope": env},
            format="json",
        )
        fail_job_id = fail_q.data["job_id"]
        worker.post("/api/v1/xen/worker/claim", {"worker_id": "kaggle-dual-t4-prov"}, format="json")
        worker.post(
            f"/api/v1/xen/worker/jobs/{fail_job_id}/fail",
            {"worker_id": "kaggle-dual-t4-prov", "error_code": "CUDA_OUT_OF_MEMORY"},
            format="json",
        )
        fail_detail = self.client_a.get(f"/api/v1/xen/jobs/{fail_job_id}")
        self.assertEqual(fail_detail.data["provenance"]["response_source"], "error")
        self.assertEqual(fail_detail.data["provenance"]["response_status"], "failed")
        self.assertEqual(fail_detail.data["provenance"]["fallback_reason"], "CUDA_OUT_OF_MEMORY")
        self.assertEqual(fail_detail.data["provenance"]["session_id"], "sess-prov-1")

        # 5. Synchronous XenChatView reports xen_step700 -> cache -> error cleanly
        sync_key = f"sync-{uuid.uuid4().hex[:8]}"
        mock_upstream = (
            200,
            {
                "worker_id": "sync-worker-1",
                "choices": [{"message": {"content": "Hello from Step-700"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14},
            },
        )
        with patch.object(XenChatView, "call_upstream", return_value=mock_upstream):
            r1 = self.client_a.post(
                "/api/v1/xen/chat",
                {"prompt": "Hello Xen", "idempotency_key": sync_key, "context_envelope": env},
                format="json",
            )
            self.assertEqual(r1.status_code, status.HTTP_200_OK)
            self.assertEqual(r1.data["provenance"]["response_source"], "xen_step700")
            self.assertEqual(r1.data["provenance"]["worker_id"], "sync-worker-1")
            r2 = self.client_a.post(
                "/api/v1/xen/chat",
                {"prompt": "Hello Xen", "idempotency_key": sync_key, "context_envelope": env},
                format="json",
            )
            self.assertEqual(r2.status_code, status.HTTP_200_OK)
            self.assertTrue(r2.data["cached"])
            self.assertEqual(r2.data["provenance"]["response_source"], "cache")
            self.assertEqual(r2.data["provenance"]["response_status"], "cached")

        with patch.object(XenChatView, "call_upstream", return_value=(503, {"error": "Down", "code": "UPSTREAM_UNAVAILABLE"})):
            r3 = self.client_a.post(
                "/api/v1/xen/chat",
                {"prompt": "Hello Xen", "idempotency_key": f"sync-err-{uuid.uuid4().hex[:8]}", "context_envelope": env},
                format="json",
            )
            self.assertEqual(r3.status_code, 503)
            self.assertEqual(r3.data["provenance"]["response_source"], "error")
            self.assertEqual(r3.data["provenance"]["fallback_reason"], "UPSTREAM_UNAVAILABLE")

