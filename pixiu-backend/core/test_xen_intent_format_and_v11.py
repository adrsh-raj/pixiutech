"""
Regression Test Suite for:
1. Intent vs Format Mode separation across all Xen endpoints.
2. Backward compatibility with existing/legacy jobs.
3. Exact Kaggle Version 11 worker contract verification (Claim, Heartbeat, Complete, Fail).
4. Worker security & lease enforcement.
"""

from datetime import timedelta
from unittest.mock import patch
import uuid

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from academics.models_xen import XenJob, XenJobStatus, XenWorkerHeartbeat
from accounts.models import User, UserRole, UserStatus
from core.xen_intent import XenResponseMode


@override_settings(
    XEN_PILOT_ENABLED=True,
    XEN_WORKER_SECRET="test-worker-secret-v11",
    PIXIUMIND_TESTER_ALLOWLIST=["101", "102", "103"],
)
class XenIntentFormatModeAndVersion11Tests(TestCase):
    def setUp(self):
        self.rate_patcher = patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None))
        self.rate_patcher.start()
        self.addCleanup(self.rate_patcher.stop)

        self.student = User.objects.create_user(
            id=101, username="student_user", role=UserRole.STUDENT, status=UserStatus.ACTIVE
        )
        self.trainer = User.objects.create_user(
            id=102, username="trainer_user", role=UserRole.TRAINER, status=UserStatus.ACTIVE
        )
        self.admin = User.objects.create_user(
            id=103, username="admin_user", role=UserRole.ADMIN, status=UserStatus.ACTIVE
        )

        self.student_client = APIClient()
        self.student_client.force_authenticate(self.student)

        self.trainer_client = APIClient()
        self.trainer_client.force_authenticate(self.trainer)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin)

        self.worker_client = APIClient()
        self.worker_client.credentials(HTTP_X_WORKER_SECRET="test-worker-secret-v11")

    # --------------------------------------------------------------------------
    # BLOCKER 1: Intent vs Format Mode Call-site & Data-flow Audit Tests
    # --------------------------------------------------------------------------

    def test_case_1_trainer_and_student_teaching_request(self):
        """Case 1: Teaching requests preserve intent='TEACHING' and resolve default format_mode."""
        # Trainer request
        res = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {"prompt": "Explain variables and loops to a Grade 6 student.", "intent": "TEACHING", "idempotency_key": "t-teach-1"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(res.data["intent"], "TEACHING")
        self.assertEqual(res.data["format_mode"], "DEFAULT_EDUCATIONAL")

        job = XenJob.objects.get(id=res.data["job_id"])
        self.assertEqual(job.intent, "TEACHING")
        self.assertEqual(job.format_mode, "DEFAULT_EDUCATIONAL")
        self.assertEqual(job.effective_intent, "TEACHING")
        self.assertEqual(job.effective_format_mode, "DEFAULT_EDUCATIONAL")

        # Student request
        res_s = self.student_client.post(
            "/api/v1/xen/jobs",
            {"prompt": "Can you explain what an if statement does?", "intent": "TEACHING", "idempotency_key": "s-teach-1"},
            format="json",
        )
        self.assertEqual(res_s.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(res_s.data["intent"], "TEACHING")
        self.assertEqual(res_s.data["format_mode"], "DEFAULT_EDUCATIONAL")

        job_s = XenJob.objects.get(id=res_s.data["job_id"])
        self.assertEqual(job_s.intent, "TEACHING")
        self.assertEqual(job_s.format_mode, "DEFAULT_EDUCATIONAL")

    def test_case_2_admin_inspection_request(self):
        """Case 2: Admin inspection request preserves intent='ADMIN_INSPECTION'."""
        res = self.admin_client.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "Inspect curriculum compliance for Grade 6 Module 2.",
                "intent": "ADMIN_INSPECTION",
                "idempotency_key": "admin-insp-1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(res.data["intent"], "ADMIN_INSPECTION")
        self.assertEqual(res.data["format_mode"], "DEFAULT_EDUCATIONAL")

        job = XenJob.objects.get(id=res.data["job_id"])
        self.assertEqual(job.intent, "ADMIN_INSPECTION")
        self.assertEqual(job.format_mode, "DEFAULT_EDUCATIONAL")

    def test_case_3_lesson_circuit_tutoring_request(self):
        """Case 3: Circuit tutoring request preserves intent='CIRCUIT_TUTORING'."""
        res = self.student_client.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "Why is my LED not glowing?",
                "intent": "CIRCUIT_TUTORING",
                "idempotency_key": "circ-tutor-1",
                "context_envelope": {
                    "lesson": {"id": "safe-led", "title": "Safe LED"},
                    "circuit": {"parts_count": 3, "wires_count": 2},
                },
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(res.data["intent"], "CIRCUIT_TUTORING")
        self.assertEqual(res.data["format_mode"], "DEFAULT_EDUCATIONAL")

        job = XenJob.objects.get(id=res.data["job_id"])
        self.assertEqual(job.intent, "CIRCUIT_TUTORING")
        self.assertEqual(job.format_mode, "DEFAULT_EDUCATIONAL")

    def test_case_4_explicit_code_only_request(self):
        """Case 4: Explicit CODE_ONLY request preserves job intent (e.g. TEACHING) while format_mode='CODE_ONLY'."""
        res = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "Write a Python program to calculate factorial. Give me only the code, no explanation.",
                "intent": "TEACHING",
                "format_preference": "CODE_ONLY",
                "idempotency_key": "code-only-1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        # Crucial check: intent remains TEACHING, format_mode is CODE_ONLY
        self.assertEqual(res.data["intent"], "TEACHING")
        self.assertEqual(res.data["format_mode"], "CODE_ONLY")

        job = XenJob.objects.get(id=res.data["job_id"])
        self.assertEqual(job.intent, "TEACHING")
        self.assertEqual(job.format_mode, "CODE_ONLY")
        self.assertEqual(job.effective_intent, "TEACHING")
        self.assertEqual(job.effective_format_mode, "CODE_ONLY")

    def test_case_5_explicit_output_only_request(self):
        """Case 5: Explicit OUTPUT_ONLY request preserves intent while format_mode='OUTPUT_ONLY'."""
        res = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {
                "prompt": "What will be printed by print(10 * 5)? Only output.",
                "intent": "TEACHING",
                "format_preference": "OUTPUT_ONLY",
                "idempotency_key": "out-only-1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(res.data["intent"], "TEACHING")
        self.assertEqual(res.data["format_mode"], "OUTPUT_ONLY")

        job = XenJob.objects.get(id=res.data["job_id"])
        self.assertEqual(job.intent, "TEACHING")
        self.assertEqual(job.format_mode, "OUTPUT_ONLY")

    def test_case_6_legacy_jobs_created_before_format_mode_migration(self):
        """
        Case 6: Existing queued/completed jobs created before format_mode was a separate field.
        Verifies that:
        - If legacy job had format mode stored in intent (e.g. 'CODE_ONLY'), effective_intent='TEACHING'
          and effective_format_mode='CODE_ONLY'.
        - If legacy job had genuine intent (e.g. 'ADMIN_INSPECTION') with empty format_mode,
          effective_intent='ADMIN_INSPECTION' and effective_format_mode='DEFAULT_EDUCATIONAL'.
        """
        legacy_job_1 = XenJob.objects.create(
            user=self.trainer,
            role=UserRole.TRAINER,
            intent="CODE_ONLY",  # Old conflated value
            format_mode="",     # Empty on legacy record
            prompt="def solve(): pass",
            idempotency_key="legacy-1",
            status=XenJobStatus.COMPLETED,
            response_summary="```python\ndef solve(): pass\n```",
            response_payload={
                "decoded": {
                    "text": "```python\ndef solve(): pass\n```",
                    "is_complete": True,
                    "syntax_valid": True,
                    "display_ast_valid": False,
                    "format_valid": True,
                }
            },
        )
        self.assertEqual(legacy_job_1.effective_intent, "TEACHING")
        self.assertEqual(legacy_job_1.effective_format_mode, "CODE_ONLY")

        # Verify detail endpoint returns clean separated fields
        detail_res = self.trainer_client.get(f"/api/v1/xen/jobs/{legacy_job_1.id}")
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data["intent"], "TEACHING")
        self.assertEqual(detail_res.data["format_mode"], "CODE_ONLY")

        # Verify chunks endpoint returns clean separated fields
        chunk_res = self.trainer_client.get(f"/api/v1/xen/jobs/{legacy_job_1.id}/chunks")
        self.assertEqual(chunk_res.status_code, status.HTTP_200_OK)
        self.assertEqual(chunk_res.data["intent"], "TEACHING")
        self.assertEqual(chunk_res.data["format_mode"], "CODE_ONLY")

        # Legacy job with true intent
        legacy_job_2 = XenJob.objects.create(
            user=self.admin,
            role=UserRole.ADMIN,
            intent="ADMIN_INSPECTION",
            format_mode="",
            prompt="Audit status",
            idempotency_key="legacy-2",
            status=XenJobStatus.COMPLETED,
            response_summary="Audit clean",
            response_payload={"decoded": {"text": "Audit clean", "is_complete": True}},
        )
        self.assertEqual(legacy_job_2.effective_intent, "ADMIN_INSPECTION")
        self.assertEqual(legacy_job_2.effective_format_mode, "DEFAULT_EDUCATIONAL")

        detail_res_2 = self.admin_client.get(f"/api/v1/xen/jobs/{legacy_job_2.id}")
        self.assertEqual(detail_res_2.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res_2.data["intent"], "ADMIN_INSPECTION")
        self.assertEqual(detail_res_2.data["format_mode"], "DEFAULT_EDUCATIONAL")

    # --------------------------------------------------------------------------
    # BLOCKER 2: Kaggle Version 11 Worker Contract & Compatibility Tests
    # --------------------------------------------------------------------------

    def test_version_11_worker_claim_heartbeat_complete_lifecycle(self):
        """
        Tests the EXACT request payloads sent by Kaggle Version 11 worker:
        - Claim with metadata
        - Heartbeat
        - Batch completion with {worker_id, text, finish_reason, usage}
        """
        # Step 1: Create a job in queue
        res_job = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {"prompt": "Write a Python script that calculates prime numbers.", "intent": "TEACHING", "idempotency_key": "v11-e2e-1"},
            format="json",
        )
        job_id = res_job.data["job_id"]

        # Step 2: Version 11 worker claims job (Payload from build_worker_notebook.py line 676-685)
        v11_worker_id = f"kaggle-dual-t4-{uuid.uuid4().hex[:8]}"
        claim_payload = {
            "worker_id": v11_worker_id,
            "metadata": {
                "gpu": "Dual NVIDIA Tesla T4 (29.12 GiB VRAM)",
                "model": "Xen-Step-700",
                "assistant": "Xen",
                "uptime_seconds": 3600,
                "jobs_completed": 0,
            },
        }

        claim_res = self.worker_client.post(
            "/api/v1/xen/worker/claim",
            claim_payload,
            format="json",
        )
        self.assertEqual(claim_res.status_code, status.HTTP_200_OK)
        self.assertEqual(claim_res.data["status"], "claimed")
        self.assertEqual(claim_res.data["job"]["id"], job_id)
        self.assertEqual(claim_res.data["job"]["intent"], "TEACHING")
        self.assertEqual(claim_res.data["job"]["format_mode"], "DEFAULT_EDUCATIONAL")

        job = XenJob.objects.get(id=job_id)
        self.assertEqual(job.status, XenJobStatus.CLAIMED)
        self.assertEqual(job.worker_id, v11_worker_id)
        self.assertIsNotNone(job.lease_expires_at)

        # Step 3: Version 11 worker sends heartbeat (Payload from build_worker_notebook.py line 655)
        hb_payload = {
            "worker_id": v11_worker_id,
        }
        hb_res = self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/heartbeat",
            hb_payload,
            format="json",
        )
        self.assertEqual(hb_res.status_code, status.HTTP_200_OK)
        self.assertEqual(hb_res.data["status"], "ok")
        job.refresh_from_db()
        self.assertEqual(job.status, XenJobStatus.RUNNING)

        # Step 4: Version 11 worker submits batch completion (Payload from build_worker_notebook.py line 760-764)
        model_output_text = (
            "Here is a Python function to check for primes:\n\n"
            "```python\n"
            "def is_prime(n):\n"
            "    if n < 2:\n"
            "        return False\n"
            "    for i in range(2, int(n**0.5) + 1):\n"
            "        if n % i == 0:\n"
            "            return False\n"
            "    return True\n"
            "```\n\n"
            "This iterates up to sqrt(n) for efficiency."
        )

        complete_payload = {
            "worker_id": v11_worker_id,
            "text": model_output_text,
            "finish_reason": "stop",
            "usage": {
                "prompt_tokens": 128,
                "completion_tokens": 64,
                "total_tokens": 192,
            },
        }

        comp_res = self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            complete_payload,
            format="json",
        )
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertEqual(comp_res.data["status"], "completed")

        job.refresh_from_db()
        self.assertEqual(job.status, XenJobStatus.COMPLETED)
        self.assertIn("def is_prime(n):", job.response_summary)

        # Step 5: Frontend reads completion via /chunks endpoint (batch fallback reconciliation)
        chunks_res = self.trainer_client.get(f"/api/v1/xen/jobs/{job_id}/chunks")
        self.assertEqual(chunks_res.status_code, status.HTTP_200_OK)
        self.assertTrue(chunks_res.data["is_complete"])
        self.assertEqual(chunks_res.data["delivery_mode"], "batch_fallback")
        self.assertEqual(chunks_res.data["intent"], "TEACHING")
        self.assertEqual(chunks_res.data["format_mode"], "DEFAULT_EDUCATIONAL")
        self.assertEqual(chunks_res.data["response"]["text"], job.response_summary)
        self.assertTrue(chunks_res.data["response"]["syntax_valid"])

    def test_version_11_worker_fail_reporting(self):
        """Tests failure reporting using exact Version 11 payload (build_worker_notebook.py line 780-784)."""
        # Create and claim job
        res_job = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {"prompt": "Trigger OOM test.", "idempotency_key": "v11-fail-1"},
            format="json",
        )
        job_id = res_job.data["job_id"]
        v11_worker_id = f"kaggle-dual-t4-{uuid.uuid4().hex[:8]}"

        self.worker_client.post(
            "/api/v1/xen/worker/claim",
            {"worker_id": v11_worker_id},
            format="json",
        )

        # Post failure
        fail_payload = {
            "worker_id": v11_worker_id,
            "error_code": "INFERENCE_EXECUTION_ERROR",
            "error_message": "CUDA out of memory while allocating KV cache",
        }
        fail_res = self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/fail",
            fail_payload,
            format="json",
        )
        self.assertEqual(fail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(fail_res.data["status"], "failed")

        job = XenJob.objects.get(id=job_id)
        self.assertEqual(job.status, XenJobStatus.FAILED)
        self.assertEqual(job.error_code, "WORKER_EXECUTION_ERROR")

        # Reader gets failed status
        chunks_res = self.trainer_client.get(f"/api/v1/xen/jobs/{job_id}/chunks")
        self.assertEqual(chunks_res.status_code, status.HTTP_200_OK)
        self.assertTrue(chunks_res.data["is_failed"])
        self.assertEqual(chunks_res.data["error"]["code"], "WORKER_EXECUTION_ERROR")

    def test_worker_security_and_lease_enforcement(self):
        """Worker authorization, worker mismatch, and lease expiry enforcement."""
        res_job = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {"prompt": "Security test prompt.", "idempotency_key": "sec-test-1"},
            format="json",
        )
        job_id = res_job.data["job_id"]
        v11_worker_id = "kaggle-worker-legit"

        self.worker_client.post(
            "/api/v1/xen/worker/claim",
            {"worker_id": v11_worker_id},
            format="json",
        )

        # 1. Reject invalid secret
        unauth_client = APIClient()
        unauth_client.credentials(HTTP_X_WORKER_SECRET="bad-secret")
        res = unauth_client.post(f"/api/v1/xen/worker/jobs/{job_id}/complete", {"worker_id": v11_worker_id, "text": "foo"})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Reject worker mismatch (impostor trying to complete someone else's claimed job)
        impostor_res = self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {"worker_id": "kaggle-worker-impostor", "text": "hijacked"},
            format="json",
        )
        self.assertEqual(impostor_res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(impostor_res.data["code"], "WORKER_MISMATCH")

        # 3. Reject completion after lease expiration
        job = XenJob.objects.get(id=job_id)
        job.lease_expires_at = timezone.now() - timedelta(seconds=5)
        job.save(update_fields=["lease_expires_at"])

        expired_res = self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {"worker_id": v11_worker_id, "text": "too late"},
            format="json",
        )
        self.assertEqual(expired_res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(expired_res.data["code"], "JOB_NOT_ACTIVE")

    def test_long_prompt_with_full_circuit_context_and_code_only_budgets_within_4000(self):
        """Regression: 1500-char prompt + full circuit envelope + CODE_ONLY must fit <= 4000 chars and not 400 CONTEXT_TOO_LARGE."""
        long_prompt = "Check my Arduino LED wiring and write the fixed sketch.\n" * 28  # ~1568 chars
        large_context = {
            "source": "virtual-lab",
            "circuit": {
                "running": True,
                "parts": [{"id": f"part_{i:02d}", "type": "resistor" if i % 2 else "led"} for i in range(32)],
                "wires": [
                    {"from": {"partId": f"part_{i:02d}", "pinId": "A"}, "to": {"partId": f"part_{(i+1)%32:02d}", "pinId": "B"}}
                    for i in range(32)
                ],
                "readings": [{"instrument": "multimeter", "source": "simulated", "value": 4.95, "unit": "V", "probeA": "uno:5V", "probeB": "uno:GND"}],
            },
            "lesson": {"id": "led-blink", "title": "LED Blink Basics", "concepts": ["ohm-law", "current-limiting", "gpio"]},
        }
        res = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {
                "prompt": long_prompt,
                "format_preference": "CODE_ONLY",
                "context_envelope": large_context,
                "idempotency_key": "budget-test-1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED, res.data)
        job = XenJob.objects.get(id=res.data["job_id"])
        self.assertLessEqual(len(job.prompt), 4000)
        self.assertIn("[MISSION CONTEXT]", job.prompt)
        self.assertIn("Check my Arduino LED wiring", job.prompt)

    def test_code_only_retry_directive_stays_within_v11_4000_char_limit(self):
        """Regression: Attempt 1 CODE_ONLY retry prepend must keep job.prompt <= 4000 chars for V11 server.py."""
        prompt_3900 = "Write python sorting code.\n" + ("x" * 3800)
        res = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {"prompt": prompt_3900, "format_preference": "CODE_ONLY", "idempotency_key": "retry-limit-1"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        job_id = res.data["job_id"]
        self.worker_client.post("/api/v1/xen/worker/claim", {"worker_id": "v11-retry-worker"}, format="json")
        comp_res = self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {"worker_id": "v11-retry-worker", "text": "Here is prose:\n```python\nprint(1)\n```"},
            format="json",
        )
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertEqual(comp_res.data["status"], "requeued_for_retry")
        job = XenJob.objects.get(id=job_id)
        self.assertLessEqual(len(job.prompt), 4000)
        self.assertIn("MANDATORY STRICT RETRY DIRECTIVE", job.prompt)

    def test_heartbeat_and_complete_preserve_worker_metadata(self):
        """Regression: V11 heartbeat/complete without metadata must not wipe metadata from /claim."""
        res_job = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {"prompt": "Explain resistors.", "idempotency_key": "hb-meta-1"},
            format="json",
        )
        job_id = res_job.data["job_id"]
        worker_id = "kaggle-dual-t4-meta"
        self.worker_client.post(
            "/api/v1/xen/worker/claim",
            {"worker_id": worker_id, "metadata": {"gpu": "Dual NVIDIA Tesla T4", "model": "Xen-Step-700"}},
            format="json",
        )
        self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/heartbeat",
            {"worker_id": worker_id},
            format="json",
        )
        hb = XenWorkerHeartbeat.objects.get(worker_id=worker_id)
        self.assertEqual(hb.metadata.get("gpu"), "Dual NVIDIA Tesla T4")
        self.assertEqual(hb.metadata.get("model"), "Xen-Step-700")

        self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/complete",
            {"worker_id": worker_id, "text": "A resistor limits current."},
            format="json",
        )
        hb.refresh_from_db()
        self.assertEqual(hb.metadata.get("gpu"), "Dual NVIDIA Tesla T4")

    def test_expired_lease_recovery_clears_stale_payload_and_chunks_surfaces_worker_state(self):
        """Regression: expired lease requeue clears stale payload/heartbeat, and /chunks & detail expose worker_available."""
        res_job = self.trainer_client.post(
            "/api/v1/xen/jobs",
            {"prompt": "Explain voltage.", "idempotency_key": "lease-clean-1"},
            format="json",
        )
        job_id = res_job.data["job_id"]

        # Offline worker visibility on /chunks and detail
        chunks_offline = self.trainer_client.get(f"/api/v1/xen/jobs/{job_id}/chunks")
        detail_offline = self.trainer_client.get(f"/api/v1/xen/jobs/{job_id}")
        self.assertEqual(chunks_offline.status_code, status.HTTP_200_OK)
        self.assertFalse(chunks_offline.data["worker_available"])
        self.assertEqual(chunks_offline.data["queue_position"], 1)
        self.assertFalse(chunks_offline.data["lease_expired"])
        self.assertEqual(detail_offline.data["intent"], "TEACHING")
        self.assertEqual(detail_offline.data["format_mode"], "DEFAULT_EDUCATIONAL")
        self.assertFalse(detail_offline.data["lease_expired"])

        # Claim, write partial chunk, then expire lease without polling another job yet
        self.worker_client.post("/api/v1/xen/worker/claim", {"worker_id": "worker-1"}, format="json")
        self.worker_client.post(
            f"/api/v1/xen/worker/jobs/{job_id}/chunk",
            {"worker_id": "worker-1", "seq": 1, "delta": "stale chunk"},
            format="json",
        )
        job = XenJob.objects.get(id=job_id)
        job.lease_expires_at = timezone.now() - timedelta(seconds=10)
        job.save(update_fields=["lease_expires_at"])

        # Before recovery runs, chunks/detail expose lease_expired=True
        expired_chunks = self.trainer_client.get(f"/api/v1/xen/jobs/{job_id}/chunks")
        self.assertTrue(expired_chunks.data["lease_expired"])

        # Requeue only via claim recovery check (create another job first? No, claim_count=1 will be requeued & reclaimed by same claim call; verify clean payload before returning or test direct requeue by making another older queued job? Even simpler: inspect DB cleanup via a second claim on an older queued job!)
        older_job = XenJob.objects.create(
            user=self.trainer, role=UserRole.TRAINER, prompt="Older job", idempotency_key="older-job-1",
            status=XenJobStatus.QUEUED,
        )
        XenJob.objects.filter(id=older_job.id).update(created_at=timezone.now() - timedelta(minutes=5))
        claim_res = self.worker_client.post("/api/v1/xen/worker/claim", {"worker_id": "worker-2"}, format="json")
        self.assertEqual(claim_res.data["job"]["id"], str(older_job.id))

        # Now original job was recovered to QUEUED (not yet claimed): stale payload/heartbeat must be clean!
        job.refresh_from_db()
        self.assertEqual(job.status, XenJobStatus.QUEUED)
        self.assertEqual(job.response_payload, {})
        self.assertIsNone(job.heartbeat_at)
        recovered_chunks = self.trainer_client.get(f"/api/v1/xen/jobs/{job_id}/chunks")
        self.assertEqual(recovered_chunks.data["chunks"], [])
        self.assertTrue(recovered_chunks.data["worker_available"])
        self.assertEqual(recovered_chunks.data["queue_position"], 1)
