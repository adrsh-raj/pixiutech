from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0014_learningcontent_video_processing"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="curriculumunit",
            options={"ordering": ["grade", "unit_code"]},
        ),
        migrations.RemoveConstraint(
            model_name="studentassessment",
            name="uniq_assessment_student_unit_ci",
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="min_attendance_pct",
            field=models.DecimalField(decimal_places=2, default=75, max_digits=5, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="min_quiz_pct",
            field=models.DecimalField(decimal_places=2, default=60, max_digits=5, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="min_practical_pct",
            field=models.DecimalField(decimal_places=2, default=70, max_digits=5, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="min_trainer_review_rating",
            field=models.DecimalField(decimal_places=2, default=3, max_digits=3, validators=[MinValueValidator(0), MaxValueValidator(5)]),
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="weight_practical",
            field=models.DecimalField(decimal_places=2, default=40, max_digits=5, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="weight_quiz",
            field=models.DecimalField(decimal_places=2, default=25, max_digits=5, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="weight_attendance",
            field=models.DecimalField(decimal_places=2, default=20, max_digits=5, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AlterField(
            model_name="completionpolicy",
            name="weight_trainer_review",
            field=models.DecimalField(decimal_places=2, default=15, max_digits=5, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AlterField(
            model_name="programmecompletion",
            name="status",
            field=models.CharField(
                choices=[
                    ("in_progress", "In progress"),
                    ("trainer_requested", "Trainer approved"),
                    ("admin_completed", "Admin approved"),
                ],
                default="in_progress",
                max_length=30,
            ),
        ),
    ]
