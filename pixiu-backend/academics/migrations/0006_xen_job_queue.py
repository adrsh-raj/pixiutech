import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0005_xensession_user_key"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="XenWorkerHeartbeat",
            fields=[
                ("worker_id", models.CharField(max_length=128, primary_key=True, serialize=False)),
                ("last_seen", models.DateTimeField(auto_now=True, db_index=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Xen Worker Heartbeat",
                "verbose_name_plural": "Xen Worker Heartbeats",
            },
        ),
        migrations.CreateModel(
            name="XenJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("idempotency_key", models.CharField(max_length=128)),
                ("role", models.CharField(choices=[("admin", "Admin"), ("school", "School"), ("trainer", "Trainer"), ("student", "Student")], max_length=20)),
                ("intent", models.CharField(default="TEACHING", max_length=40)),
                ("status", models.CharField(choices=[("queued", "Queued"), ("claimed", "Claimed"), ("running", "Running"), ("completed", "Completed"), ("failed", "Failed"), ("expired", "Expired"), ("cancelled", "Cancelled")], db_index=True, default="queued", max_length=20)),
                ("request_hash", models.CharField(blank=True, max_length=64)),
                ("prompt", models.TextField()),
                ("history", models.JSONField(blank=True, default=list)),
                ("max_tokens", models.PositiveIntegerField(default=1024)),
                ("temperature", models.FloatField(default=0.0)),
                ("worker_id", models.CharField(blank=True, db_index=True, max_length=128, null=True)),
                ("claim_count", models.PositiveIntegerField(default=0)),
                ("claimed_at", models.DateTimeField(blank=True, null=True)),
                ("lease_expires_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("heartbeat_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("response_summary", models.TextField(blank=True)),
                ("response_payload", models.JSONField(blank=True, null=True)),
                ("error_code", models.CharField(blank=True, max_length=64)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="xen_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Xen Job",
                "verbose_name_plural": "Xen Jobs",
                "ordering": ["created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="xenjob",
            constraint=models.UniqueConstraint(fields=("user", "idempotency_key"), name="xen_job_user_key_unique"),
        ),
        migrations.AddIndex(
            model_name="xenjob",
            index=models.Index(fields=["status", "created_at"], name="academics_x_status_c0d291_idx"),
        ),
        migrations.AddIndex(
            model_name="xenjob",
            index=models.Index(fields=["status", "lease_expires_at"], name="academics_x_status_27b878_idx"),
        ),
    ]
