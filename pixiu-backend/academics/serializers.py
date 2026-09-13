from datetime import datetime

from django.db import transaction
from rest_framework import serializers

from .models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from .services import accessible_class_queryset, provision_student


PHONE_RE = r"^[0-9]{10}$"


def validate_indian_phone(value, field_name="Phone"):
    value = str(value or "").strip().replace(" ", "")
    if not value:
        return ""
    serializers.RegexField(regex=PHONE_RE).run_validation(value)
    return value


class FlexibleDateField(serializers.DateField):
    """Accept common browser/API date representations and normalize to a date."""
    def to_internal_value(self, value):
        if value not in (None, ""):
            raw = str(value).strip()
            if raw:
                if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
                    value = raw[:10]
                else:
                    for separator in ("-", "/"):
                        parts = raw.split(separator)
                        if len(parts) == 3 and all(part.isdigit() for part in parts):
                            first, second, year = parts
                            if len(year) == 4 and len(first) <= 2 and len(second) <= 2:
                                day = int(first); month = int(second)
                                if day > 12 and month <= 12: day, month = month, day
                                if 1 <= day <= 31 and 1 <= month <= 12:
                                    value = f"{year}-{month:02d}-{day:02d}"
                                break
                    if value == raw:
                        for fmt in ("%d %m %Y", "%d %b %Y", "%d %B %Y"):
                            try:
                                value = datetime.strptime(raw, fmt).date().isoformat(); break
                            except ValueError:
                                continue
        return super().to_internal_value(value)


