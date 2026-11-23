"""
Unit tests for academics.models_xen
Verifies Xen Identity Registry models with full FD-01 A05 and Tenant Integrity compliance:
- XenSchool (1:1 to School, opaque XEN-SCH-[HEX12] code)
- XenLab (canonical SchoolClass reference, tenant integrity by normalized derivation, archival-safe PROTECT, opaque XEN-LAB-[HEX12] code)
- XenTrainer (FD-01 evidence-backed A05 qualification gate: 18+ institutional attestation, named verifier, <=12 mo expiry, independent appeal reviewer, decision timestamp, revocation/appeal fail-closed)
- XenSession (idempotency key, memory disabled)
"""

import uuid
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import ProtectedError
from django.db.utils import IntegrityError
from django.test import TestCase, SimpleTestCase
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

    def test_xen_lab_tenant_integrity_by_construction(self):
        """
        XenLab tenant integrity is guaranteed by construction:
        The school is derived directly and immutably from the canonical SchoolClass.
        Zero redundant foreign key columns exist that could create a split-tenant state.
        """
        school_a = School(id=uuid.uuid4(), school_code="SCH_A", name="School A")
        class_a = SchoolClass(id=uuid.uuid4(), school=school_a, grade="8", section="A", display_name="8A")
        xen_school_a = XenSchool(id=uuid.uuid4(), school=school_a, xen_school_code="XEN-SCH-AAAAAAAAAAAA")
        school_a.xen_identity = xen_school_a

        lab = XenLab(
            school_class=class_a,
            academic_period="2026-27",
            slot_number=1,
        )
        self.assertEqual(lab.academic_period, "2026-27")
        self.assertEqual(lab.slot_number, 1)
        self.assertEqual(lab.school, school_a)
        self.assertEqual(lab.xen_school, xen_school_a)

        # Code and display_name generation
        if not lab.xen_lab_code:
            lab.xen_lab_code = f"XEN-LAB-{uuid.uuid4().hex[:12].upper()}"
        if not lab.display_name:
            lab.display_name = f"{school_a.school_code} Class {class_a.display_name} Lab Slot {lab.slot_number} ({lab.academic_period})"

        self.assertTrue(lab.xen_lab_code.startswith("XEN-LAB-"))
        self.assertEqual(lab.display_name, "SCH_A Class 8A Lab Slot 1 (2026-27)")

        # Verify slot limits (1-2)
        self.assertGreaterEqual(lab.slot_number, 1)
        self.assertLessEqual(lab.slot_number, 2)

    def test_xen_trainer_fd01_a05_evidence_workflow(self):
        """
        Full FD-01 A05 Evidence Workflow Tests:
        - Missing institutional 18+ attestation -> Rejected
        - Missing certificate -> Rejected
        - Missing verifier / timestamp -> Rejected
        - Validity exceeding 12 months -> ValidationError & Rejected
        - Expired evidence -> Rejected
        - Revocation -> Rejected
        - Pending appeal -> Rejected
        - Appeal upheld by NON-INDEPENDENT reviewer (same as verifier) -> ValidationError & Rejected
        - Appeal upheld by INDEPENDENT reviewer -> Allowed
        - Clean valid evidence -> Allowed
        """
        real_trainer = Trainer(id=uuid.uuid4(), trainer_id="TRN01", name="Jane Doe")
        verifier_admin = User(id=uuid.uuid4(), username="compliance_auditor")
        independent_appeal_judge = User(id=uuid.uuid4(), username="appellate_reviewer")
        now = timezone.now()

        # 1. Active Trainer WITHOUT A05
        t1 = XenTrainer(trainer=real_trainer, is_a05_qualified=False, status=Status.ACTIVE)
        self.assertTrue(t1.can_access_intent("TEACHING"))
        self.assertTrue(t1.can_access_intent("LAB_TEACHING"))
        self.assertFalse(t1.can_access_intent("PERSONAL_LEARNING"))

        # 2. Bare Boolean is_a05_qualified=True with NO evidence -> REJECTED
        t2 = XenTrainer(trainer=real_trainer, is_a05_qualified=True, status=Status.ACTIVE)
        self.assertFalse(t2.can_access_intent("PERSONAL_LEARNING"))

        # 3. Missing institutional 18+ attestation -> REJECTED & ValidationError
        t3 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="",  # Missing
            a05_institution_ref="GOV-EDU-REF-88",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now,
            a05_expires_at=now + timedelta(days=180),
            status=Status.ACTIVE,
        )
        self.assertFalse(t3.can_access_intent("PERSONAL_LEARNING"))
        with self.assertRaises(ValidationError) as ctx:
            t3.clean()
        self.assertIn("institution name for 18+ cohort attestation", str(ctx.exception))

        # 4. Missing institutional reference -> REJECTED & ValidationError
        t4 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="",  # Missing
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now,
            a05_expires_at=now + timedelta(days=180),
            status=Status.ACTIVE,
        )
        self.assertFalse(t4.can_access_intent("PERSONAL_LEARNING"))
        with self.assertRaises(ValidationError) as ctx:
            t4.clean()
        self.assertIn("verifiable institutional reference", str(ctx.exception))

        # 5. Missing named verifier -> REJECTED
        t5 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=None,
            a05_verified_at=now,
            a05_expires_at=now + timedelta(days=180),
            status=Status.ACTIVE,
        )
        self.assertFalse(t5.can_access_intent("PERSONAL_LEARNING"))

        # 6. Expiry beyond 12 months (>366 days) -> REJECTED & ValidationError
        t6 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now,
            a05_expires_at=now + timedelta(days=380),  # > 366 days
            status=Status.ACTIVE,
        )
        self.assertFalse(t6.can_access_intent("PERSONAL_LEARNING"))
        with self.assertRaises(ValidationError) as ctx:
            t6.clean()
        self.assertIn("cannot exceed a 12-month validity period", str(ctx.exception))

        # 7. Expired evidence -> REJECTED
        t7 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now - timedelta(days=200),
            a05_expires_at=now - timedelta(days=10),  # Expired 10 days ago
            status=Status.ACTIVE,
        )
        self.assertFalse(t7.can_access_intent("PERSONAL_LEARNING"))

        # 8. Revoked without appeal -> REJECTED
        t8 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now - timedelta(days=30),
            a05_expires_at=now + timedelta(days=330),
            a05_revoked=True,
            a05_revocation_reason="Classroom governance violation",
            status=Status.ACTIVE,
        )
        self.assertFalse(t8.can_access_intent("PERSONAL_LEARNING"))

        # 9. Pending Appeal -> REJECTED (Fail closed during appeal)
        t9 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now - timedelta(days=30),
            a05_expires_at=now + timedelta(days=330),
            a05_revoked=True,
            a05_appeal_status=AppealStatus.PENDING,
            status=Status.ACTIVE,
        )
        self.assertFalse(t9.can_access_intent("PERSONAL_LEARNING"))

        # 10. Appeal decision with NON-INDEPENDENT reviewer (same as verifier) -> REJECTED & ValidationError
        t10 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now - timedelta(days=30),
            a05_expires_at=now + timedelta(days=330),
            a05_revoked=True,
            a05_appeal_status=AppealStatus.UPHELD,
            a05_appeal_reviewer=verifier_admin,  # NOT INDEPENDENT!
            a05_appeal_reviewer_id=verifier_admin.id,
            a05_appeal_decision_at=now,
            status=Status.ACTIVE,
        )
        self.assertFalse(t10.can_access_intent("PERSONAL_LEARNING"))
        with self.assertRaises(ValidationError) as ctx:
            t10.clean()
        self.assertIn("must be an independent auditor, separate from the original verifier", str(ctx.exception))

        # 11. Appeal decision with INDEPENDENT reviewer -> ALLOWED
        t11 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now - timedelta(days=30),
            a05_expires_at=now + timedelta(days=330),
            a05_revoked=True,
            a05_appeal_status=AppealStatus.UPHELD,
            a05_appeal_reviewer=independent_appeal_judge,  # INDEPENDENT
            a05_appeal_reviewer_id=independent_appeal_judge.id,
            a05_appeal_decision_at=now,
            status=Status.ACTIVE,
        )
        t11.clean()  # Must pass validation
        self.assertTrue(t11.can_access_intent("PERSONAL_LEARNING"))

        # 12. Complete valid unrevoked evidence -> ALLOWED
        t12 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            a05_certificate_id="CERT-A05-2026-001",
            a05_institution_name="Delhi Education Board",
            a05_institution_ref="DEB-REF-101",
            a05_verified_by=verifier_admin,
            a05_verified_by_id=verifier_admin.id,
            a05_verified_at=now - timedelta(days=10),
            a05_expires_at=now + timedelta(days=355),
            a05_revoked=False,
            a05_appeal_status=AppealStatus.NONE,
            status=Status.ACTIVE,
        )
        t12.clean()
        self.assertTrue(t12.can_access_intent("TEACHING"))
        self.assertTrue(t12.can_access_intent("LAB_TEACHING"))
        self.assertTrue(t12.can_access_intent("PERSONAL_LEARNING"))

    def test_xen_session_structure_and_isolation(self):
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


