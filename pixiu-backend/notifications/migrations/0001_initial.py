import uuid
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings
from django.db.models import Q

class Migration(migrations.Migration):
    initial=True
    dependencies=[migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[
        migrations.CreateModel(name="Notification",fields=[
            ("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),("notification_type",models.CharField(choices=[("info","Info"),("success","Success"),("warning","Warning"),("action","Action"),("payment","Payment"),("inventory","Inventory"),("crm","CRM"),("system","System")],default="info",max_length=20)),("title",models.CharField(max_length=200)),("message",models.TextField()),("event_key",models.CharField(max_length=160)),("read_at",models.DateTimeField(blank=True,null=True)),("created_at",models.DateTimeField(auto_now_add=True)),
            ("recipient",models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name="notifications",to=settings.AUTH_USER_MODEL))],options={"ordering":["-created_at"]}),
        migrations.CreateModel(name="NotificationPreference",fields=[
            ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("in_app_enabled",models.BooleanField(default=True)),("email_enabled",models.BooleanField(default=False)),("sms_enabled",models.BooleanField(default=False)),("updated_at",models.DateTimeField(auto_now=True)),
            ("user",models.OneToOneField(on_delete=django.db.models.deletion.CASCADE,related_name="notification_preferences",to=settings.AUTH_USER_MODEL))]),
        migrations.AddConstraint(model_name="notification",constraint=models.UniqueConstraint(condition=~models.Q(("event_key","")),fields=("recipient","event_key"),name="uniq_notification_recipient_event")),
    ]
