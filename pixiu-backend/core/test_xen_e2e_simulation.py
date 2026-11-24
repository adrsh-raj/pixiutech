"""
End-to-End Simulation of Xen Kaggle GPU Outbound Worker and Django Job Queue.
Simulates the exact end-to-end lifecycle:
1. Allowlisted Trainer submits prompt to Django Xen Job queue.
2. Django validates cohort gating, rate limits, and persists job in queued state (HTTP 202).
3. Outbound Kaggle GPU worker polls /api/v1/xen/worker/claim and atomically claims job.
4. Worker sends heartbeat to extend lease during generation.
5. Worker submits completed response to /api/v1/xen/worker/jobs/<job_id>/complete.
6. Django decodes and sanitizes response server-side and marks job completed.
7. Trainer polls /api/v1/xen/jobs/<job_id> and receives verified, AST-valid response.
"""

from datetime import timedelta
import json
import uuid
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from academics.models_xen import XenJob, XenJobStatus, XenWorkerHeartbeat
from accounts.models import UserRole, UserStatus
from core.xen_views import (
    XenJobCreateView,
    XenJobDetailView,
    XenStatusView,
    XenWorkerClaimView,
    XenWorkerHeartbeatView,
    XenWorkerCompleteView,
)


@override_settings(
    XEN_PILOT_ENABLED=True,
    PIXIUMIND_TESTER_ALLOWLIST=["102", "103"],
    XEN_WORKER_SECRET="authoritative-kaggle-worker-secret-2026",
    XEN_JOB_LEASE_SECONDS=120,
    XEN_WORKER_HEARTBEAT_TIMEOUT_SECONDS=90,
)
class XenEndToEndWorkerSimulationTest(SimpleTestCase):
    def setUp(self):
        limiter = patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None))
        limiter.start()
        self.addCleanup(limiter.stop)

        tx = patch("django.db.transaction.atomic")
        tx.start()
        self.addCleanup(tx.stop)

        sv = patch.object(XenJob, "save")
        sv.start()
        self.addCleanup(sv.stop)

        self.factory = APIRequestFactory()
        self.create_view = XenJobCreateView.as_view()
        self.detail_view = XenJobDetailView.as_view()
        self.status_view = XenStatusView.as_view()
        self.claim_view = XenWorkerClaimView.as_view()
        self.heartbeat_view = XenWorkerHeartbeatView.as_view()
        self.complete_view = XenWorkerCompleteView.as_view()

        # Mock Trainer User (Allowlisted ID 102)
        self.mock_trainer = MagicMock()
        self.mock_trainer.id = uuid.uuid4()
        self.mock_trainer.pk = 102
        self.mock_trainer.username = "trainer_lead"
        self.mock_trainer.is_authenticated = True
        self.mock_trainer.is_active = True
        self.mock_trainer.status = UserStatus.ACTIVE
        self.mock_trainer.role = UserRole.TRAINER
        self.mock_trainer.trainer_profile = MagicMock()
        self.mock_trainer.trainer_profile.xen_identity = None

    def test_full_e2e_job_lifecycle(self):
        # In-memory storage to simulate real database persistence across views
        stored_jobs = {}
        job_id = uuid.uuid4()
        now = timezone.now()

        # Simulate job object
        job = XenJob(
            id=job_id,
            user_id=self.mock_trainer.id,
            role=UserRole.TRAINER,
            intent="TEACHING",
            status=XenJobStatus.QUEUED,
            idempotency_key="sim-idemp-001",
            prompt="Write a Python program to calculate factorial using recursion.",
            history=[],
            max_tokens=1024,
            temperature=0.0,
            claim_count=0,
            created_at=now,
        )
        stored_jobs[job_id] = job

        # -------------------------------------------------------------
        # STEP 1: Portal / Trainer submits job to POST /api/v1/xen/jobs
        # -------------------------------------------------------------
        with patch.object(XenJob.objects, "filter") as mock_filter, \
             patch.object(XenJob.objects, "get_or_create", return_value=(job, True)), \
             patch.object(XenWorkerHeartbeat, "is_any_worker_online", return_value=True):
            qs = MagicMock()
            qs.first.return_value = None
            qs.count.return_value = 1
            mock_filter.return_value = qs

            post_req = self.factory.post(
                "/api/v1/xen/jobs",
                {
                    "prompt": "Write a Python program to calculate factorial using recursion.",
                    "intent": "TEACHING",
                    "idempotency_key": "sim-idemp-001",
                },
                format="json",
            )
            force_authenticate(post_req, user=self.mock_trainer)
            create_res = self.create_view(post_req)

            self.assertEqual(create_res.status_code, status.HTTP_202_ACCEPTED)
            self.assertEqual(create_res.data["status"], "queued")
            self.assertEqual(create_res.data["job_id"], str(job_id))
            self.assertTrue(create_res.data["worker_available"])

        # -------------------------------------------------------------
        # STEP 2: Kaggle GPU Worker polls POST /api/v1/xen/worker/claim
        # -------------------------------------------------------------
        with patch.object(XenWorkerHeartbeat, "record_heartbeat"), \
             patch.object(XenJob.objects, "filter", return_value=[]), \
             patch.object(XenJob.objects, "select_for_update") as mock_sfu:
            mock_sfu.return_value.filter.return_value.order_by.return_value.first.return_value = job

            claim_req = self.factory.post(
                "/api/v1/xen/worker/claim",
                {
                    "worker_id": "kaggle-dual-t4-01",
                    "metadata": {"gpu": "Dual Tesla T4", "vram_gib": 29.12},
                },
                format="json",
                HTTP_X_WORKER_SECRET="authoritative-kaggle-worker-secret-2026",
            )
            claim_res = self.claim_view(claim_req)

            self.assertEqual(claim_res.status_code, status.HTTP_200_OK)
            self.assertEqual(claim_res.data["status"], "claimed")
            self.assertEqual(claim_res.data["job"]["id"], str(job_id))
            self.assertIn("factorial", claim_res.data["job"]["prompt"])
            self.assertIn("Grade 6 Computational Thinking", claim_res.data["job"]["system_prompt"])

        # -------------------------------------------------------------
        # STEP 3: Worker sends heartbeat while running GPU inference
        # -------------------------------------------------------------
        with patch.object(XenJob.objects, "select_for_update", return_value=MagicMock(get=MagicMock(return_value=job))), \
             patch.object(XenWorkerHeartbeat, "record_heartbeat"):
            hb_req = self.factory.post(
                f"/api/v1/xen/worker/jobs/{job_id}/heartbeat",
                {"worker_id": "kaggle-dual-t4-01"},
                format="json",
                HTTP_X_WORKER_SECRET="authoritative-kaggle-worker-secret-2026",
            )
            hb_res = self.heartbeat_view(hb_req, job_id=job_id)
            self.assertEqual(hb_res.status_code, status.HTTP_200_OK)
            self.assertEqual(hb_res.data["status"], "ok")
            self.assertEqual(job.status, XenJobStatus.RUNNING)

        # -------------------------------------------------------------
        # STEP 4: Worker submits completed inference to Django
        # -------------------------------------------------------------
        model_raw_response = (
            "Here is the factorial program in Python:\n\n"
            "```python\n"
            "def factorial(n):\n"
            "    if n <= 1:\n"
            "        return 1\n"
            "    return n * factorial(n - 1)\n\n"
            "print(factorial(5))\n"
            "```\n\n"
            "This computes the factorial step by step."
        )

        with patch.object(XenJob.objects, "select_for_update", return_value=MagicMock(get=MagicMock(return_value=job))), \
             patch.object(XenWorkerHeartbeat, "record_heartbeat"):
            comp_req = self.factory.post(
                f"/api/v1/xen/worker/jobs/{job_id}/complete",
                {
                    "worker_id": "kaggle-dual-t4-01",
                    "text": model_raw_response,
                    "finish_reason": "stop",
                    "usage": {"prompt_tokens": 120, "completion_tokens": 65, "total_tokens": 185},
                },
                format="json",
                HTTP_X_WORKER_SECRET="authoritative-kaggle-worker-secret-2026",
            )
            comp_res = self.complete_view(comp_req, job_id=job_id)

            self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
            self.assertEqual(comp_res.data["status"], "completed")
            self.assertEqual(job.status, XenJobStatus.COMPLETED)
            self.assertTrue(job.response_payload["decoded"]["syntax_valid"])
            self.assertTrue(job.response_payload["decoded"]["display_ast_valid"])
            self.assertTrue(job.response_payload["decoded"]["is_complete"])

        # -------------------------------------------------------------
        # STEP 5: Trainer polls GET /api/v1/xen/jobs/<job_id>
        # -------------------------------------------------------------
        with patch.object(XenJob.objects, "get", return_value=job):
            poll_req = self.factory.get(f"/api/v1/xen/jobs/{job_id}")
            force_authenticate(poll_req, user=self.mock_trainer)
            poll_res = self.detail_view(poll_req, job_id=job_id)

            self.assertEqual(poll_res.status_code, status.HTTP_200_OK)
            self.assertEqual(poll_res.data["status"], "completed")
            self.assertIn("def factorial(n):", poll_res.data["response"]["text"])
            self.assertTrue(poll_res.data["response"]["syntax_valid"])
            self.assertTrue(poll_res.data["response"]["display_ast_valid"])
            self.assertFalse(poll_res.data["response"]["tested"])  # Truthfulness preserved
            self.assertEqual(poll_res.data["usage"]["total_tokens"], 185)
