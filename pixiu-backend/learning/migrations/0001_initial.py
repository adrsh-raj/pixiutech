import uuid
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from django.conf import settings


class Migration(migrations.Migration):
    initial = True
    dependencies = [("academics", "0001_initial"), (settings.AUTH_USER_MODEL.split(".")[0], "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Session", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("date", models.DateField()), ("start_time", models.TimeField()), ("end_time", models.TimeField(blank=True, null=True)),
                ("topic", models.CharField(max_length=250)), ("notes", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("planned","Planned"),("completed","Completed"),("cancelled","Cancelled")], default="planned", max_length=20)),
                ("is_locked", models.BooleanField(default=False)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_sessions", to=settings.AUTH_USER_MODEL)),
                ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="sessions", to="academics.schoolclass")),
                ("trainer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="sessions", to="academics.trainer")),
            ], options={"ordering":["-date","-start_time"]}
        ),
        migrations.CreateModel(
            name="CurriculumUnit", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("grade", models.CharField(max_length=10)), ("level", models.CharField(max_length=50)), ("unit_code", models.CharField(max_length=30)),
                ("title", models.CharField(max_length=250)), ("week", models.CharField(blank=True, max_length=30)), ("topic", models.CharField(blank=True, max_length=250)),
                ("objectives", models.TextField()), ("status", models.CharField(choices=[("draft","Draft"),("published","Published"),("archived","Archived")], default="draft", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_curriculum_units", to=settings.AUTH_USER_MODEL)),
            ], options={"ordering":["grade","level","unit_code"]}
        ),
        migrations.CreateModel(
            name="LearningContent", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=250)), ("description", models.TextField(blank=True)),
                ("content_type", models.CharField(choices=[("pdf","PDF"),("video","Video"),("link","Link"),("note","Note"),("image","Image")], default="pdf", max_length=20)),
                ("grade", models.CharField(blank=True, max_length=10)), ("level", models.CharField(blank=True, max_length=50)), ("unit_code", models.CharField(blank=True, max_length=30)),
                ("url", models.URLField(blank=True)), ("file", models.FileField(blank=True, null=True, upload_to="learning/materials/%Y/%m/")),
                ("target_role", models.CharField(default="student", max_length=20)), ("status", models.CharField(choices=[("draft","Draft"),("published","Published"),("archived","Archived")], default="draft", max_length=20)),
                ("is_watermarked", models.BooleanField(default=True)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_learning_content", to=settings.AUTH_USER_MODEL)),
            ]
        ),
        migrations.CreateModel(
            name="Quiz", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("title", models.CharField(max_length=250)),
                ("grade", models.CharField(max_length=10)), ("level", models.CharField(max_length=50)), ("unit_code", models.CharField(blank=True, max_length=30)),
                ("duration_minutes", models.PositiveSmallIntegerField(default=10, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(240)])),
                ("max_attempts", models.PositiveSmallIntegerField(default=1, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(20)])),
                ("status", models.CharField(choices=[("draft","Draft"),("active","Active"),("closed","Closed")], default="draft", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_quizzes", to=settings.AUTH_USER_MODEL)),
            ], options={"ordering":["-created_at"]}
        ),
        migrations.CreateModel(
            name="StudentAssessment", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("unit_code", models.CharField(blank=True, max_length=30)), ("level", models.CharField(blank=True, max_length=50)), ("title", models.CharField(blank=True, max_length=250)),
                ("score", models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)])),
                ("rating", models.DecimalField(blank=True, decimal_places=2, max_digits=3, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(5)])),
                ("status", models.CharField(choices=[("draft","Draft"),("published","Published")], default="draft", max_length=20)), ("feedback", models.TextField(blank=True)), ("assessment_date", models.DateField()), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assessments", to="academics.student")), ("trainer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="student_assessments", to="academics.trainer")),
            ], options={"ordering":["-assessment_date","-created_at"]}
        ),
        migrations.CreateModel(
            name="Project", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("title", models.CharField(max_length=250)), ("description", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("draft","Draft"),("submitted","Submitted"),("in_review","In Review"),("completed","Completed"),("returned","Returned")], default="draft", max_length=20)),
                ("score", models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)])), ("trainer_feedback", models.TextField(blank=True)), ("submitted_at", models.DateTimeField(blank=True, null=True)), ("completed_at", models.DateTimeField(blank=True, null=True)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="projects", to="academics.student")),
            ]
        ),
        migrations.CreateModel(
            name="AttendanceRecord", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("status", models.CharField(choices=[("present","Present"),("absent","Absent"),("late","Late"),("excused","Excused")], max_length=20)), ("marked_at", models.DateTimeField(auto_now=True)), ("note", models.CharField(blank=True, max_length=500)),
                ("marked_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="marked_attendance", to=settings.AUTH_USER_MODEL)), ("session", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance", to="learning.session")), ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_records", to="academics.student")),
            ], options={"ordering":["-session__date","student__roll_number"]}
        ),
        migrations.CreateModel(
            name="CurriculumClassAssignment", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("assigned_at", models.DateTimeField(auto_now_add=True)),
                ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assigned_curriculum", to=settings.AUTH_USER_MODEL)), ("curriculum_unit", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="class_assignments", to="learning.curriculumunit")), ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="curriculum_assignments", to="academics.schoolclass")),
            ]
        ),
        migrations.CreateModel(
            name="ContentClassAssignment", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("assigned_at", models.DateTimeField(auto_now_add=True)),
                ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assigned_content", to=settings.AUTH_USER_MODEL)), ("content", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="class_assignments", to="learning.learningcontent")), ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="content_assignments", to="academics.schoolclass")),
            ]
        ),
        migrations.CreateModel(
            name="QuizClassAssignment", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("assigned_at", models.DateTimeField(auto_now_add=True)),
                ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assigned_quizzes", to=settings.AUTH_USER_MODEL)), ("quiz", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="class_assignments", to="learning.quiz")), ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="quiz_assignments", to="academics.schoolclass")),
            ]
        ),
        migrations.CreateModel(
            name="QuizQuestion", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("question_order", models.PositiveIntegerField(default=1)), ("question_text", models.TextField()), ("option_a", models.CharField(max_length=1000)), ("option_b", models.CharField(max_length=1000)), ("option_c", models.CharField(max_length=1000)), ("option_d", models.CharField(max_length=1000)), ("correct_option", models.CharField(max_length=1)), ("explanation", models.TextField(blank=True)), ("points", models.PositiveIntegerField(default=1)),
                ("quiz", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="learning.quiz")),
            ], options={"ordering":["question_order"]}
        ),
        migrations.CreateModel(
            name="QuizAttempt", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("attempt_number", models.PositiveSmallIntegerField()), ("answers", models.JSONField(default=dict)), ("score", models.DecimalField(decimal_places=2, default=0, max_digits=7)), ("total_marks", models.DecimalField(decimal_places=2, default=0, max_digits=7)), ("percentage", models.DecimalField(decimal_places=2, default=0, max_digits=5)), ("correct_count", models.PositiveIntegerField(default=0)), ("attempted_count", models.PositiveIntegerField(default=0)), ("total_questions", models.PositiveIntegerField(default=0)), ("time_taken_seconds", models.PositiveIntegerField(default=0)), ("violation_count", models.PositiveIntegerField(default=0)), ("status", models.CharField(choices=[("in_progress","In Progress"),("completed","Completed"),("invalidated","Invalidated")], default="completed", max_length=20)), ("completed_at", models.DateTimeField(auto_now_add=True)),
                ("quiz", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attempts", to="learning.quiz")), ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="quiz_attempts", to="academics.student")),
            ], options={"ordering":["-completed_at"]}
        ),
        migrations.CreateModel(
            name="ProjectEvidence", fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("title", models.CharField(blank=True, max_length=200)), ("note", models.TextField(blank=True)), ("file", models.FileField(blank=True, null=True, upload_to="learning/evidence/%Y/%m/")), ("external_url", models.URLField(blank=True)), ("created_at", models.DateTimeField(auto_now_add=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="evidence", to="learning.project")), ("uploaded_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="uploaded_project_evidence", to=settings.AUTH_USER_MODEL)),
            ], options={"ordering":["-created_at"]}
        ),
        migrations.AddConstraint(model_name="session", constraint=models.CheckConstraint(condition=models.Q(("end_time__isnull", True)) | models.Q(("end_time__gt", models.F("start_time"))), name="session_end_after_start")),
        migrations.AddConstraint(model_name="curriculumunit", constraint=models.UniqueConstraint(fields=("grade","unit_code"), name="uniq_curriculum_grade_unit")),
        migrations.AddConstraint(model_name="attendanceRecord", constraint=models.UniqueConstraint(fields=("session","student"), name="uniq_attendance_session_student")),
        migrations.AddConstraint(model_name="curriculumclassassignment", constraint=models.UniqueConstraint(fields=("curriculum_unit","school_class"), name="uniq_curriculum_class_assignment")),
        migrations.AddConstraint(model_name="contentclassassignment", constraint=models.UniqueConstraint(fields=("content","school_class"), name="uniq_content_class_assignment")),
        migrations.AddConstraint(model_name="quizclassassignment", constraint=models.UniqueConstraint(fields=("quiz","school_class"), name="uniq_quiz_class_assignment")),
        migrations.AddConstraint(model_name="quizquestion", constraint=models.UniqueConstraint(fields=("quiz","question_order"), name="uniq_quiz_question_order")),
        migrations.AddConstraint(model_name="quizquestion", constraint=models.CheckConstraint(condition=models.Q(correct_option__in=["A","B","C","D"]), name="quiz_correct_option_valid")),
        migrations.AddConstraint(model_name="quizattempt", constraint=models.UniqueConstraint(fields=("quiz","student","attempt_number"), name="uniq_quiz_student_attempt")),
    ]
