"""
Identity Registry Models for Xen (PixiuMind) Integration.

Canonical Architecture:
- XenSchool: 1:1 to academics.School (PROTECT on delete, opaque XEN-SCH-[HEX12] code)
- XenLab: canonical SchoolClass (grade+section) + academic period (2026-27) + slot (1 or 2)
  Tenant integrity is guaranteed by construction: school is derived strictly from
  the canonical SchoolClass relation (school_class.school), eliminating any redundant
  or conflicting foreign key columns.
  Archival-safe: PROTECT on SchoolClass.
- XenTrainer: 1:1 to academics.Trainer with full FD-01 evidence-backed A05 qualification gate:
  - Identifiable institution name & verifiable 18+ cohort reference
  - Named verifier (PROTECT) and verification timestamp
  - Maximum 12-month validity period
  - Independent appeal reviewer (enforced distinct from original verifier)
  - Appeal decision timestamp and recorded outcome
  - Revocation switch and expiry enforcement
  - Fail-closed PERSONAL_LEARNING access control
- XenSession: transactional idempotency and session isolation
"""

import uuid
from datetime import timedelta
from typing import Optional
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from accounts.models import UserRole
from .models import School, SchoolClass, Trainer, Status


def generate_xen_school_code() -> str:
    return f"XEN-SCH-{uuid.uuid4().hex[:12].upper()}"


def generate_xen_lab_code() -> str:
    return f"XEN-LAB-{uuid.uuid4().hex[:12].upper()}"


def generate_xen_trainer_code() -> str:
    return f"XEN-TRN-{uuid.uuid4().hex[:12].upper()}"


class XenSchool(models.Model):
    """
    Authoritative Xen School identity mapped 1:1 to an existing LMS School.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(
        School,
        on_delete=models.PROTECT,
        related_name="xen_identity",
    )
    xen_school_code = models.CharField(
        max_length=40,
        unique=True,
        default=generate_xen_school_code,
        editable=False,
    )
    display_name = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school__school_code"]
        verbose_name = "Xen School"
        verbose_name_plural = "Xen Schools"

    @property
    def labs(self):
        """Authoritative labs derived via canonical SchoolClass relation."""
        return XenLab.objects.filter(school_class__school=self.school)

    def save(self, *args, **kwargs):
        if not self.xen_school_code:
            self.xen_school_code = f"XEN-SCH-{uuid.uuid4().hex[:12].upper()}"
        if not self.display_name and self.school_id:
            sch_name = getattr(self.school, "name", "")
            sch_code = getattr(self.school, "school_code", "")
            self.display_name = f"{sch_name} ({sch_code})" if sch_code else sch_name
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.xen_school_code} ({self.display_name or self.school.name})"


class XenLab(models.Model):
    """
    Registered logical Lab slot for Xen curriculum delivery.
    Canonical reference to existing SchoolClass (grade + section).
    Tenant integrity is guaranteed by construction: the school is derived
    strictly from school_class.school, preventing any two-tenant divergence.
    Slots: 1 or 2 slots per class in academic period 2026-27.
    Archival-safe: PROTECT on SchoolClass.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.PROTECT,
        related_name="xen_labs",
        help_text="Canonical SchoolClass defining grade, section, and tenant school",
    )
    academic_period = models.CharField(max_length=20, default="2026-27")
    slot_number = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(2)],
        help_text="Lab slot sequence number (1 or 2)",
    )
    xen_lab_code = models.CharField(
        max_length=60,
        unique=True,
        default=generate_xen_lab_code,
        editable=False,
    )
    display_name = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school_class__school__school_code", "school_class__grade", "school_class__section", "slot_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["school_class", "academic_period", "slot_number"],
                name="uniq_xen_lab_class_period_slot",
            ),
            models.CheckConstraint(
                condition=Q(slot_number__gte=1) & Q(slot_number__lte=2),
                name="xen_lab_slot_between_1_and_2",
            ),
        ]
        verbose_name = "Xen Lab"
        verbose_name_plural = "Xen Labs"

    @property
    def school(self) -> Optional[School]:
        """Derived authoritative School through canonical SchoolClass relation."""
        return getattr(self.school_class, "school", None)

    @property
    def xen_school(self) -> Optional[XenSchool]:
        """Derived authoritative XenSchool identity mapped 1:1 through school."""
        sch = self.school
        return getattr(sch, "xen_identity", None) if sch else None

    def save(self, *args, **kwargs):
        if not self.xen_lab_code:
            self.xen_lab_code = f"XEN-LAB-{uuid.uuid4().hex[:12].upper()}"

        if not self.display_name and self.school_class_id:
            sch_code = getattr(getattr(self.school_class, "school", None), "school_code", "")
            disp_class = getattr(self.school_class, "display_name", f"{self.school_class.grade}{self.school_class.section}")
            prefix = f"{sch_code} " if sch_code else ""
            self.display_name = f"{prefix}Class {disp_class} Lab Slot {self.slot_number} ({self.academic_period})"

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.xen_lab_code} - {self.display_name}"


