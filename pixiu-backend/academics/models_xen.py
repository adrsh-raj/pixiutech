"""
Identity Registry Models for Xen (PixiuMind) Integration.
Canonical mapping:
- XenSchool: 1:1 to academics.School
- XenLab: canonical SchoolClass (grade+section) + academic period (2026-27) + slot (1 or 2)
- XenTrainer: 1:1 to academics.Trainer with evidence-backed A05 qualification
- XenSession: transactional idempotency and session isolation
"""

import uuid
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
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
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school__school_code"]
        verbose_name = "Xen School"
        verbose_name_plural = "Xen Schools"

    def save(self, *args, **kwargs):
        if not self.xen_school_code and self.school_id:
            suffix = uuid.uuid4().hex[:6].upper()
            code_base = getattr(self.school, "school_code", "GEN").strip().upper()
            self.xen_school_code = f"XEN-SCH-{code_base}-{suffix}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.xen_school_code} ({self.school.name})"


class XenLab(models.Model):
    """
    Registered logical Lab slot for Xen curriculum delivery.
    Canonical reference to existing SchoolClass (grade + section).
    Slots: 1 or 2 slots per class in academic period 2026-27.
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
        on_delete=models.CASCADE,
        related_name="labs",
    )
    academic_period = models.CharField(max_length=20, default="2026-27")
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

    def save(self, *args, **kwargs):
        if self.school_class_id and not self.xen_school_id:
            # Bind to corresponding XenSchool automatically
            school = getattr(self.school_class, "school", None)
            if school and hasattr(school, "xen_identity"):
                self.xen_school = school.xen_identity

        if not self.xen_lab_code and self.school_class_id:
            sch_code = getattr(self.school_class.school, "school_code", "GEN")
            grade = getattr(self.school_class, "grade", "")
            section = getattr(self.school_class, "section", "")
            self.xen_lab_code = f"XEN-LAB-{sch_code}-G{grade}{section}-S{self.slot_number}"

        if not self.display_name and self.school_class_id:
            disp_class = getattr(self.school_class, "display_name", f"{self.school_class.grade}{self.school_class.section}")
            self.display_name = f"Class {disp_class} Lab Slot {self.slot_number} ({self.academic_period})"

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.xen_lab_code} - {self.display_name}"


class XenTrainer(models.Model):
    """
    Authoritative Xen Trainer identity mapped 1:1 to an existing LMS Trainer.
    Controls access to TEACHING, LAB_TEACHING, and evidence-backed PERSONAL_LEARNING.
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
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_xen_trainers",
        help_text="Admin user who verified A05 qualification evidence.",
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["trainer__trainer_id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(is_a05_qualified=False) | (Q(is_a05_qualified=True) & ~Q(a05_certificate_id="")),
                name="a05_qualification_requires_evidence",
            ),
        ]
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
        Check if the trainer has verified permission for the specified interaction intent.
        """
        if self.status != Status.ACTIVE:
            return False

        intent = intent.strip().upper()
        if intent in {"TEACHING", "LAB_TEACHING"}:
            return True
        elif intent == "PERSONAL_LEARNING":
            # Must be active, flagged as qualified, AND have documented evidence certificate
            return bool(self.is_a05_qualified and self.a05_certificate_id)
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
