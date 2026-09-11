from django.db import migrations, models
from django.core.validators import MaxValueValidator, MinValueValidator
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("learning", "0003_sessionactivity_title_required")]

    operations = [
        migrations.AddField(
            model_name="session",
            name="curriculum_unit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sessions",
                to="learning.curriculumunit",
            ),
        ),
        migrations.AddField(
            model_name="quiz",
            name="duration_seconds",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                validators=[MinValueValidator(10), MaxValueValidator(14400)],
            ),
        ),
        migrations.AddField(
            model_name="quizattempt",
            name="started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="quizattempt",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterModelOptions(
            name="quizattempt",
            options={"ordering": ["-completed_at", "-started_at"]},
        ),
    ]
