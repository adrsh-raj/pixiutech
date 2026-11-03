import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("academics", "0002_remove_student_current_level"),
        ("learning", "0015_alter_curriculumunit_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="VirtualLabAssignment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("lesson_id", models.CharField(max_length=120)),
                ("title", models.CharField(max_length=200)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("published", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="virtual_lab_assignments", to=settings.AUTH_USER_MODEL)),
                ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="virtual_lab_assignments", to="academics.schoolclass")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="virtuallabassignment",
            index=models.Index(fields=["school_class", "published", "created_at"], name="vl_assign_class_pub_idx"),
        ),
        migrations.CreateModel(
            name="VirtualLabProgress",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("in_progress", "In progress"), ("submitted", "Submitted"), ("reviewed", "Reviewed")], default="in_progress", max_length=20)),
                ("completed_step_ids", models.JSONField(blank=True, default=list)),
                ("snapshot", models.JSONField(blank=True, default=dict)),
                ("result_summary", models.JSONField(blank=True, default=dict)),
                ("reflection", models.CharField(blank=True, max_length=1000)),
                ("feedback", models.CharField(blank=True, max_length=1000)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assignment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="progress_records", to="learning.virtuallabassignment")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="reviewed_virtual_lab_progress", to=settings.AUTH_USER_MODEL)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="virtual_lab_progress", to="academics.student")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AddConstraint(
            model_name="virtuallabprogress",
            constraint=models.UniqueConstraint(fields=("assignment", "student"), name="uniq_vl_progress_student"),
        ),
        migrations.AddIndex(
            model_name="virtuallabprogress",
            index=models.Index(fields=["assignment", "status"], name="vl_progress_status_idx"),
        ),
    ]
