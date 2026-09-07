import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from academics.models import School


class LeadStatus(models.TextChoices):
    NEW = "new", "New"
    CONTACTED = "contacted", "Contacted"
    QUALIFIED = "qualified", "Qualified"
    PROPOSAL = "proposal", "Proposal"
    NEGOTIATION = "negotiation", "Negotiation"
    WON = "won", "Won"
    LOST = "lost", "Lost"


class LeadSource(models.TextChoices):
    WEBSITE = "website", "Website"
    REFERRAL = "referral", "Referral"
    OUTBOUND = "outbound", "Outbound"
    EVENT = "event", "Event"
    SOCIAL = "social", "Social"
    OTHER = "other", "Other"


class Lead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_name = models.CharField(max_length=250)
    contact_name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    source = models.CharField(max_length=20, choices=LeadSource.choices, default=LeadSource.OTHER)
    status = models.CharField(max_length=20, choices=LeadStatus.choices, default=LeadStatus.NEW)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="crm_leads")
    converted_school = models.ForeignKey(School, on_delete=models.PROTECT, null=True, blank=True, related_name="converted_leads")
    expected_students = models.PositiveIntegerField(default=0)
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    next_follow_up = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.organization_name = self.organization_name.strip()
        self.contact_name = self.contact_name.strip()
        super().save(*args, **kwargs)


class LeadActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="crm_activities")
    activity_type = models.CharField(max_length=50)
    summary = models.CharField(max_length=250)
    detail = models.TextField(blank=True)
    next_follow_up = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class LeadContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=200)
    designation = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["lead", "email"], condition=~Q(email=""), name="uniq_lead_contact_email"),
        ]


class CommunicationLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="communication_logs")
    student = models.ForeignKey("academics.Student", on_delete=models.PROTECT, null=True, blank=True, related_name="communication_logs")
    recipient = models.CharField(max_length=200)
    channel = models.CharField(max_length=30, default="whatsapp")
    template = models.CharField(max_length=120, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=40, default="Delivered")
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at"]
