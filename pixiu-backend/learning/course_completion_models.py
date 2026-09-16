import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from academics.models import SchoolClass, Student


class Technology(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def save(self, *args, **kwargs):
        self.code = str(self.code or self.name).strip().lower().replace(" ", "-")
        self.name = str(self.name).strip()
        super().save(*args, **kwargs)


class CurriculumUnitProfile(models.Model):
    curriculum_unit = models.OneToOneField("learning.CurriculumUnit", on_delete=models.CASCADE, related_name="completion_profile")
    technology = models.ForeignKey(Technology, on_delete=models.PROTECT, related_name="curriculum_units")
    certificate_required = models.BooleanField(default=True)
    requires_attendance = models.BooleanField(null=True, blank=True)
    min_attendance_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)])
    requires_quiz = models.BooleanField(null=True, blank=True)
    min_quiz_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)])
    requires_practical = models.BooleanField(null=True, blank=True)
    min_practical_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)])
    requires_trainer_review = models.BooleanField(null=True, blank=True)
    min_trainer_review_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(5)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SessionWorkflow(models.Model):
    session = models.OneToOneField("learning.Session", on_delete=models.CASCADE, related_name="workflow")
    technology = models.ForeignKey(Technology, on_delete=models.PROTECT, related_name="session_workflows")
    # Single legacy checkbox now represents the final programme session for the class.
    is_last_session_for_unit = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class CompletionPolicy(models.Model):
    school_class = models.OneToOneField(SchoolClass, on_delete=models.CASCADE, related_name="completion_policy", null=True, blank=True)
    name = models.CharField(max_length=160, default="Standard Pixiu completion policy")
    requires_attendance = models.BooleanField(default=True)
    min_attendance_pct = models.DecimalField(max_digits=5, decimal_places=2, default=75, validators=[MinValueValidator(0), MaxValueValidator(100)])
    requires_quiz = models.BooleanField(default=True)
    min_quiz_pct = models.DecimalField(max_digits=5, decimal_places=2, default=60, validators=[MinValueValidator(0), MaxValueValidator(100)])
    requires_practical = models.BooleanField(default=True)
    min_practical_pct = models.DecimalField(max_digits=5, decimal_places=2, default=70, validators=[MinValueValidator(0), MaxValueValidator(100)])
    requires_trainer_review = models.BooleanField(default=True)
    min_trainer_review_rating = models.DecimalField(max_digits=3, decimal_places=2, default=3, validators=[MinValueValidator(0), MaxValueValidator(5)])
    weight_practical = models.DecimalField(max_digits=5, decimal_places=2, default=40, validators=[MinValueValidator(0), MaxValueValidator(100)])
    weight_quiz = models.DecimalField(max_digits=5, decimal_places=2, default=25, validators=[MinValueValidator(0), MaxValueValidator(100)])
    weight_attendance = models.DecimalField(max_digits=5, decimal_places=2, default=20, validators=[MinValueValidator(0), MaxValueValidator(100)])
    weight_trainer_review = models.DecimalField(max_digits=5, decimal_places=2, default=15, validators=[MinValueValidator(0), MaxValueValidator(100)])
    active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school_class_id"]


class UnitCompletion(models.Model):
    STATUS_CHOICES = [("pending", "Pending"), ("passed", "Passed"), ("failed", "Failed")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="unit_completions")
    curriculum_unit = models.ForeignKey("learning.CurriculumUnit", on_delete=models.PROTECT, related_name="student_completions")
    final_session = models.ForeignKey("learning.Session", on_delete=models.PROTECT, null=True, blank=True, related_name="unit_completions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    attendance_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    quiz_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    practical_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    trainer_review_avg = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    score = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    reasons = models.JSONField(default=list, blank=True)
    evaluated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["curriculum_unit__unit_code"]
        constraints = [models.UniqueConstraint(fields=["student", "curriculum_unit"], name="uniq_student_curriculum_completion")]


class ProgrammeCompletion(models.Model):
    STATUS_CHOICES = [("in_progress", "In progress"), ("trainer_requested", "Trainer approved"), ("admin_completed", "Admin approved")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(Student, on_delete=models.PROTECT, related_name="programme_completion")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="in_progress")
    overall_score = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="programme_completion_requests")
    requested_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="programme_completions_approved")
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Certificate(models.Model):
    STATUS_CHOICES = [("issued", "Issued"), ("revoked", "Revoked")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    certificate_id = models.CharField(max_length=80, unique=True)
    verification_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="certificates")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="certificates")
    programme_name = models.CharField(max_length=250, default="Pixiu Technology Programme")
    technologies_snapshot = models.JSONField(default=list)
    units_snapshot = models.JSONField(default=list)
    overall_score = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    rank = models.PositiveIntegerField(null=True, blank=True)
    rank_printed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="issued")
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="issued_pixiu_certificates")
    issued_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-issued_at"]
