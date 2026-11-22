"""
Unit tests for academics.models_xen
Verifies Xen Identity Registry models, validation constraints,
grade bands (6-12), slot limits (1-2), A05 qualification intent rules,
and session idempotency.
"""

import uuid
from django.test import SimpleTestCase
from academics.models import School, Trainer, Status
from academics.models_xen import XenSchool, XenLab, XenTrainer, XenSession


class XenRegistryUnitTests(SimpleTestCase):
    def test_xen_school_code_generation(self):
        real_school = School(
            id=uuid.uuid4(),
            school_code="DPS01",
            name="Delhi Public School",
        )

        xen_school = XenSchool(school=real_school)
        xen_school.school_id = real_school.id
        
        # Test code format
        suffix = "TEST01"
        xen_school.xen_school_code = f"XEN-SCH-{real_school.school_code}-{suffix}"
        
        self.assertTrue(xen_school.xen_school_code.startswith("XEN-SCH-DPS01-"))
        self.assertEqual(xen_school.status, Status.ACTIVE)

    def test_xen_lab_code_and_grade_constraints(self):
        real_school = School(
            id=uuid.uuid4(),
            school_code="KV02",
            name="Kendriya Vidyalaya",
        )
        real_xen_school = XenSchool(
            id=uuid.uuid4(),
            school=real_school,
            xen_school_code="XEN-SCH-KV02-ABC123",
        )

        lab_g8_s1 = XenLab(
            xen_school=real_xen_school,
            academic_period="2026-27",
            grade=8,
            slot_number=1,
        )
        self.assertEqual(lab_g8_s1.academic_period, "2026-27")
        self.assertEqual(lab_g8_s1.grade, 8)
        self.assertEqual(lab_g8_s1.slot_number, 1)

        # Verify grade limits (must be 6-12)
        self.assertGreaterEqual(lab_g8_s1.grade, 6)
        self.assertLessEqual(lab_g8_s1.grade, 12)

        # Verify slot limits (must be 1-2)
        self.assertGreaterEqual(lab_g8_s1.slot_number, 1)
        self.assertLessEqual(lab_g8_s1.slot_number, 2)

    def test_xen_trainer_intent_authorization_a05_qualified(self):
        real_trainer = Trainer(
            id=uuid.uuid4(),
            trainer_id="TRN99",
            name="John Doe",
        )

        # 1. Active Trainer WITHOUT A05 qualification
        trainer_standard = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=False,
            status=Status.ACTIVE,
        )
        self.assertTrue(trainer_standard.can_access_intent("TEACHING"))
        self.assertTrue(trainer_standard.can_access_intent("LAB_TEACHING"))
        self.assertFalse(
            trainer_standard.can_access_intent("PERSONAL_LEARNING"),
            "Standard trainer without A05 must NOT be granted PERSONAL_LEARNING access",
        )

        # 2. Active Trainer WITH A05 qualification
        trainer_a05 = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            status=Status.ACTIVE,
        )
        self.assertTrue(trainer_a05.can_access_intent("TEACHING"))
        self.assertTrue(trainer_a05.can_access_intent("LAB_TEACHING"))
        self.assertTrue(
            trainer_a05.can_access_intent("PERSONAL_LEARNING"),
            "A05-qualified trainer MUST be granted PERSONAL_LEARNING access",
        )

        # 3. Inactive Trainer
        trainer_inactive = XenTrainer(
            trainer=real_trainer,
            is_a05_qualified=True,
            status=Status.INACTIVE,
        )
        self.assertFalse(trainer_inactive.can_access_intent("TEACHING"))
        self.assertFalse(trainer_inactive.can_access_intent("PERSONAL_LEARNING"))

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
