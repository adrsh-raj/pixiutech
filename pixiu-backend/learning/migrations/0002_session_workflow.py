from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [("learning", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="session",
            name="status",
            field=models.CharField(
                choices=[
                    ("planned", "Planned"),
                    ("in_progress", "In progress"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="planned",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="SessionActivity",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=250)),
                ("activity_type", models.CharField(default="lesson", max_length=50)),
                ("notes", models.TextField(blank=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_session_activities", to="accounts.user")),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="activities", to="learning.session")),
            ],
            options={"ordering": ["created_at"]},
        ),
    ]
