import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from academics.models import SchoolClass, Student, Trainer


class Lifecycle(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class SessionStatus(models.TextChoices):
    PLANNED = "planned", "Planned"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class AttendanceStatus(models.TextChoices):
    PRESENT = "present", "Present"
    ABSENT = "absent", "Absent"
    LATE = "late", "Late"
    EXCUSED = "excused", "Excused"


class ContentType(models.TextChoices):
    PDF = "pdf", "PDF"
    VIDEO = "video", "Video"
    LINK = "link", "Link"
    NOTE = "note", "Note"
    IMAGE = "image", "Image"


class PublishStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class QuizStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    CLOSED = "closed", "Closed"


class AttemptStatus(models.TextChoices):
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    INVALIDATED = "invalidated", "Invalidated"


class ProjectStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    IN_REVIEW = "in_review", "In Review"
    COMPLETED = "completed", "Completed"
    RETURNED = "returned", "Returned"


class AssessmentStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"


class Session(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="sessions")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, related_name="sessions")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    topic = models.CharField(max_length=250)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=SessionStatus.choices, default=SessionStatus.PLANNED)
    is_locked = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_sessions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-start_time"]
        constraints = [
            models.CheckConstraint(condition=Q(end_time__isnull=True) | Q(end_time__gt=models.F("start_time")), name="session_end_after_start"),
        ]


class AttendanceRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.PROTECT, related_name="attendance")
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="attendance_records")
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices)
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="marked_attendance")
    marked_at = models.DateTimeField(auto_now=True)
    note = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-session__date", "student__roll_number"]
        constraints = [
            models.UniqueConstraint(fields=["session", "student"], name="uniq_attendance_session_student"),
        ]


class CurriculumUnit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grade = models.CharField(max_length=10)
    level = models.CharField(max_length=50)
    unit_code = models.CharField(max_length=30)
    title = models.CharField(max_length=250)
    week = models.CharField(max_length=30, blank=True)
    topic = models.CharField(max_length=250, blank=True)
    objectives = models.TextField()
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.DRAFT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_curriculum_units")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["grade", "level", "unit_code"]
        constraints = [
            models.UniqueConstraint(fields=["grade", "unit_code"], name="uniq_curriculum_grade_unit"),
        ]

    def save(self, *args, **kwargs):
        self.grade = str(self.grade).strip().upper()
        self.level = str(self.level).strip()
        self.unit_code = str(self.unit_code).strip().upper()
        super().save(*args, **kwargs)


class CurriculumClassAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    curriculum_unit = models.ForeignKey(CurriculumUnit, on_delete=models.CASCADE, related_name="class_assignments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="curriculum_assignments")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="assigned_curriculum")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["curriculum_unit", "school_class"], name="uniq_curriculum_class_assignment"),
        ]


class LearningContent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=250)
    description = models.TextField(blank=True)
    content_type = models.CharField(max_length=20, choices=ContentType.choices, default=ContentType.PDF)
    grade = models.CharField(max_length=10, blank=True)
    level = models.CharField(max_length=50, blank=True)
    unit_code = models.CharField(max_length=30, blank=True)
    url = models.URLField(blank=True)
    file = models.FileField(upload_to="learning/materials/%Y/%m/", null=True, blank=True)
    target_role = models.CharField(max_length=20, default="student")
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.DRAFT)
    is_watermarked = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_learning_content")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ContentClassAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.ForeignKey(LearningContent, on_delete=models.CASCADE, related_name="class_assignments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="content_assignments")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="assigned_content")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["content", "school_class"], name="uniq_content_class_assignment"),
        ]


class Quiz(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=250)
    grade = models.CharField(max_length=10)
    level = models.CharField(max_length=50)
    unit_code = models.CharField(max_length=30, blank=True)
    duration_minutes = models.PositiveSmallIntegerField(default=10, validators=[MinValueValidator(1), MaxValueValidator(240)])
    max_attempts = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(20)])
    status = models.CharField(max_length=20, choices=QuizStatus.choices, default=QuizStatus.DRAFT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_quizzes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class QuizClassAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="class_assignments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="quiz_assignments")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="assigned_quizzes")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["quiz", "school_class"], name="uniq_quiz_class_assignment"),
        ]


class QuizQuestion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    question_order = models.PositiveIntegerField(default=1)
    question_text = models.TextField()
    option_a = models.CharField(max_length=1000)
    option_b = models.CharField(max_length=1000)
    option_c = models.CharField(max_length=1000)
    option_d = models.CharField(max_length=1000)
    correct_option = models.CharField(max_length=1)
    explanation = models.TextField(blank=True)
    points = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["question_order"]
        constraints = [
            models.UniqueConstraint(fields=["quiz", "question_order"], name="uniq_quiz_question_order"),
            models.CheckConstraint(condition=Q(correct_option__in=["A", "B", "C", "D"]), name="quiz_correct_option_valid"),
        ]

    def save(self, *args, **kwargs):
        self.correct_option = self.correct_option.strip().upper()
        super().save(*args, **kwargs)


class QuizAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(Quiz, on_delete=models.PROTECT, related_name="attempts")
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="quiz_attempts")
    attempt_number = models.PositiveSmallIntegerField()
    answers = models.JSONField(default=dict)
    score = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    total_marks = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    correct_count = models.PositiveIntegerField(default=0)
    attempted_count = models.PositiveIntegerField(default=0)
    total_questions = models.PositiveIntegerField(default=0)
    time_taken_seconds = models.PositiveIntegerField(default=0)
    violation_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=AttemptStatus.choices, default=AttemptStatus.COMPLETED)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-completed_at"]
        constraints = [
            models.UniqueConstraint(fields=["quiz", "student", "attempt_number"], name="uniq_quiz_student_attempt"),
        ]


class StudentAssessment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="assessments")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, related_name="student_assessments")
    unit_code = models.CharField(max_length=30, blank=True)
    level = models.CharField(max_length=50, blank=True)
    title = models.CharField(max_length=250, blank=True)
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)])
    rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(5)])
    status = models.CharField(max_length=20, choices=AssessmentStatus.choices, default=AssessmentStatus.DRAFT)
    feedback = models.TextField(blank=True)
    assessment_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-assessment_date", "-created_at"]


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="projects")
    title = models.CharField(max_length=250)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=ProjectStatus.choices, default=ProjectStatus.DRAFT)
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)])
    trainer_feedback = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ProjectEvidence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="evidence")
    title = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)
    file = models.FileField(upload_to="learning/evidence/%Y/%m/", null=True, blank=True)
    external_url = models.URLField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploaded_project_evidence")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
