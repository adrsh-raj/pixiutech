from rest_framework import serializers
from rest_framework.reverse import reverse

from .models import (
    CareerApplication,
    CareerOpening,
    CareerOpeningStatus,
    CommunicationLog,
    LabEnquiryAttachment,
    Lead,
    LeadActivity,
    LeadContact,
)


class LabEnquiryAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = LabEnquiryAttachment
        fields = ["id", "original_name", "size", "content_type", "created_at", "url"]
        read_only_fields = fields

    def get_url(self, obj):
        request = self.context.get("request")
        if not request:
            return ""
        try:
            return reverse("v1-lab-enquiry-attachment", kwargs={"attachment_id": obj.id}, request=request)
        except Exception:
            return ""


class LeadContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadContact
        fields = ["id", "lead", "name", "designation", "email", "phone", "is_primary", "created_at"]
        read_only_fields = ["id", "created_at"]


class LeadActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadActivity
        fields = ["id", "lead", "activity_type", "summary", "detail", "next_follow_up", "actor", "created_at"]
        read_only_fields = ["id", "actor", "created_at"]


class LeadSerializer(serializers.ModelSerializer):
    activities = LeadActivitySerializer(many=True, read_only=True)
    contacts = LeadContactSerializer(many=True, read_only=True)
    lab_attachments = LabEnquiryAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = ["id", "organization_name", "contact_name", "email", "phone", "source", "enquiry_type", "status", "owner", "converted_school", "expected_students", "estimated_value", "next_follow_up", "notes", "created_at", "updated_at", "activities", "contacts", "lab_attachments"]
        read_only_fields = ["id", "owner", "created_at", "updated_at", "activities", "contacts"]


class CommunicationLogSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = CommunicationLog
        fields = ["id", "student", "student_id", "recipient", "channel", "template", "message", "status", "sent_at", "actor"]
        read_only_fields = ["id", "student_id", "sent_at", "actor"]



class CareerOpeningSerializer(serializers.ModelSerializer):
    application_count = serializers.SerializerMethodField()

    def get_application_count(self, obj):
        return obj.applications.count()

    class Meta:
        model = CareerOpening
        fields = [
            'id', 'title', 'location', 'employment_type', 'description',
            'requirements', 'status', 'sort_order', 'application_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'application_count', 'created_at', 'updated_at']


class PublicCareerOpeningSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareerOpening
        fields = ['id', 'title', 'location', 'employment_type', 'description', 'requirements', 'created_at']
        read_only_fields = fields


class CareerApplicationSerializer(serializers.ModelSerializer):
    opening_title = serializers.CharField(source='opening.title', read_only=True, allow_null=True)
    cv_available = serializers.SerializerMethodField()

    class Meta:
        model = CareerApplication
        fields = [
            'id', 'opening', 'opening_title', 'name', 'email', 'phone',
            'cover_message', 'cv_original_name', 'cv_size', 'status',
            'cv_available', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'opening_title', 'cv_original_name', 'cv_size',
            'cv_available', 'created_at', 'updated_at',
        ]

    def get_cv_available(self, obj):
        return bool(obj.cv)


class PublicCareerApplicationSerializer(serializers.Serializer):
    opening = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(max_length=160)
    email = serializers.EmailField(max_length=254)
    phone = serializers.RegexField(
        regex=r'^[6-9][0-9]{9}$',
        max_length=10,
        min_length=10,
        error_messages={'invalid': 'Enter a valid 10-digit Indian mobile number.'},
    )
    cover_message = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    cv = serializers.FileField()
    website = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_name(self, value):
        value = ' '.join(str(value).split())
        if len(value) < 2:
            raise serializers.ValidationError('Please enter your full name.')
        return value

    def validate_website(self, value):
        if value.strip():
            raise serializers.ValidationError('Unable to process this application.')
        return ''

    def validate_opening(self, value):
        if value is None:
            return None
        try:
            return CareerOpening.objects.get(id=value, status=CareerOpeningStatus.PUBLISHED)
        except CareerOpening.DoesNotExist as exc:
            raise serializers.ValidationError('This role is no longer accepting applications.') from exc
