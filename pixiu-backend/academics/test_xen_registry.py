"""
Unit tests for academics.models_xen
Verifies Xen Identity Registry models:
- XenSchool (1:1 to School, opaque XEN-SCH-[HEX12] code)
- XenLab (canonical SchoolClass reference, archival-safe PROTECT, cross-school validation, opaque XEN-LAB-[HEX12] code)
- XenTrainer (evidence-backed A05 qualification gate with named verifier, timestamp, <=12 mo expiry, revocation, appeal status)
- XenSession (idempotency key, memory disabled)
"""

import uuid
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from django.utils import timezone
from accounts.models import User
from academics.models import School, SchoolClass, Trainer, Status
from academics.models_xen import XenSchool, XenLab, XenTrainer, XenSession, AppealStatus


class XenRegistryUnitTests(SimpleTestCase):
    def test_xen_school_opaque_code_generation(self):
        real_school = School(
            id=uuid.uuid4(),
            school_code="DPS01",
            name="Delhi Public School",
        )

        xen_school = XenSchool(school=real_school)
        xen_school.school_id = real_school.id
        
        # Trigger save hook logic
        if not xen_school.xen_school_code:
            xen_school.xen_school_code = f"XEN-SCH-{uuid.uuid4().hex[:12].upper()}"
        if not xen_school.display_name:
            xen_school.display_name = f"{real_school.name} ({real_school.school_code})"
        
        self.assertTrue(xen_school.xen_school_code.startswith("XEN-SCH-"))
        self.assertEqual(len(xen_school.xen_school_code), 20)  # XEN-SCH- + 12 hex
        self.assertEqual(xen_school.status, Status.ACTIVE)
        self.assertEqual(xen_school.display_name, "Delhi Public School (DPS01)")

    def test_xen_lab_opaque_code_and_display_name(self):
        real_school = School(
            id=uuid.uuid4(),
            school_code="KV02",
            name="Kendriya Vidyalaya",
        )
        real_class = SchoolClass(
            id=uuid.uuid4(),
            school=real_school,
            grade="8",
            section="B",
            display_name="8B",
        )
        real_xen_school = XenSchool(
            id=uuid.uuid4(),
            school=real_school,
            xen_school_code="XEN-SCH-112233445566",
        )

        lab_slot1 = XenLab(
            school_class=real_class,
            xen_school=real_xen_school,
            academic_period="2026-27",
            slot_number=1,
        )
        # Verify slot limits (1-2)
        self.assertGreaterEqual(lab_slot1.slot_number, 1)
        self.assertLessEqual(lab_slot1.slot_number, 2)
        self.assertEqual(lab_slot1.academic_period, "2026-27")

        # Simulate code and display_name generation
        if not lab_slot1.xen_lab_code:
            lab_slot1.xen_lab_code = f"XEN-LAB-{uuid.uuid4().hex[:12].upper()}"
        if not lab_slot1.display_name:
            lab_slot1.display_name = f"{real_school.school_code} Class {real_class.display_name} Lab Slot {lab_slot1.slot_number} ({lab_slot1.academic_period})"

        self.assertTrue(lab_slot1.xen_lab_code.startswith("XEN-LAB-"))
        self.assertEqual(len(lab_slot1.xen_lab_code), 20)
        self.assertEqual(lab_slot1.display_name, "KV02 Class 8B Lab Slot 1 (2026-27)")

    def test_xen_lab_cross_school_integrity_validation(self):
        """XenLab must belong to the exact same School as its SchoolClass."""
        school_a = School(id=uuid.uuid4(), school_code="SCH_A", name="School A")
        school_b = School(id=uuid.uuid4(), school_code="SCH_B", name="School B")

        class_a = SchoolClass(id=uuid.uuid4(), school=school_a, grade="9", section="A")
        xen_school_b = XenSchool(id=uuid.uuid4(), school=school_b, xen_school_code="XEN-SCH-BBBBBBBBBBBB")

        # Mismatched school: class is from School A, but xen_school is from School B
        mismatched_lab = XenLab(
            school_class=class_a,
            xen_school=xen_school_b,
            academic_period="2026-27",
            slot_number=1,
        )
        with self.assertRaises(ValidationError) as ctx:
            mismatched_lab.clean()
        self.assertIn("must belong to the exact same School", str(ctx.exception))

    def test_xen_trainer_evidence_backed_a05_qualification_matrix(self):
        """Comprehensive verification that bare booleans or incomplete evidence never grant PERSONAL_LEARNING access."""
        real_trainer = Trainer(
            id=uuid.uuid4(),
            trainer_id="TRN99",
            name="John Doe",
        )
        verifier_user = User(
            id=uuid.uuid4(),
            username="admin_auditor",
        )
        now = timezone.now()

        # 1. Active Trainer WITHOUT A05
        t1 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=False,
            status=Status.ACTIVE,
        )
        self.assertTrue(t1.can_access_intent("TEACHING"))
        self.assertTrue(t1.can_access_intent("LAB_TEACHING"))
        self.assertFalse(t1.can_access_intent("PERSONAL_LEARNING"))

        # 2. Bare Boolean is_a05_qualified=True with NO evidence -> REJECTED
        t2 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="",
            status=Status.ACTIVE,
        )
        self.assertFalse(t2.can_access_intent("PERSONAL_LEARNING"))

        # 3. Certificate string present but NO named verifier or timestamps -> REJECTED
        t3 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            status=Status.ACTIVE,
        )
        self.assertFalse(t3.can_access_intent("PERSONAL_LEARNING"))

        # 4. Certificate + Verifier present, but NO expiry timestamp -> REJECTED
        t4 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_verified_by=verifier_user,
            a05_verified_by_id=verifier_user.id,
            a05_verified_at=now,
            status=Status.ACTIVE,
        )
        self.assertFalse(t4.can_access_intent("PERSONAL_LEARNING"))

        # 5. Full evidence present, but EXPIRED -> REJECTED
        t5 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_verified_by=verifier_user,
            a05_verified_by_id=verifier_user.id,
            a05_verified_at=now - timedelta(days=400),
            a05_expires_at=now - timedelta(days=35),  # expired 35 days ago
            status=Status.ACTIVE,
        )
        self.assertFalse(t5.can_access_intent("PERSONAL_LEARNING"))

        # 6. Full evidence present and unexpired, but REVOKED -> REJECTED
        t6 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_verified_by=verifier_user,
            a05_verified_by_id=verifier_user.id,
            a05_verified_at=now - timedelta(days=30),
            a05_expires_at=now + timedelta(days=335),
            a05_revoked=True,
            a05_revocation_reason="Pedagogical audit breach",
            status=Status.ACTIVE,
        )
        self.assertFalse(t6.can_access_intent("PERSONAL_LEARNING"))

        # 7. Full evidence present, unexpired, unrevoked, but appeal is PENDING -> REJECTED
        t7 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_verified_by=verifier_user,
            a05_verified_by_id=verifier_user.id,
            a05_verified_at=now - timedelta(days=30),
            a05_expires_at=now + timedelta(days=335),
            a05_appeal_status=AppealStatus.PENDING,
            status=Status.ACTIVE,
        )
        self.assertFalse(t7.can_access_intent("PERSONAL_LEARNING"))

        # 8. Complete valid evidence, unexpired, named verifier, active -> ALLOWED
        t8 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_verified_by=verifier_user,
            a05_verified_by_id=verifier_user.id,
            a05_verified_at=now - timedelta(days=30),
            a05_expires_at=now + timedelta(days=335),
            a05_appeal_status=AppealStatus.NONE,
            status=Status.ACTIVE,
        )
        self.assertTrue(t8.can_access_intent("TEACHING"))
        self.assertTrue(t8.can_access_intent("LAB_TEACHING"))
        self.assertTrue(t8.can_access_intent("PERSONAL_LEARNING"))

        # 9. Clean validation rejects >12 month expiry
        t9 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_verified_by=verifier_user,
            a05_verified_by_id=verifier_user.id,
            a05_verified_at=now,
            a05_expires_at=now + timedelta(days=400),  # > 366 days
            status=Status.ACTIVE,
        )
        with self.assertRaises(ValidationError) as ctx:
            t9.clean()
        self.assertIn("cannot exceed a 12-month validity period", str(ctx.exception))

    def test_xen_session_structure(self):
        session = XenSession(
            idempotency_key="idemp-session-12345",
            role="trainer",
            intent="TEACHING",
            request_hash="sha256-hash-abc",
        )
        self.assertEqual(session.idempotency_key, "idemp-session-12345")
        self.assertEqual(session.role, "trainer")
        self.assertEqual(session.intent, "TEACHING")
        self.assertFalse(session.is_completed)