class AppealStatus(models.TextChoices):
    NONE = "NONE", "None"
    PENDING = "PENDING", "Pending Appeal"
    UPHELD = "UPHELD", "Appeal Upheld"
    REJECTED = "REJECTED", "Appeal Rejected"


class XenTrainer(models.Model):
    """
    Authoritative Xen Trainer identity mapped 1:1 to an existing LMS Trainer.
    Controls access to TEACHING, LAB_TEACHING, and evidence-backed PERSONAL_LEARNING.
    Full FD-01 Compliance:
    - Institutional 18+ cohort attestation (institution name + verifiable ref)
    - Named verifier and timestamp
    - Maximum 12-month qualification validity
    - Independent appeal reviewer (enforced separate from verifier)
    - Decision timestamp and recorded outcome
    - Revocation and expiry enforcement
    - Fail-closed: Bare Boolean or string ID never grants access
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trainer = models.OneToOneField(
        Trainer,
        on_delete=models.PROTECT,
        related_name="xen_identity",
    )
    xen_trainer_code = models.CharField(
        max_length=40,
        unique=True,
        default=generate_xen_trainer_code,
        editable=False,
    )
    
    # FD-01 Evidence-backed A05 qualification
    is_a05_qualified = models.BooleanField(
        default=False,
        help_text="Separate A05 qualification required for PERSONAL_LEARNING intent access.",
    )
    a05_institution_name = models.CharField(
        max_length=150,
        blank=True,
        help_text="Identifiable institutional authority or school establishing 18+ adult cohort verification.",
    )
    a05_institution_ref = models.CharField(
        max_length=100,
        blank=True,
        help_text="Verifiable institutional document or authorization reference establishing 18+ attestation.",
    )
    a05_certificate_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Authoritative certificate or document reference establishing A05 qualification.",
    )
    a05_qualification_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date A05 qualification was granted.",
    )
    a05_verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="verified_xen_trainers",
        help_text="Named admin/auditor user who verified A05 qualification evidence.",
    )
    a05_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when verification was performed.",
    )
    a05_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Expiration timestamp (maximum 12 months from verification).",
    )
    a05_revoked = models.BooleanField(
        default=False,
        help_text="Flag indicating if A05 qualification has been revoked or suspended.",
    )
    a05_revocation_reason = models.TextField(
        blank=True,
        help_text="Reason for revocation or suspension.",
    )
    a05_revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when revocation occurred.",
    )
    a05_appeal_status = models.CharField(
        max_length=30,
        choices=AppealStatus.choices,
        default=AppealStatus.NONE,
        help_text="Independent appeal status.",
    )
    a05_appeal_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="appeal_reviewed_xen_trainers",
        help_text="Independent appeal reviewer (must be distinct from original verifier).",
    )
    a05_appeal_decision_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when appeal decision was recorded.",
    )
    a05_appeal_notes = models.TextField(
        blank=True,
        help_text="Audit notes on appeal rationale and independence.",
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["trainer__trainer_id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(is_a05_qualified=False) |
                    (
                        Q(is_a05_qualified=True) &
                        ~Q(a05_institution_name="") &
                        ~Q(a05_institution_ref="") &
                        ~Q(a05_certificate_id="") &
                        Q(a05_verified_by__isnull=False) &
                        Q(a05_verified_at__isnull=False) &
                        Q(a05_expires_at__isnull=False)
                    )
                ),
                name="a05_qualification_requires_full_evidence",
            ),
        ]
        verbose_name = "Xen Trainer"
        verbose_name_plural = "Xen Trainers"

    def clean(self):
        super().clean()
        if self.is_a05_qualified:
            if not self.a05_institution_name or not self.a05_institution_name.strip():
                raise ValidationError("A05 qualification requires an identifiable institution name for 18+ cohort attestation.")
            if not self.a05_institution_ref or not self.a05_institution_ref.strip():
                raise ValidationError("A05 qualification requires a verifiable institutional reference for 18+ cohort attestation.")
            if not self.a05_certificate_id or not self.a05_certificate_id.strip():
                raise ValidationError("A05 qualification requires a valid certificate ID.")
            if not self.a05_verified_by_id:
                raise ValidationError("A05 qualification requires a named verifier (a05_verified_by).")
            if not self.a05_verified_at:
                raise ValidationError("A05 qualification requires a verification timestamp (a05_verified_at).")
            if not self.a05_expires_at:
                raise ValidationError("A05 qualification requires an expiration timestamp (a05_expires_at).")
            if self.a05_expires_at <= self.a05_verified_at:
                raise ValidationError("A05 expiration must be after the verification timestamp.")
            if self.a05_expires_at - self.a05_verified_at > timedelta(days=366):
                raise ValidationError("A05 qualification cannot exceed a 12-month validity period.")

        # Independent appeal reviewer validation
        if self.a05_appeal_status in {AppealStatus.UPHELD, AppealStatus.REJECTED}:
            if not self.a05_appeal_reviewer_id:
                raise ValidationError("Decided appeal requires an assigned appeal reviewer.")
            if not self.a05_appeal_decision_at:
                raise ValidationError("Decided appeal requires an appeal decision timestamp.")
            if self.a05_appeal_reviewer_id == self.a05_verified_by_id:
                raise ValidationError("Appeal reviewer must be an independent auditor, separate from the original verifier.")

    def save(self, *args, **kwargs):
        if not self.xen_trainer_code:
            self.xen_trainer_code = f"XEN-TRN-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)

    def can_access_intent(self, intent: str) -> bool:
        """
        Check if the trainer has verified permission for the specified interaction intent.
        Fail-closed: A bare Boolean or non-empty string ID must never establish eligibility.
        """
        if self.status != Status.ACTIVE:
            return False

        intent = intent.strip().upper()
        if intent in {"TEACHING", "LAB_TEACHING"}:
            return True
        elif intent == "PERSONAL_LEARNING":
            # 1. Must be flagged qualified
            if not self.is_a05_qualified:
                return False
            # 2. Institutional 18+ attestation evidence must be non-empty
            if not self.a05_institution_name or not self.a05_institution_name.strip():
                return False
            if not self.a05_institution_ref or not self.a05_institution_ref.strip():
                return False
            if not self.a05_certificate_id or not self.a05_certificate_id.strip():
                return False
            # 3. Named verifier and verified_at timestamp must exist
            if not self.a05_verified_by_id or not self.a05_verified_at:
                return False
            # 4. Expiry must exist and cannot be in the past
            if not self.a05_expires_at:
                return False
            if self.a05_expires_at <= timezone.now():
                return False
            # 5. Validity duration cannot exceed 12 months (366 days)
            if self.a05_expires_at - self.a05_verified_at > timedelta(days=366):
                return False
            # 6. Revocation status
            if self.a05_revoked:
                # If revoked, only accessible if appeal was explicitly UPHELD by an INDEPENDENT reviewer
                if self.a05_appeal_status != AppealStatus.UPHELD:
                    return False
                if not self.a05_appeal_reviewer_id or not self.a05_appeal_decision_at:
                    return False
                if self.a05_appeal_reviewer_id == self.a05_verified_by_id:
                    # Non-independent appeal is invalid -> fail closed
                    return False
            # 7. If appeal is pending, access is suspended (fail closed)
            if self.a05_appeal_status == AppealStatus.PENDING:
                return False
            return True
        return False

    def __str__(self):
        a05_str = f" [A05: {self.a05_certificate_id}]" if self.is_a05_qualified else ""
        return f"{self.xen_trainer_code} ({self.trainer.name}){a05_str}"


class XenSession(models.Model):
    """
    Transactional idempotency and session isolation record for Xen interactions.
    Personal Teacher Memory is strictly disabled in v0.1.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    idempotency_key = models.CharField(max_length=128)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="xen_sessions",
    )
    role = models.CharField(max_length=20, choices=UserRole.choices)
    intent = models.CharField(max_length=40)
    xen_school = models.ForeignKey(
        XenSchool,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sessions",
    )
    xen_lab = models.ForeignKey(
        XenLab,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sessions",
    )
    request_hash = models.CharField(max_length=64, blank=True)
    response_summary = models.TextField(blank=True)
    response_payload = models.JSONField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "idempotency_key"], name="xen_session_user_key_unique"),
        ]
        verbose_name = "Xen Session"
        verbose_name_plural = "Xen Sessions"

    def save(self, *args, **kwargs):
        if self.xen_lab_id and not self.xen_school_id:
            derived_school = self.xen_lab.xen_school
            if derived_school:
                self.xen_school = derived_school
        super().save(*args, **kwargs)

    def __str__(self):
        return f"XenSession {self.idempotency_key} ({self.role} - {self.intent})"


class XenJobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    CLAIMED = "claimed", "Claimed"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    EXPIRED = "expired", "Expired"
    CANCELLED = "cancelled", "Cancelled"


class XenJob(models.Model):
    """
    Persistent asynchronous inference job queue for Xen (PixiuMind Step-700) Kaggle GPU worker.
    Atomic claiming via select_for_update guarantees no two workers process the same job.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    idempotency_key = models.CharField(max_length=128)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="xen_jobs",
    )
    role = models.CharField(max_length=20, choices=UserRole.choices)
    intent = models.CharField(max_length=40, default="TEACHING")
    format_mode = models.CharField(max_length=40, default="DEFAULT_EDUCATIONAL", blank=True)
    status = models.CharField(
        max_length=20,
        choices=XenJobStatus.choices,
        default=XenJobStatus.QUEUED,
        db_index=True,
    )
    request_hash = models.CharField(max_length=64, blank=True)

    # Prompt specification
    prompt = models.TextField()
    history = models.JSONField(default=list, blank=True)
    max_tokens = models.PositiveIntegerField(default=1024)
    temperature = models.FloatField(default=0.0)

    # Worker lease & tracking
    worker_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    claim_count = models.PositiveIntegerField(default=0)
    claimed_at = models.DateTimeField(null=True, blank=True)
    lease_expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Results & diagnostics
    response_summary = models.TextField(blank=True)
    response_payload = models.JSONField(null=True, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "idempotency_key"], name="xen_job_user_key_unique"),
        ]
        indexes = [
            models.Index(fields=["status", "created_at"], name="academics_x_status_c0d291_idx"),
            models.Index(fields=["status", "lease_expires_at"], name="academics_x_status_27b878_idx"),
        ]
        verbose_name = "Xen Job"
        verbose_name_plural = "Xen Jobs"

    def is_lease_expired(self) -> bool:
        if self.status in {XenJobStatus.CLAIMED, XenJobStatus.RUNNING} and self.lease_expires_at:
            return self.lease_expires_at <= timezone.now()
        return False

    @property
    def effective_format_mode(self) -> str:
        if self.format_mode:
            return self.format_mode
        if self.intent in {"CODE_ONLY", "OUTPUT_ONLY", "EXPLANATION_ONLY", "CODE_AND_EXPLANATION", "DEFAULT_EDUCATIONAL"}:
            return self.intent
        return "DEFAULT_EDUCATIONAL"

    @property
    def effective_intent(self) -> str:
        if self.intent in {"CODE_ONLY", "OUTPUT_ONLY", "EXPLANATION_ONLY", "CODE_AND_EXPLANATION", "DEFAULT_EDUCATIONAL"}:
            return "TEACHING"
        return self.intent or "TEACHING"

    def __str__(self):
        return f"XenJob {self.id} [{self.status}] ({self.role} - {self.intent})"


class XenWorkerHeartbeat(models.Model):
    """
    Heartbeat and availability registry for Kaggle GPU workers.
    """
    worker_id = models.CharField(primary_key=True, max_length=128)
    last_seen = models.DateTimeField(auto_now=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Xen Worker Heartbeat"
        verbose_name_plural = "Xen Worker Heartbeats"

    @classmethod
    def record_heartbeat(cls, worker_id: str, metadata: dict = None):
        if not worker_id:
            return None
        now = timezone.now()
        hb, created = cls.objects.get_or_create(
            worker_id=worker_id,
            defaults={
                "last_seen": now,
                "metadata": metadata if isinstance(metadata, dict) else {},
                "is_active": True,
            },
        )
        if not created:
            hb.last_seen = now
            hb.is_active = True
            update_fields = ["last_seen", "is_active"]
            if isinstance(metadata, dict) and metadata:
                merged = dict(hb.metadata) if isinstance(hb.metadata, dict) else {}
                merged.update(metadata)
                hb.metadata = merged
                update_fields.append("metadata")
            hb.save(update_fields=update_fields)
        return hb

    @classmethod
    def get_active_workers(cls, threshold_seconds: int = 90):
        cutoff = timezone.now() - timedelta(seconds=threshold_seconds)
        return cls.objects.filter(last_seen__gte=cutoff, is_active=True)

    @classmethod
    def is_any_worker_online(cls, threshold_seconds: int = 90) -> bool:
        return cls.get_active_workers(threshold_seconds).exists()

    def __str__(self):
        return f"XenWorker {self.worker_id} (last seen: {self.last_seen})"

