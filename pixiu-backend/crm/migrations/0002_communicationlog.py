import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0001_initial"),
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CommunicationLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("recipient", models.CharField(max_length=200)),
                ("channel", models.CharField(default="whatsapp", max_length=30)),
                ("template", models.CharField(blank=True, max_length=120)),
                ("message", models.TextField()),
                ("status", models.CharField(default="Delivered", max_length=40)),
                ("sent_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="communication_logs", to=settings.AUTH_USER_MODEL)),
                ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="communication_logs", to="academics.student")),
            ],
            options={"ordering": ["-sent_at"]},
        ),
    ]
