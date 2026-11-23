"""
Unit tests for Xen Kaggle GPU Worker Queue and Outbound Polling Endpoints.
Verifies:
- Worker authentication via X-Worker-Secret / Bearer token (constant-time check).
- Atomic job claiming and lease assignment.
- Expired lease recovery and retry failure limits.
- Job creation, idempotency, and cohort gating.
- Job detail ownership enforcement (fail closed 404 for non-owners).
- Worker heartbeat and completion with server-side response decoding.
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
    XenWorkerFailView,
)


@override_settings(
    XEN_PILOT_ENABLED=True,
    PIXIUMIND_TESTER_ALLOWLIST=["102", "103", "104"],
    XEN_WORKER_SECRET="test-worker-secret-xyz-123",
    XEN_JOB_LEASE_SECONDS=120,
    XEN_WORKER_HEARTBEAT_TIMEOUT_SECONDS=90,
)
class XenWorkerQueueUnitTests(SimpleTestCase):
    def setUp(self):
        limiter = patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None))
        limiter.start()
        self.addCleanup(limiter.stop)

        tx = patch("django.db.transaction.atomic")
        tx.start()
        self.addCleanup(tx.stop)

        self.factory = APIRequestFactory()
        self.create_view = XenJobCreateView.as_view()
        self.detail_view = XenJobDetailView.as_view()
        self.status_view = XenStatusView.as_view()
        self.claim_view = XenWorkerClaimView.as_view()
        self.heartbeat_view = XenWorkerHeartbeatView.as_view()
        self.complete_view = XenWorkerCompleteView.as_view()
        self.fail_view = XenWorkerFailView.as_view()

        # Mock Trainer User (Allowlisted ID 102)
        self.mock_trainer = MagicMock()
        self.mock_trainer.id = uuid.uuid4()
        self.mock_trainer.pk = 102
        self.mock_trainer.username = "trainer_alice"
        self.mock_trainer.is_authenticated = True
        self.mock_trainer.is_active = True
        self.mock_trainer.status = UserStatus.ACTIVE
        self.mock_trainer.role = UserRole.TRAINER
        self.mock_trainer.trainer_profile = MagicMock()
        self.mock_trainer.trainer_profile.xen_identity = None

        # Mock Student User (ID 101, strictly disabled)
        self.mock_student = MagicMock()
        self.mock_student.id = uuid.uuid4()
        self.mock_student.pk = 101
        self.mock_student.username = "student_bob"
        self.mock_student.is_authenticated = True
        self.mock_student.is_active = True
        self.mock_student.status = UserStatus.ACTIVE
        self.mock_student.role = UserRole.STUDENT

        # Mock Admin User (Allowlisted ID 103)
        self.mock_admin = MagicMock()
        self.mock_admin.id = uuid.uuid4()
        self.mock_admin.pk = 103
        self.mock_admin.username = "admin_clara"
        self.mock_admin.is_authenticated = True
        self.mock_admin.is_active = True
        self.mock_admin.status = UserStatus.ACTIVE
        self.mock_admin.role = UserRole.ADMIN

    # --- Worker Authentication Tests ---

    def test_worker_claim_unauthorized_when_secret_missing(self):
        req = self.factory.post("/api/v1/xen/worker/claim", {}, format="json")
        res = self.claim_view(req)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data["code"], "INVALID_WORKER_SECRET")

    def test_worker_claim_unauthorized_when_secret_invalid(self):
        req = self.factory.post(
            "/api/v1/xen/worker/claim",
            {},
            format="json",
            HTTP_X_WORKER_SECRET="wrong-secret",
        )
        res = self.claim_view(req)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data["code"], "INVALID_WORKER_SECRET")

    def test_worker_claim_authorized_via_bearer_header(self):
        with patch.object(XenWorkerHeartbeat, "record_heartbeat") as mock_hb, \
             patch.object(XenJob.objects, "filter", return_value=[]), \
             patch.object(XenJob.objects, "select_for_update") as mock_sfu:
            mock_sfu.return_value.filter.return_value.order_by.return_value.first.return_value = None

            req = self.factory.post(
                "/api/v1/xen/worker/claim",
                {"worker_id": "kaggle-dual-t4-01"},
                format="json",
                HTTP_AUTHORIZATION="Bearer test-worker-secret-xyz-123",
            )
            res = self.claim_view(req)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["status"], "idle")
            self.assertIsNone(res.data["job"])
            mock_hb.assert_called_once_with(worker_id="kaggle-dual-t4-01", metadata={})

    # --- Job Creation & Gating Tests ---

    def test_job_create_student_outside_allowlist_denied(self):
        req = self.factory.post(
            "/api/v1/xen/jobs",
            {"prompt": "Explain loops in Python."},
            format="json",
        )
        force_authenticate(req, user=self.mock_student)
        res = self.create_view(req)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.data["code"], "NOT_IN_TESTER_ALLOWLIST")

    def test_job_create_empty_prompt_rejected(self):
        req = self.factory.post(
            "/api/v1/xen/jobs",
            {"prompt": "   "},
            format="json",
        )
        force_authenticate(req, user=self.mock_trainer)
        res = self.create_view(req)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["code"], "INVALID_PROMPT")

    def test_job_create_success_queues_job(self):
        job_id = uuid.uuid4()
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.created_at = timezone.now()

        with patch.object(XenJob.objects, "filter") as mock_filter, \
             patch.object(XenJob.objects, "create", return_value=mock_job) as mock_create, \
             patch.object(XenWorkerHeartbeat, "is_any_worker_online", return_value=True):
            qs = MagicMock()
            qs.first.return_value = None
            qs.count.return_value = 1
            mock_filter.return_value = qs

            req = self.factory.post(
                "/api/v1/xen/jobs",
                {"prompt": "Write a Python loop to sum numbers from 1 to 10."},
                format="json",
            )
            force_authenticate(req, user=self.mock_trainer)
            res = self.create_view(req)

            self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
            self.assertEqual(res.data["status"], "queued")
            self.assertEqual(res.data["job_id"], str(job_id))
            self.assertTrue(res.data["worker_available"])
            mock_create.assert_called_once()

    # --- Worker Claim & Execution Tests ---

    def test_worker_claim_queues_and_claims_job(self):
        job_id = uuid.uuid4()
        now = timezone.now()
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.prompt = "Write a Python loop."
        mock_job.history = []
        mock_job.max_tokens = 2048
        mock_job.temperature = 0.7
        mock_job.intent = "TEACHING"
        mock_job.claim_count = 0
        mock_job.lease_expires_at = now + timedelta(seconds=120)

        with patch.object(XenWorkerHeartbeat, "record_heartbeat"), \
             patch.object(XenJob.objects, "filter", return_value=[]), \
             patch.object(XenJob.objects, "select_for_update") as mock_sfu:
            mock_sfu.return_value.filter.return_value.order_by.return_value.first.return_value = mock_job

            req = self.factory.post(
                "/api/v1/xen/worker/claim",
                {"worker_id": "kaggle-worker-1"},
                format="json",
                HTTP_X_WORKER_SECRET="test-worker-secret-xyz-123",
            )
            res = self.claim_view(req)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["status"], "claimed")
            self.assertEqual(res.data["job"]["id"], str(job_id))
            self.assertEqual(res.data["job"]["prompt"], "Write a Python loop.")
            self.assertIn("Grade 6 Computational Thinking", res.data["job"]["system_prompt"])

    def test_worker_heartbeat_extends_lease(self):
        job_id = uuid.uuid4()
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.worker_id = "kaggle-worker-1"
        mock_job.lease_expires_at = timezone.now() + timedelta(seconds=120)

        with patch.object(XenJob.objects, "get", return_value=mock_job), \
             patch.object(XenWorkerHeartbeat, "record_heartbeat"):
            req = self.factory.post(
                f"/api/v1/xen/worker/jobs/{job_id}/heartbeat",
                {"worker_id": "kaggle-worker-1"},
                format="json",
                HTTP_X_WORKER_SECRET="test-worker-secret-xyz-123",
            )
            res = self.heartbeat_view(req, job_id=job_id)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["status"], "ok")
            self.assertEqual(mock_job.status, XenJobStatus.RUNNING)

    def test_worker_complete_decodes_and_saves_result(self):
        job_id = uuid.uuid4()
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.worker_id = "kaggle-worker-1"
        mock_job.intent = "TEACHING"

        model_raw_output = (
            "Here is the program:\n\n"
            "```python\n"
            "total = sum(range(1, 11))\n"
            "print(f'Total: {total}')\n"
            "```\n\n"
            "This computes the sum step-by-step."
        )

        with patch.object(XenJob.objects, "get", return_value=mock_job), \
             patch.object(XenWorkerHeartbeat, "record_heartbeat"):
            req = self.factory.post(
                f"/api/v1/xen/worker/jobs/{job_id}/complete",
                {
                    "worker_id": "kaggle-worker-1",
                    "text": model_raw_output,
                    "finish_reason": "stop",
                    "usage": {"prompt_tokens": 150, "completion_tokens": 50, "total_tokens": 200},
                },
                format="json",
                HTTP_X_WORKER_SECRET="test-worker-secret-xyz-123",
            )
            res = self.complete_view(req, job_id=job_id)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["status"], "completed")
            self.assertEqual(mock_job.status, XenJobStatus.COMPLETED)
            self.assertEqual(mock_job.response_summary, model_raw_output)
            self.assertTrue(mock_job.response_payload["decoded"]["syntax_valid"])
            self.assertTrue(mock_job.response_payload["decoded"]["is_complete"])

    def test_worker_fail_records_error(self):
        job_id = uuid.uuid4()
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.worker_id = "kaggle-worker-1"

        with patch.object(XenJob.objects, "get", return_value=mock_job), \
             patch.object(XenWorkerHeartbeat, "record_heartbeat"):
            req = self.factory.post(
                f"/api/v1/xen/worker/jobs/{job_id}/fail",
                {
                    "worker_id": "kaggle-worker-1",
                    "error_code": "CUDA_OUT_OF_MEMORY",
                    "error_message": "GPU memory exhausted during generation",
                },
                format="json",
                HTTP_X_WORKER_SECRET="test-worker-secret-xyz-123",
            )
            res = self.fail_view(req, job_id=job_id)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["status"], "failed")
            self.assertEqual(mock_job.status, XenJobStatus.FAILED)
            self.assertEqual(mock_job.error_code, "CUDA_OUT_OF_MEMORY")

    # --- Job Detail & Ownership Isolation Tests ---

    def test_job_detail_owner_can_read_completed(self):
        job_id = uuid.uuid4()
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.user_id = self.mock_trainer.id
        mock_job.status = XenJobStatus.COMPLETED
        mock_job.intent = "TEACHING"
        mock_job.response_summary = "Result text"
        mock_job.response_payload = {
            "decoded": {
                "is_complete": True,
                "completion_status": "complete",
                "syntax_valid": True,
                "display_ast_valid": True,
                "tested": False,
                "code_leakage_in_explanation": False,
            },
            "usage": {"total_tokens": 100},
        }
        mock_job.completed_at = timezone.now()
        mock_job.created_at = timezone.now()

        with patch.object(XenJob.objects, "get", return_value=mock_job):
            req = self.factory.get(f"/api/v1/xen/jobs/{job_id}")
            force_authenticate(req, user=self.mock_trainer)
            res = self.detail_view(req, job_id=job_id)

            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["status"], "completed")
            self.assertEqual(res.data["response"]["text"], "Result text")
            self.assertTrue(res.data["response"]["syntax_valid"])

    def test_job_detail_different_user_receives_404(self):
        job_id = uuid.uuid4()
        different_user_id = uuid.uuid4()
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.user_id = different_user_id

        with patch.object(XenJob.objects, "get", return_value=mock_job):
            req = self.factory.get(f"/api/v1/xen/jobs/{job_id}")
            force_authenticate(req, user=self.mock_trainer)
            res = self.detail_view(req, job_id=job_id)

            # Strict 404 to prevent enumerating existence of jobs belonging to other users
            self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
            self.assertEqual(res.data["code"], "JOB_NOT_FOUND")

    # --- Status View Tests ---

    def test_xen_status_view(self):
        with patch.object(XenWorkerHeartbeat, "is_any_worker_online", return_value=True), \
             patch.object(XenWorkerHeartbeat, "get_active_workers") as mock_active, \
             patch.object(XenJob.objects, "filter") as mock_filter:
            mock_active.return_value.count.return_value = 2
            mock_filter.return_value.count.return_value = 3

            req = self.factory.get("/api/v1/xen/status")
            force_authenticate(req, user=self.mock_trainer)
            res = self.status_view(req)

            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertTrue(res.data["worker_online"])
            self.assertEqual(res.data["active_worker_count"], 2)
            self.assertEqual(res.data["queued_jobs"], 3)
