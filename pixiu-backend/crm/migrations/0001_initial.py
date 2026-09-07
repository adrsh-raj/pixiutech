import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("academics", "0001_initial")]
    operations = [
        migrations.CreateModel(name="Lead", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("lead_code", models.CharField(max_length=40, unique=True)), ("organization_name", models.CharField(max_length=200)), ("contact_name", models.CharField(max_length=150)), ("phone", models.CharField(blank=True, max_length=30)), ("email", models.EmailField(blank=True, max_length=254)), ("city", models.CharField(blank=True, max_length=100)), ("address", models.TextField(blank=True)), ("source", models.CharField(blank=True, max_length=80)), ("status", models.CharField(choices=[("new","New"),("contacted","Contacted"),("qualified","Qualified"),("proposal","Proposal"),("won","Won"),("lost","Lost")], default="new", max_length=20)), ("priority", models.CharField(choices=[("low","Low"),("normal","Normal"),("high","High")], default="normal", max_length=20)), ("requirement", models.TextField(blank=True)), ("notes", models.TextField(blank=True)), ("next_followup_at", models.DateTimeField(blank=True, null=True)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("assigned_to", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="assigned_leads", to=settings.AUTH_USER_MODEL)), ("converted_school", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="source_leads", to="academics.school")), ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_leads", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering":["-updated_at"], "indexes":[models.Index(fields=["status","priority"]), models.Index(fields=["next_followup_at"]), models.Index(fields=["organization_name"])]}),
        migrations.CreateModel(name="LeadActivity", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("activity_type", models.CharField(max_length=50)), ("summary", models.TextField()), ("happened_at", models.DateTimeField()), ("next_followup_at", models.DateTimeField(blank=True, null=True)), ("created_at", models.DateTimeField(auto_now_add=True)),
            ("actor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="lead_activities", to=settings.AUTH_USER_MODEL)), ("lead", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="activities", to="crm.lead")),
        ], options={"ordering":["-happened_at"]}),
    ]
