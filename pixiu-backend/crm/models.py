import uuid

from django.conf import settings
from django.db import models

from academics.models import School


class LeadStatus(models.TextChoices):
    NEW = "new", "New"
    CONTACTED = "contacted", "Contacted"
    QUALIFIED = "qualified", "Qualified"
    PROPOSAL = "proposal", "Proposal"
    WON = "won", "Won"
    LOST = "lost", "Lost"


class LeadPriority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"


class Lead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead_code = models.CharField(max_length=40, unique=True)
    organization_name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    source = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=20, choices=LeadStatus.choices, default=LeadStatus.NEW)
    priority = models.CharField(max_length=20, choices=LeadPriority.choices, default=LeadPriority.NORMAL)
    requirement = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="assigned_leads")
    converted_school = models.ForeignKey(School, on_delete=models.PROTECT, null=True, blank=True, related_name="source_leads")
    next_followup_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_leads")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["status", "priority"]), models.Index(fields=["next_followup_at"]), models.Index(fields=["organization_name"]) ]


class LeadActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="activities")
    activity_type = models.CharField(max_length=50)
    summary = models.TextField()
    happened_at = models.DateTimeField()
    next_followup_at = models.DateTimeField(null=True, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="lead_activities")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-happened_at"]
