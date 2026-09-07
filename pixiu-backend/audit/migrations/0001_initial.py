import uuid
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):
    initial=True
    dependencies=[migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[
        migrations.CreateModel(name="AuditLog",fields=[
            ("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),
            ("action",models.CharField(choices=[("create","Create"),("update","Update"),("delete","Delete"),("login","Login"),("logout","Logout"),("export","Export"),("approve","Approve"),("reject","Reject"),("other","Other")],max_length=20)),
            ("entity_type",models.CharField(max_length=100)),("entity_id",models.CharField(blank=True,max_length=100)),("summary",models.CharField(max_length=500)),("changes",models.JSONField(blank=True,default=dict)),("ip_address",models.GenericIPAddressField(blank=True,null=True)),("user_agent",models.TextField(blank=True)),("created_at",models.DateTimeField(auto_now_add=True)),
            ("actor",models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.SET_NULL,related_name="audit_events",to=settings.AUTH_USER_MODEL))],options={"ordering":["-created_at"],"indexes":[models.Index(fields=["entity_type","entity_id"],name="audit_entity_idx"),models.Index(fields=["actor","created_at"],name="audit_actor_time_idx")]}),
    ]