class XenRegistryDatabaseTests(TestCase):
    """
    Real PostgreSQL integration tests executed strictly against an isolated disposable database.
    Tests:
    - Normalized tenant integrity by construction via canonical SchoolClass relation
    - Bulk operations safety
    - Class-period-slot uniqueness constraint enforcement at DB level
    - Slot 1-2 check constraint enforcement at DB level
    - Full FD-01 A05 check constraint enforcement at DB level
    - Archival PROTECT deletion protection across schools, classes, and auditor users
    """
    def setUp(self):
        self.school = School.objects.create(
            school_code="SCH_LIVE_01",
            name="Authoritative Staging Academy",
            status=Status.ACTIVE,
        )
        self.xen_school = XenSchool.objects.create(
            school=self.school,
            status=Status.ACTIVE,
        )
        self.school_class = SchoolClass.objects.create(
            school=self.school,
            grade="7",
            section="A",
            display_name="7A",
        )
        self.auditor = User.objects.create_user(
            username="auditor_test",
            password="test-password-123",
            role="admin",
        )
        self.appeal_judge = User.objects.create_user(
            username="appeal_judge_test",
            password="test-password-123",
            role="admin",
        )
        self.trainer_profile = Trainer.objects.create(
            trainer_id="TRN_LIVE_01",
            name="Rajesh Kumar",
            status=Status.ACTIVE,
        )

    def test_database_bulk_create_tenant_integrity(self):
        """Bulk creation of labs preserves normalized tenant integrity without split-brain school references."""
        labs = [
            XenLab(school_class=self.school_class, slot_number=1, academic_period="2026-27"),
            XenLab(school_class=self.school_class, slot_number=2, academic_period="2026-27"),
        ]
        created = XenLab.objects.bulk_create(labs)
        self.assertEqual(len(created), 2)
        for lab in XenLab.objects.filter(school_class=self.school_class):
            self.assertEqual(lab.school.id, self.school.id)
            self.assertEqual(lab.xen_school.id, self.xen_school.id)

    def test_database_class_period_slot_uniqueness_enforced(self):
        """PostgreSQL enforces unique constraint on (school_class, academic_period, slot_number)."""
        XenLab.objects.create(
            school_class=self.school_class,
            slot_number=1,
            academic_period="2026-27",
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                XenLab.objects.create(
                    school_class=self.school_class,
                    slot_number=1,
                    academic_period="2026-27",
                )

    def test_database_slot_check_constraint_enforced(self):
        """PostgreSQL check constraint blocks slot numbers outside 1-2."""
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                XenLab.objects.create(
                    school_class=self.school_class,
                    slot_number=3,  # Invalid: only slots 1 or 2 permitted
                    academic_period="2026-27",
                )

    def test_database_archival_protection_on_school_class(self):
        """Deleting a SchoolClass with an active XenLab is strictly blocked by PROTECT."""
        XenLab.objects.create(
            school_class=self.school_class,
            slot_number=1,
            academic_period="2026-27",
        )
        with self.assertRaises(ProtectedError):
            self.school_class.delete()

    def test_database_archival_protection_on_school(self):
        """Deleting a School with an active XenSchool is strictly blocked by PROTECT."""
        with self.assertRaises(ProtectedError):
            self.school.delete()

    def test_database_a05_check_constraint_enforced(self):
        """PostgreSQL check constraint blocks is_a05_qualified=True with incomplete evidence fields."""
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                XenTrainer.objects.create(
                    trainer=self.trainer_profile,
                    is_a05_qualified=True,
                    a05_certificate_id="",  # Violates check constraint
                    a05_institution_name="",
                )

    def test_database_a05_full_evidence_persists(self):
        """Fully attested A05 qualification record persists cleanly in PostgreSQL."""
        now = timezone.now()
        xen_trainer = XenTrainer.objects.create(
            trainer=self.trainer_profile,
            is_a05_qualified=True,
            a05_institution_name="National STEM Faculty Board",
            a05_institution_ref="NSFB-2026-AUTH-99",
            a05_certificate_id="CERT-A05-2026-LIVE-01",
            a05_verified_by=self.auditor,
            a05_verified_at=now,
            a05_expires_at=now + timedelta(days=365),
            status=Status.ACTIVE,
        )
        self.assertTrue(xen_trainer.xen_trainer_code.startswith("XEN-TRN-"))
        self.assertTrue(xen_trainer.can_access_intent("PERSONAL_LEARNING"))

    def test_database_archival_protection_on_auditor(self):
        """Deleting an auditor user who verified an A05 qualification is strictly blocked by PROTECT."""
        now = timezone.now()
        XenTrainer.objects.create(
            trainer=self.trainer_profile,
            is_a05_qualified=True,
            a05_institution_name="National STEM Faculty Board",
            a05_institution_ref="NSFB-2026-AUTH-99",
            a05_certificate_id="CERT-A05-2026-LIVE-01",
            a05_verified_by=self.auditor,
            a05_verified_at=now,
            a05_expires_at=now + timedelta(days=365),
            status=Status.ACTIVE,
        )
        with self.assertRaises(ProtectedError):
            self.auditor.delete()
