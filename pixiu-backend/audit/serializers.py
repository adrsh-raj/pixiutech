from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_id = serializers.CharField(source="actor.username", read_only=True, allow_null=True)
    name = serializers.CharField(source="actor.display_name", read_only=True, allow_null=True)
    role = serializers.CharField(source="actor.role", read_only=True, allow_null=True)
    school_id = serializers.SerializerMethodField()
    event_type = serializers.CharField(source="action", read_only=True)
    status = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "actor", "actor_username", "user_id", "name", "role", "school_id",
            "action", "event_type", "entity_type", "entity_id", "summary", "changes",
            "ip_address", "user_agent", "status", "date", "time", "created_at",
        ]
        read_only_fields = fields

    actor_username = serializers.CharField(source="actor.username", read_only=True, allow_null=True)

    def get_school_id(self, obj):
        actor = obj.actor
        if not actor:
            return ""
        try:
            if actor.role == "school":
                return actor.school_profile.school_code
            if actor.role == "trainer":
                assignment = actor.trainer_profile.school_assignments.filter(status="active").select_related("school").first()
                return assignment.school.school_code if assignment else ""
            if actor.role == "student":
                return actor.student_profile.school_class.school.school_code
        except AttributeError:
            return ""
        return ""

    def get_status(self, obj):
        return "Verified"

    def get_date(self, obj):
        return obj.created_at.strftime("%Y-%m-%d")

    def get_time(self, obj):
        return obj.created_at.strftime("%H:%M:%S")
