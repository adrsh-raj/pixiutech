from rest_framework import serializers
from .models import Lead, LeadActivity

class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = "__all__"
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        status_value = attrs.get("status", getattr(self.instance, "status", "new"))
        school = attrs.get("converted_school", getattr(self.instance, "converted_school", None))
        if status_value == "won" and school is None:
            raise serializers.ValidationError("A won lead must be linked to the converted school.")
        return attrs

    def create(self, validated_data):
        return Lead.objects.create(created_by=self.context["request"].user, **validated_data)

class LeadActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadActivity
        fields = "__all__"
        read_only_fields = ["id", "actor", "created_at"]

    def create(self, validated_data):
        return LeadActivity.objects.create(actor=self.context["request"].user, **validated_data)
