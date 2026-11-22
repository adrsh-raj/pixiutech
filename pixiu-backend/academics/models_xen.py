"""
Identity Registry Models for Xen (PixiuMind) Integration.
Academic period: 2026-27
Classes: 6-12
Slots per class: 1-2
Intents: TEACHING, LAB_TEACHING, PERSONAL_LEARNING (A05 qualified only)
"""

import uuid
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from accounts.models import UserRole
from .models import School, Trainer, Status


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
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school__school_code"]
        verbose_name = "Xen School"
        verbose_name_plural = "Xen Schools"

    def save(self, *args, **kwargs):
        if not self.xen_school_code and self.school_id:
            # Generate immutable opaque code: XEN-SCH-<SCHOOL_CODE>-<SHORT_UUID>
            suffix = uuid.uuid4().hex[:6].upper()
            code_base = getattr(self.school, "school_code", "GEN").strip().upper()
            self.xen_school_code = f"XEN-SCH-{code_base}-{suffix}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.xen_school_code} ({self.school.name})"


class XenLab(models.Model):
    """
    Registered logical Lab slot for Xen curriculum delivery.
    Class range: Grades 6-12
    Slots: 1 or 2 slots per class in academic period 2026-27.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    xen_school = models.ForeignKey(
        XenSchool,
        on_delete=models.CASCADE,
        related_name="labs",
    )
    academic_period = models.CharField(max_length=20, default="2026-27")
    grade = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(6), MaxValueValidator(12)],
        help_text="Target academic grade (6 to 12)",
    )
    slot_number = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(2)],
        help_text="Lab slot sequence number (1 or 2)",
    )
    xen_lab_code = models.CharField(max_length=60, unique=True, editable=False)
    display_name = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["xen_school", "academic_period", "grade", "slot_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["xen_school", "academic_period", "grade", "slot_number"],
                name="uniq_xen_school_period_grade_slot",
            ),
            models.CheckConstraint(
                condition=Q(grade__gte=6) & Q(grade__lte=12),
                name="xen_lab_grade_between_6_and_12",
            ),
            models.CheckConstraint(
                condition=Q(slot_number__gte=1) & Q(slot_number__lte=2),
                name="xen_lab_slot_between_1_and_2",
            ),
        ]
        verbose_name = "Xen Lab"
        verbose_name_plural = "Xen Labs"

    def save(self, *args, **kwargs):
        if not self.xen_lab_code:
            school_code = self.xen_school.school.school_code if self.xen_school_id else "GEN"
            self.xen_lab_code = f"XEN-LAB-{school_code}-G{self.grade}-S{self.slot_number}"
        if not self.display_name:
            self.display_name = f"Class {self.grade} Lab Slot {self.slot_number} ({self.academic_period})"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.xen_lab_code} - {self.display_name}"


class XenTrainer(models.Model):
    """
    Authoritative Xen Trainer identity mapped 1:1 to an existing LMS Trainer.
    Controls access to TEACHING, LAB_TEACHING, and conditional PERSONAL_LEARNING (A05 qualified).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trainer = models.OneToOneField(
        Trainer,
        on_delete=models.PROTECT,
        related_name="xen_identity",
    )
    xen_trainer_code = models.CharField(max_length=40, unique=True, editable=False)
    is_a05_qualified = models.BooleanField(
        default=False,
        help_text="Separate A05 qualification required for PERSONAL_LEARNING intent access.",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["trainer__trainer_id"]
        verbose_name = "Xen Trainer"
        verbose_name_plural = "Xen Trainers"

    def save(self, *args, **kwargs):
        if not self.xen_trainer_code and self.trainer_id:
            suffix = uuid.uuid4().hex[:6].upper()
            code_base = getattr(self.trainer, "trainer_id", "TRN").strip().upper()
            self.xen_trainer_code = f"XEN-TRN-{code_base}-{suffix}"
        super().save(*args, **kwargs)

    def can_access_intent(self, intent: str) -> bool:
        """
        Check if the trainer has permission for the specified interaction intent.
        """
        if self.status != Status.ACTIVE:
            return False

        intent = intent.strip().upper()
        if intent in {"TEACHING", "LAB_TEACHING"}:
            return True
        elif intent == "PERSONAL_LEARNING":
            return self.is_a05_qualified
        return False

    def __str__(self):
        a05_str = " [A05 Qualified]" if self.is_a05_qualified else ""
        return f"{self.xen_trainer_code} ({self.trainer.name}){a05_str}"


class XenSession(models.Model):
    """
    Transactional idempotency and session isolation record for Xen interactions.
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
