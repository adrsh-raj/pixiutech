import uuid
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings
from django.db.models import Q

class Migration(migrations.Migration):
    initial=True
    dependencies=[("academics","0001_initial"),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[
        migrations.CreateModel(name="Lead",fields=[
            ("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),("organization_name",models.CharField(max_length=250)),("contact_name",models.CharField(max_length=200)),("email",models.EmailField(blank=True,max_length=254)),("phone",models.CharField(blank=True,max_length=30)),
            ("source",models.CharField(choices=[("website","Website"),("referral","Referral"),("outbound","Outbound"),("event","Event"),("social","Social"),("other","Other")],default="other",max_length=20)),("status",models.CharField(choices=[("new","New"),("contacted","Contacted"),("qualified","Qualified"),("proposal","Proposal"),("negotiation","Negotiation"),("won","Won"),("lost","Lost")],default="new",max_length=20)),("expected_students",models.PositiveIntegerField(default=0)),("estimated_value",models.DecimalField(decimal_places=2,default=0,max_digits=12)),("next_follow_up",models.DateTimeField(blank=True,null=True)),("notes",models.TextField(blank=True)),("created_at",models.DateTimeField(auto_now_add=True)),("updated_at",models.DateTimeField(auto_now=True)),
            ("converted_school",models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.PROTECT,related_name="converted_leads",to="academics.school")),("owner",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="crm_leads",to=settings.AUTH_USER_MODEL))]),
        migrations.CreateModel(name="LeadActivity",fields=[("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),("activity_type",models.CharField(max_length=50)),("summary",models.CharField(max_length=250)),("detail",models.TextField(blank=True)),("next_follow_up",models.DateTimeField(blank=True,null=True)),("created_at",models.DateTimeField(auto_now_add=True)),("actor",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="crm_activities",to=settings.AUTH_USER_MODEL)),("lead",models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name="activities",to="crm.lead"))],options={"ordering":["-created_at"]}),
        migrations.CreateModel(name="LeadContact",fields=[("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),("name",models.CharField(max_length=200)),("designation",models.CharField(blank=True,max_length=150)),("email",models.EmailField(blank=True,max_length=254)),("phone",models.CharField(blank=True,max_length=30)),("is_primary",models.BooleanField(default=False)),("created_at",models.DateTimeField(auto_now_add=True)),("lead",models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name="contacts",to="crm.lead"))]),
        migrations.AddConstraint(model_name="leadcontact",constraint=models.UniqueConstraint(condition=~Q(email=""),fields=("lead","email"),name="uniq_lead_contact_email")),
    ]
