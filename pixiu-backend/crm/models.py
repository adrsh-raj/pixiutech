import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from academics.models import School
from core.input_sanitization import sanitize_plain_text


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


class LeadEnquiryType(models.TextChoices):
    SALES = "sales", "Sales"
    BUG = "bug", "Bug"
    HELP = "help", "Help"
    OTHER = "other", "Other"
    PHILOSOPHY = "philosophy", "Think / Rethink Philosophy"

class Lead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_name = models.CharField(max_length=250)
    contact_name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    source = models.CharField(max_length=20, choices=LeadSource.choices, default=LeadSource.OTHER)
    enquiry_type = models.CharField(max_length=20, choices=LeadEnquiryType.choices, default=LeadEnquiryType.SALES)
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
        self.organization_name = sanitize_plain_text(self.organization_name, 250)
        self.contact_name = sanitize_plain_text(self.contact_name, 200)
        self.notes = sanitize_plain_text(self.notes, 10000, preserve_newlines=True)
        self.enquiry_type = str(self.enquiry_type or LeadEnquiryType.SALES)
        super().save(*args, **kwargs)


class LabEnquiryAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="lab_attachments")
    file = models.FileField(upload_to="private_lab_enquiries/", max_length=320)
    original_name = models.CharField(max_length=255)
    size = models.PositiveIntegerField()
    content_type = models.CharField(max_length=120)
    sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def save(self, *args, **kwargs):
        self.original_name = sanitize_plain_text(self.original_name, 255)
        self.content_type = sanitize_plain_text(self.content_type, 120)
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

    def save(self, *args, **kwargs):
        self.activity_type = sanitize_plain_text(self.activity_type, 50)
        self.summary = sanitize_plain_text(self.summary, 250)
        self.detail = sanitize_plain_text(self.detail, 10000, preserve_newlines=True)
        super().save(*args, **kwargs)

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

    def save(self, *args, **kwargs):
        self.name = sanitize_plain_text(self.name, 200)
        self.designation = sanitize_plain_text(self.designation, 150)
        super().save(*args, **kwargs)

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

    def save(self, *args, **kwargs):
        self.recipient = sanitize_plain_text(self.recipient, 200)
        self.channel = sanitize_plain_text(self.channel, 30)
        self.template = sanitize_plain_text(self.template, 120)
        self.message = sanitize_plain_text(self.message, 12000, preserve_newlines=True)
        self.status = sanitize_plain_text(self.status, 40)
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-sent_at"]



class CareerOpeningStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    CLOSED = "closed", "Closed"


class CareerApplicationStatus(models.TextChoices):
    NEW = "new", "New"
    REVIEWED = "reviewed", "Reviewed"
    SHORTLISTED = "shortlisted", "Shortlisted"
    REJECTED = "rejected", "Rejected"
    HIRED = "hired", "Hired"


def career_cv_upload_to(instance, filename):
    safe_id = str(instance.id or uuid.uuid4())
    return f"private_career_cvs/{safe_id}.pdf"


class CareerOpening(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=180)
    location = models.CharField(max_length=180, blank=True)
    employment_type = models.CharField(max_length=80, blank=True)
    description = models.TextField()
    requirements = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=CareerOpeningStatus.choices,
        default=CareerOpeningStatus.DRAFT,
    )
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-created_at"]
        indexes = [
            models.Index(fields=["status", "sort_order"], name="career_open_status_idx"),
        ]

    def save(self, *args, **kwargs):
        self.title = sanitize_plain_text(self.title, 180)
        self.location = sanitize_plain_text(self.location, 180)
        self.employment_type = sanitize_plain_text(self.employment_type, 80)
        self.description = sanitize_plain_text(self.description, 12000, preserve_newlines=True)
        self.requirements = sanitize_plain_text(self.requirements, 12000, preserve_newlines=True)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class CareerApplication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    opening = models.ForeignKey(
        CareerOpening,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
    )
    name = models.CharField(max_length=160)
    email = models.EmailField(max_length=254)
    phone = models.CharField(max_length=10)
    cover_message = models.TextField(blank=True, max_length=4000)
    cv = models.FileField(upload_to=career_cv_upload_to, max_length=300)
    cv_original_name = models.CharField(max_length=255)
    cv_size = models.PositiveIntegerField()
    cv_sha256 = models.CharField(max_length=64)
    status = models.CharField(
        max_length=20,
        choices=CareerApplicationStatus.choices,
        default=CareerApplicationStatus.NEW,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="career_app_status_idx"),
            models.Index(fields=["opening", "created_at"], name="career_app_opening_idx"),
        ]

    def save(self, *args, **kwargs):
        self.name = sanitize_plain_text(self.name, 160)
        self.email = sanitize_plain_text(self.email, 254).lower()
        self.phone = sanitize_plain_text(self.phone, 10)
        self.cover_message = sanitize_plain_text(self.cover_message, 4000, preserve_newlines=True)
        self.cv_original_name = sanitize_plain_text(self.cv_original_name, 255)
        super().save(*args, **kwargs)

    def __str__(self):
        role = self.opening.title if self.opening_id else "General Application"
        return f"{self.name} - {role}"
