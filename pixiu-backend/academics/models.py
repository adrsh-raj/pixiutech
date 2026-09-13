import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q


class Status(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


school_code_validator = RegexValidator(
    regex=r"^[A-Z0-9]{2,20}$",
    message="School code must be 2-20 uppercase letters/numbers.",
)

trainer_id_validator = RegexValidator(
    regex=r"^[A-Z0-9][A-Z0-9._-]{1,39}$",
    message="Trainer ID must use 2-40 uppercase letters, numbers, dot, underscore or hyphen.",
)


class School(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="school_profile",
        null=True,
        blank=True,
    )
    school_code = models.CharField(max_length=20, unique=True, validators=[school_code_validator])
    name = models.CharField(max_length=200)
    principal_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    lab_name = models.CharField(max_length=150, blank=True)
    lab_location = models.CharField(max_length=200, blank=True)
    lab_capacity = models.PositiveIntegerField(null=True, blank=True)
    lab_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school_code"]

    def save(self, *args, **kwargs):
        self.school_code = self.school_code.strip().upper()
        self.name = self.name.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.school_code} - {self.name}"


class Trainer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="trainer_profile",
        null=True,
        blank=True,
    )
    trainer_id = models.CharField(max_length=40, unique=True, validators=[trainer_id_validator])
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    qualification = models.CharField(max_length=200, blank=True)
    specialization = models.CharField(max_length=200, blank=True)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    weekly_days = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(7)])
    monthly_compensation = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    rating = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(5)])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["trainer_id"]

    def save(self, *args, **kwargs):
        self.trainer_id = self.trainer_id.strip().upper()
        self.name = self.name.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.trainer_id} - {self.name}"


class TrainerSchoolAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, related_name="school_assignments")
    school = models.ForeignKey(School, on_delete=models.PROTECT, related_name="trainer_assignments")
    assigned_from = models.DateField()
    assigned_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assigned_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["trainer", "school", "assigned_from"],
                name="uniq_trainer_school_start",
            ),
            models.UniqueConstraint(
                fields=["trainer", "school"],
                condition=Q(status=Status.ACTIVE),
                name="uniq_active_trainer_school",
            ),
            models.CheckConstraint(
                condition=Q(assigned_to__isnull=True) | Q(assigned_to__gte=models.F("assigned_from")),
                name="assignment_end_on_or_after_start",
            ),
        ]


class SchoolClass(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.PROTECT, related_name="classes")
    grade = models.CharField(max_length=10)
    section = models.CharField(max_length=5)
    display_name = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school__school_code", "grade", "section"]
        constraints = [
            models.UniqueConstraint(fields=["school", "grade", "section"], name="uniq_school_grade_section"),
            models.CheckConstraint(condition=Q(grade__regex=r"^[0-9]{1,2}$"), name="class_grade_numeric"),
            models.CheckConstraint(condition=Q(section__regex=r"^[A-Z0-9]{1,5}$"), name="class_section_upper_alnum"),
        ]

    def save(self, *args, **kwargs):
        self.grade = self.grade.strip().upper()
        self.section = self.section.strip().upper()
        if not self.display_name:
            self.display_name = f"{self.grade}{self.section}"
        else:
            self.display_name = self.display_name.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.school.school_code} {self.display_name}"


class Student(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="student_profile",
        null=True,
        blank=True,
    )
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="students")
    student_id = models.CharField(max_length=60, unique=True, editable=False)
    roll_number = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(99)])
    name = models.CharField(max_length=200)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    guardian_name = models.CharField(max_length=200, blank=True)
    guardian_phone = models.CharField(max_length=30, blank=True)
    guardian_email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school_class__school__school_code", "school_class__grade", "school_class__section", "roll_number"]
        constraints = [
            models.UniqueConstraint(fields=["school_class", "roll_number"], name="uniq_student_roll_in_class"),
        ]

    def __str__(self):
        return f"{self.student_id} - {self.name}"
