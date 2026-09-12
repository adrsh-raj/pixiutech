from django.db import migrations, models
from django.core.validators import MaxValueValidator, MinValueValidator


class Migration(migrations.Migration):
    dependencies = [('learning', '0005_course_completion')]

    operations = [
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='requires_attendance',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='min_attendance_pct',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='requires_quiz',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='min_quiz_pct',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='requires_practical',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='min_practical_pct',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, validators=[MinValueValidator(0), MaxValueValidator(100)]),
        ),
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='requires_trainer_review',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='curriculumunitprofile',
            name='min_trainer_review_rating',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=3, null=True, validators=[MinValueValidator(0), MaxValueValidator(5)]),
        ),
    ]
