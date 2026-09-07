import uuid

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="School",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("school_code", models.CharField(max_length=20, unique=True, validators=[django.core.validators.RegexValidator(message="School code must be 2-20 uppercase letters/numbers.", regex="^[A-Z0-9]{2,20}$")])),
                ("name", models.CharField(max_length=200)),
                ("principal_name", models.CharField(blank=True, max_length=200)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.TextField(blank=True)),
                ("lab_name", models.CharField(blank=True, max_length=150)),
                ("lab_location", models.CharField(blank=True, max_length=200)),
                ("lab_capacity", models.PositiveIntegerField(blank=True, null=True)),
                ("lab_notes", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="school_profile", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["school_code"]},
        ),
        migrations.CreateModel(
            name="Trainer",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("trainer_id", models.CharField(max_length=40, unique=True, validators=[django.core.validators.RegexValidator(message="Trainer ID must use 2-40 uppercase letters, numbers, dot, underscore or hyphen.", regex="^[A-Z0-9][A-Z0-9._-]{1,39}$")])),
                ("name", models.CharField(max_length=200)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("qualification", models.CharField(blank=True, max_length=200)),
                ("specialization", models.CharField(blank=True, max_length=200)),
                ("daily_rate", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("weekly_days", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(7)])),
                ("monthly_compensation", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("rating", models.DecimalField(blank=True, decimal_places=2, max_digits=4, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(5)])),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="trainer_profile", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["trainer_id"]},
        ),
        migrations.CreateModel(
            name="SchoolClass",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("grade", models.CharField(max_length=10)),
                ("section", models.CharField(max_length=5)),
                ("display_name", models.CharField(blank=True, max_length=30)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="classes", to="academics.school")),
            ],
            options={"ordering": ["school__school_code", "grade", "section"]},
        ),
        migrations.CreateModel(
            name="TrainerSchoolAssignment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("assigned_from", models.DateField()),
                ("assigned_to", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="trainer_assignments", to="academics.school")),
                ("trainer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="school_assignments", to="academics.trainer")),
            ],
            options={"ordering": ["-assigned_from"]},
        ),
        migrations.CreateModel(
            name="Student",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("student_id", models.CharField(editable=False, max_length=60, unique=True)),
                ("roll_number", models.PositiveSmallIntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(99)])),
                ("name", models.CharField(max_length=200)),
                ("date_of_birth", models.DateField(blank=True, null=True)),
                ("gender", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("guardian_name", models.CharField(blank=True, max_length=200)),
                ("guardian_phone", models.CharField(blank=True, max_length=30)),
                ("guardian_email", models.EmailField(blank=True, max_length=254)),
                ("address", models.TextField(blank=True)),
                ("current_level", models.CharField(blank=True, max_length=50)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="student_profile", to=settings.AUTH_USER_MODEL)),
                ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="students", to="academics.schoolclass")),
            ],
            options={"ordering": ["school_class__school__school_code", "school_class__grade", "school_class__section", "roll_number"]},
        ),
        migrations.AddConstraint(
            model_name="trainerschoolassignment",
            constraint=models.UniqueConstraint(fields=("trainer", "school", "assigned_from"), name="uniq_trainer_school_start"),
        ),
        migrations.AddConstraint(
            model_name="trainerschoolassignment",
            constraint=models.UniqueConstraint(condition=Q(status="active"), fields=("trainer", "school"), name="uniq_active_trainer_school"),
        ),
        migrations.AddConstraint(
            model_name="trainerschoolassignment",
            constraint=models.CheckConstraint(condition=Q(assigned_to__isnull=True) | Q(assigned_to__gte=models.F("assigned_from")), name="assignment_end_on_or_after_start"),
        ),
        migrations.AddConstraint(
            model_name="schoolclass",
            constraint=models.UniqueConstraint(fields=("school", "grade", "section"), name="uniq_school_grade_section"),
        ),
        migrations.AddConstraint(
            model_name="schoolclass",
            constraint=models.CheckConstraint(condition=Q(grade__regex="^[0-9]{1,2}$"), name="class_grade_numeric"),
        ),
        migrations.AddConstraint(
            model_name="schoolclass",
            constraint=models.CheckConstraint(condition=Q(section__regex="^[A-Z0-9]{1,5}$"), name="class_section_upper_alnum"),
        ),
        migrations.AddConstraint(
            model_name="student",
            constraint=models.UniqueConstraint(fields=("school_class", "roll_number"), name="uniq_student_roll_in_class"),
        ),
    ]
