"""
Identity Registry Models for Xen (PixiuMind) Integration.
Canonical mapping:
- XenSchool: 1:1 to academics.School (PROTECT on delete, opaque XEN-SCH-[HEX12] code)
- XenLab: canonical SchoolClass (grade+section) + academic period (2026-27) + slot (1 or 2)
  (PROTECT on XenSchool and SchoolClass, SchoolClass-level uniqueness, cross-school validation, opaque XEN-LAB-[HEX12] code)
- XenTrainer: 1:1 to academics.Trainer with evidence-backed A05 qualification gate
  (named verifier, timestamp, <=12 month expiry, revocation flag, appeal status)
- XenSession: transactional idempotency and session isolation
"""

import uuid
from datetime import timedelta
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from accounts.models import UserRole
from .models import School, SchoolClass, Trainer, Status


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
    xen_school_code = models.CharField(max_length=40, unique=True, editable=False)
    display_name = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school__school_code"]
        verbose_name = "Xen School"
        verbose_name_plural = "Xen Schools"

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
    Slots: 1 or 2 slots per class in academic period 2026-27.
    Archival-safe: PROTECT on XenSchool and SchoolClass.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.PROTECT,
        related_name="xen_labs",
        help_text="Authoritative SchoolClass providing grade and section",
    )
    xen_school = models.ForeignKey(
        XenSchool,
        on_delete=models.PROTECT,
        related_name="labs",
        help_text="Archival-safe protected reference to XenSchool",
    )
    academic_period = models.CharField(max_length=20, default="2026-27")
    slot_number = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(2)],
        help_text="Lab slot sequence number (1 or 2)",
    )
    xen_lab_code = models.CharField(max_length=60, unique=True, editable=False)
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

    def clean(self):
        super().clean()
        if self.school_class_id and self.xen_school_id:
            class_school_id = getattr(self.school_class, "school_id", None)
            xen_school_underlying_id = getattr(self.xen_school, "school_id", None)
            if class_school_id and xen_school_underlying_id and class_school_id != xen_school_underlying_id:
                raise ValidationError(
                    "XenLab integrity error: XenSchool and SchoolClass must belong to the exact same School."
                )

    def save(self, *args, **kwargs):
        if self.school_class_id and not self.xen_school_id:
            # Bind to corresponding XenSchool automatically
            school = getattr(self.school_class, "school", None)
            if school and hasattr(school, "xen_identity"):
                self.xen_school = school.xen_identity

        if self.school_class_id and self.xen_school_id:
            class_school_id = getattr(self.school_class, "school_id", None)
            xen_school_underlying_id = getattr(self.xen_school, "school_id", None)
            if class_school_id and xen_school_underlying_id and class_school_id != xen_school_underlying_id:
                raise ValidationError(
                    "XenLab integrity error: XenSchool and SchoolClass must belong to the exact same School."
                )

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
    A bare Boolean or non-empty string ID must never establish eligibility.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trainer = models.OneToOneField(
        Trainer,
        on_delete=models.PROTECT,
        related_name="xen_identity",
    )
    xen_trainer_code = models.CharField(max_length=40, unique=True, editable=False)
    
    # Evidence-backed A05 qualification
    is_a05_qualified = models.BooleanField(
        default=False,
        help_text="Separate A05 qualification required for PERSONAL_LEARNING intent access.",
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
    a05_appeal_status = models.CharField(
        max_length=30,
        choices=AppealStatus.choices,
        default=AppealStatus.NONE,
        help_text="Independent appeal status.",
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

    def save(self, *args, **kwargs):
        if not self.xen_trainer_code:
            self.xen_trainer_code = f"XEN-TRN-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)

    def can_access_intent(self, intent: str) -> bool:
        """
        Check if the trainer has verified permission for the specified interaction intent.
        A bare Boolean or non-empty string ID must never establish eligibility.
        """
        if self.status != Status.ACTIVE:
            return False

        intent = intent.strip().upper()
        if intent in {"TEACHING", "LAB_TEACHING"}:
            return True
        elif intent == "PERSONAL_LEARNING":
            if not self.is_a05_qualified:
                return False
            if self.a05_revoked:
                return False
            if self.a05_appeal_status == AppealStatus.PENDING:
                return False
            if not self.a05_certificate_id or not self.a05_certificate_id.strip():
                return False
            if not self.a05_verified_by_id or not self.a05_verified_at:
                return False
            if not self.a05_expires_at:
                return False
            if self.a05_expires_at <= timezone.now():
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
    idempotency_key = models.CharField(max_length=128, unique=True, db_index=True)
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
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Xen Session"
        verbose_name_plural = "Xen Sessions"

    def __str__(self):
        return f"XenSession {self.idempotency_key} ({self.role} - {self.intent})"