class SchoolSerializer(serializers.ModelSerializer):
    account_username = serializers.CharField(source="account.username", read_only=True)
    class Meta:
        model = School
        fields = ["id", "account_username", "school_code", "name", "principal_name", "phone", "email", "address", "lab_name", "lab_location", "lab_capacity", "lab_notes", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "account_username", "created_at", "updated_at"]
    def validate_school_code(self, value):
        value = value.strip().upper()
        if self.instance is not None and value != self.instance.school_code:
            raise serializers.ValidationError("School code is immutable because it is the account username and part of student IDs.")
        if School.objects.filter(school_code=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("School code already exists.")
        return value
    def validate_phone(self, value): return validate_indian_phone(value, "School phone")


class TrainerSerializer(serializers.ModelSerializer):
    account_username = serializers.CharField(source="account.username", read_only=True)
    status = serializers.CharField(required=False, allow_blank=False)
    class Meta:
        model = Trainer
        fields = ["id", "account_username", "trainer_id", "name", "email", "phone", "qualification", "specialization", "daily_rate", "weekly_days", "monthly_compensation", "rating", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "account_username", "created_at", "updated_at"]
        extra_kwargs = {"trainer_id": {"required": False, "allow_blank": True, "allow_null": True}}
    def validate_trainer_id(self, value):
        if value in (None, ""): return value
        value = value.strip().upper()
        if self.instance is not None and value != self.instance.trainer_id:
            raise serializers.ValidationError("Trainer ID is immutable because it is the account username.")
        if Trainer.objects.filter(trainer_id=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("Trainer ID already exists.")
        return value
    def validate_phone(self, value): return validate_indian_phone(value, "Trainer phone")
    def validate_status(self, value):
        normalized = str(value or "").strip().lower(); aliases = {"active": "active", "inactive": "inactive", "enabled": "active", "disabled": "inactive"}
        if normalized not in aliases: raise serializers.ValidationError("Status must be active or inactive.")
        return aliases[normalized]


class TrainerSchoolAssignmentSerializer(serializers.ModelSerializer):
    trainer_id = serializers.CharField(source="trainer.trainer_id", read_only=True)
    school_code = serializers.CharField(source="school.school_code", read_only=True)
    class Meta:
        model = TrainerSchoolAssignment
        fields = ["id", "trainer", "trainer_id", "school", "school_code", "assigned_from", "assigned_to", "status", "created_at"]
        read_only_fields = ["id", "trainer_id", "school_code", "created_at"]
    def validate(self, attrs):
        assigned_from = attrs.get("assigned_from", getattr(self.instance, "assigned_from", None)); assigned_to = attrs.get("assigned_to", getattr(self.instance, "assigned_to", None))
        if assigned_to and assigned_from and assigned_to < assigned_from: raise serializers.ValidationError("Assignment end date cannot be before its start date.")
        return attrs


class SchoolClassSerializer(serializers.ModelSerializer):
    school_code = serializers.CharField(source="school.school_code", read_only=True)
    active_student_count = serializers.SerializerMethodField()
    class Meta:
        model = SchoolClass
        fields = ["id", "school", "school_code", "grade", "section", "display_name", "status", "active_student_count", "created_at", "updated_at"]
        read_only_fields = ["id", "school_code", "active_student_count", "created_at", "updated_at"]
    def get_active_student_count(self, obj): return obj.students.filter(status="active").count()
    def validate(self, attrs):
        request = self.context["request"]; current_school = getattr(self.instance, "school", None); school = attrs.get("school", current_school)
        grade = str(attrs.get("grade", getattr(self.instance, "grade", ""))).strip().upper(); section = str(attrs.get("section", getattr(self.instance, "section", ""))).strip().upper()
        if request.user.role == "school" and (not school or school.account_id != request.user.id): raise serializers.ValidationError("A school can only manage its own classes.")
        if self.instance is not None and self.instance.students.exists() and (school != self.instance.school or grade != self.instance.grade or section != self.instance.section):
            raise serializers.ValidationError("A class with students cannot change school, grade, or section because those fields define student IDs.")
        if school and SchoolClass.objects.filter(school=school, grade=grade, section=section).exclude(pk=getattr(self.instance, "pk", None)).exists(): raise serializers.ValidationError("This class already exists for the school.")
        attrs["grade"] = grade; attrs["section"] = section; return attrs


class StudentReadSerializer(serializers.ModelSerializer):
    school_code = serializers.CharField(source="school_class.school.school_code", read_only=True)
    school_name = serializers.CharField(source="school_class.school.name", read_only=True)
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    account_username = serializers.CharField(source="account.username", read_only=True)
    class Meta:
        model = Student
        fields = ["id", "student_id", "account_username", "school_code", "school_name", "school_class", "class_name", "roll_number", "name", "date_of_birth", "gender", "email", "phone", "guardian_name", "guardian_phone", "guardian_email", "address", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "student_id", "account_username", "school_code", "school_name", "class_name", "school_class", "roll_number", "created_at", "updated_at"]


class StudentCreateSerializer(serializers.ModelSerializer):
    date_of_birth = FlexibleDateField(required=False, allow_null=True)
    class Meta:
        model = Student
        fields = ["school_class", "roll_number", "name", "date_of_birth", "gender", "email", "phone", "guardian_name", "guardian_phone", "guardian_email", "address", "status"]
    def validate(self, attrs):
        request = self.context["request"]; school_class = attrs["school_class"]
        if not accessible_class_queryset(request.user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot create a student in this class.")
        if Student.objects.filter(school_class=school_class, roll_number=attrs["roll_number"]).exists(): raise serializers.ValidationError("That roll number is already used in this class.")
        return attrs
    def validate_phone(self, value): return validate_indian_phone(value, "Student phone")
    def validate_guardian_phone(self, value): return validate_indian_phone(value, "Guardian phone")
    def create(self, validated_data):
        with transaction.atomic(): student = Student.objects.create(**validated_data); student, password = provision_student(student=student)
        self.generated_password = password; return student


class StudentUpdateSerializer(serializers.ModelSerializer):
    date_of_birth = FlexibleDateField(required=False, allow_null=True)
    class Meta:
        model = Student
        fields = ["name", "date_of_birth", "gender", "email", "phone", "guardian_name", "guardian_phone", "guardian_email", "address", "status"]
    def validate_phone(self, value): return validate_indian_phone(value, "Student phone")
    def validate_guardian_phone(self, value): return validate_indian_phone(value, "Guardian phone")
    def update(self, instance, validated_data):
        result = super().update(instance, validated_data)
        if result.account_id:
            result.account.display_name = result.name; result.account.email = result.email; result.account.save(update_fields=["display_name", "email"])
        return result
