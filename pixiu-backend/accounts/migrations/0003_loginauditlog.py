from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_alter_user_is_staff_alter_user_user_permissions"),
    ]

    operations = [
        migrations.CreateModel(
            name="LoginAuditLog",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("user_id_snapshot", models.CharField(max_length=150)),
                ("name_snapshot", models.CharField(blank=True, max_length=200)),
                ("role", models.CharField(blank=True, max_length=20)),
                ("school_id", models.CharField(blank=True, max_length=50)),
                ("event_type", models.CharField(default="Login", max_length=50)),
                ("status", models.CharField(default="Verified", max_length=50)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="login_audit_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="loginauditlog",
            index=models.Index(fields=["created_at"], name="accounts_lo_created_9b67e8_idx"),
        ),
        migrations.AddIndex(
            model_name="loginauditlog",
            index=models.Index(fields=["role", "created_at"], name="accounts_lo_role_9b9fcf_idx"),
        ),
        migrations.AddIndex(
            model_name="loginauditlog",
            index=models.Index(fields=["user_id_snapshot", "created_at"], name="accounts_lo_user_id_4d72c4_idx"),
        ),
    ]
