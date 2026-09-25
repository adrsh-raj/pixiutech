from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0013_programmecompletion_updated_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningcontent",
            name="video_processing_status",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("processing", "Processing"),
                    ("ready", "Ready"),
                    ("failed", "Failed"),
                ],
                default="ready",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_processing_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_temp_key",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_requested_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("draft", "Draft"),
                    ("published", "Published"),
                    ("archived", "Archived"),
                ],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_original_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_duration_seconds",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_size_bytes",
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_width",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_height",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_processing_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="learningcontent",
            name="video_ready_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
