from rest_framework import serializers

from .models import CommunicationLog, Lead, LeadActivity, LeadContact


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

    class Meta:
        model = Lead
        fields = ["id", "organization_name", "contact_name", "email", "phone", "source", "status", "owner", "converted_school", "expected_students", "estimated_value", "next_follow_up", "notes", "created_at", "updated_at", "activities", "contacts"]
        read_only_fields = ["id", "owner", "created_at", "updated_at", "activities", "contacts"]


class CommunicationLogSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = CommunicationLog
        fields = ["id", "student", "student_id", "recipient", "channel", "template", "message", "status", "sent_at", "actor"]
        read_only_fields = ["id", "student_id", "sent_at", "actor"]
