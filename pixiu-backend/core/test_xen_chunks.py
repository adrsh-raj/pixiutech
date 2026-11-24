from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models_xen import XenJob, XenJobStatus
from accounts.models import User


@override_settings(XEN_PILOT_ENABLED=True, XEN_WORKER_SECRET="local-test-only",
                   PIXIUMIND_TESTER_ALLOWLIST=["102", "103"])
class JobStreamTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(id=102, username="owner", role="trainer")
        self.other = User.objects.create_user(id=103, username="other", role="trainer")
        self.lease = timezone.now() + timedelta(minutes=2)
        self.job = XenJob.objects.create(user=self.owner, role="trainer", prompt="Explain",
                                         idempotency_key="job", claim_count=1, worker_id="worker",
                                         lease_expires_at=self.lease, status=XenJobStatus.CLAIMED)
        self.reader = APIClient()
        self.reader.force_authenticate(self.owner)
        self.worker = APIClient()
        self.worker.credentials(HTTP_X_WORKER_SECRET="local-test-only")
        self.read_path = f"/api/v1/xen/jobs/{self.job.pk}/chunks"
        self.write_path = f"/api/v1/xen/worker/jobs/{self.job.pk}/"

    def append(self, seq, delta, worker="worker"):
        return self.worker.post(self.write_path + "chunk", {"seq": seq, "delta": delta, "worker_id": worker}, format="json")

    def test_incremental_and_final(self):
        self.assertEqual(self.append(1, "Haan ").status_code, 200)
        partial = self.reader.get(self.read_path).json()
        self.assertFalse(partial["is_complete"])
        self.assertEqual(partial["delivery_mode"], "incremental")
        self.assertEqual(partial["chunks"][0]["delta"], "Haan ")
        self.assertEqual(self.append(2, "bhai").status_code, 200)
        self.assertEqual(self.append(2, "bhai").status_code, 200)
        delta = self.reader.get(self.read_path, {"after": 1}).json()["chunks"]
        self.assertEqual([c["delta"] for c in delta], ["bhai"])
        self.job.refresh_from_db()
        self.assertEqual(self.job.lease_expires_at, self.lease)
        self.assertEqual(self.worker.post(self.write_path + "complete", {"worker_id":"worker","text":"Haan bhai"}, format="json").status_code, 200)
        self.assertEqual(self.reader.get(self.read_path).json()["response"]["text"], "Haan bhai")
        self.assertEqual(self.append(3, "!").status_code, 409)

    def test_access_order_size_and_lease(self):
        self.reader.force_authenticate(self.other)
        self.assertEqual(self.reader.get(self.read_path).status_code, 404)
        self.assertEqual(self.reader.post(self.write_path + "chunk", {}, format="json").status_code, 401)
        self.assertEqual(self.append(1, "a", "another-worker").status_code, 409)
        self.assertEqual(self.append(2, "gap").status_code, 409)
        self.assertEqual(self.append(1, "a"*4097).status_code, 400)
        self.assertEqual(self.append(1, "a").status_code, 200)
        self.assertEqual(self.append(1, "conflict").status_code, 409)
        self.job.lease_expires_at = timezone.now() - timedelta(seconds=1)
        self.job.save(update_fields=["lease_expires_at"])
        self.assertEqual(self.append(2, "expired").status_code, 409)

    def test_reservation_replay_and_mismatch(self):
        from unittest.mock import patch
        with patch("core.xen_views.check_xen_rate_limit", return_value=(True, 1, None)):
            body = {"prompt": "Explain this wire", "idempotency_key": "deliberate-launch"}
            first = self.reader.post("/api/v1/xen/jobs", body, format="json")
            replay = self.reader.post("/api/v1/xen/jobs", body, format="json")
            self.assertEqual(first.status_code, 202)
            self.assertEqual(first.json()["job_id"], replay.json()["job_id"])
            for change in ({"prompt": "Different wire"}, {"max_tokens": 150}, {"temperature": 0.2}):
                response = self.reader.post("/api/v1/xen/jobs", {**body, **change}, format="json")
                self.assertEqual(response.status_code, 409)

    def test_batch_worker_reports_batch_delivery(self):
        body = {"worker_id": "worker", "text": "Complete answer"}
        self.assertEqual(self.worker.post(self.write_path + "complete", body, format="json").status_code, 200)
        data = self.reader.get(self.read_path).json()
        self.assertEqual(data["delivery_mode"], "batch_fallback")
        self.assertEqual(data["chunks"], [])
        self.assertEqual(data["response"]["text"], "Complete answer")
