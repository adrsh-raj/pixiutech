import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name="AuditLog", fields=[
        ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
        ("action", models.CharField(choices=[("create","Create"),("update","Update"),("delete","Delete"),("login","Login"),("logout","Logout"),("export","Export")], max_length=20)),
        ("app_label", models.CharField(max_length=80)), ("model_name", models.CharField(blank=True, max_length=120)), ("object_id", models.CharField(blank=True, max_length=100)), ("method", models.CharField(blank=True, max_length=10)), ("path", models.CharField(blank=True, max_length=500)), ("status_code", models.PositiveSmallIntegerField(blank=True, null=True)), ("ip_address", models.GenericIPAddressField(blank=True, null=True)), ("user_agent", models.TextField(blank=True)), ("changes", models.JSONField(blank=True, default=dict)), ("created_at", models.DateTimeField(auto_now_add=True)),
        ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="audit_events", to=settings.AUTH_USER_MODEL)),
    ], options={"ordering":["-created_at"], "indexes":[models.Index(fields=["actor","created_at"]), models.Index(fields=["app_label","model_name","created_at"]), models.Index(fields=["action","created_at"])]})]
