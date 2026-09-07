from rest_framework import serializers

from accounts.models import UserRole
from academics.models import SchoolClass, Student, Trainer
from academics.services import accessible_class_queryset, accessible_student_queryset

from .models import (
    AttendanceRecord, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit,
    LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment,
    QuizQuestion, Session, StudentAssessment,
)
from .services import accessible_attempts, accessible_quizzes, create_attendance, grade_attempt


class SessionSerializer(serializers.ModelSerializer):
    school_code = serializers.CharField(source="school_class.school.school_code", read_only=True)
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    trainer_id = serializers.CharField(source="trainer.trainer_id", read_only=True)

    class Meta:
        model = Session
        fields = ["id", "school_class", "school_code", "class_name", "trainer", "trainer_id", "date", "start_time", "end_time", "topic", "notes", "status", "is_locked", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "school_code", "class_name", "trainer_id", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context["request"]
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        trainer = attrs.get("trainer", getattr(self.instance, "trainer", None))
        if school_class and not accessible_class_queryset(request.user).filter(pk=school_class.pk).exists():
            raise serializers.ValidationError("You cannot manage a session for this class.")
        if trainer and not Trainer.objects.filter(pk=trainer.pk).exists():
            raise serializers.ValidationError("Trainer does not exist.")
        if trainer and school_class and request.user.role != UserRole.ADMIN:
            if not trainer.school_assignments.filter(school_id=school_class.school_id, status="active").exists():
                raise serializers.ValidationError("Trainer is not assigned to this school.")
        if request.user.role == UserRole.TRAINER and trainer and trainer.account_id != request.user.id:
            raise serializers.ValidationError("A trainer can only schedule their own sessions.")
        if self.instance and self.instance.is_locked and request.user.role != UserRole.ADMIN:
            raise serializers.ValidationError("Locked sessions cannot be edited.")
        return attrs

    def create(self, validated_data):
        return Session.objects.create(created_by=self.context["request"].user, **validated_data)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True)
    session_topic = serializers.CharField(source="session.topic", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ["id", "session", "student", "student_id", "session_topic", "status", "marked_by", "marked_at", "note"]
        read_only_fields = ["id", "student_id", "session_topic", "marked_by", "marked_at"]

    def create(self, validated_data):
        return create_attendance(user=self.context["request"].user, **validated_data)[0] if isinstance(create_attendance(user=self.context["request"].user, **validated_data), tuple) else create_attendance(user=self.context["request"].user, **validated_data)


class CurriculumUnitSerializer(serializers.ModelSerializer):
    class_count = serializers.IntegerField(source="class_assignments.count", read_only=True)

    class Meta:
        model = CurriculumUnit
        fields = ["id", "grade", "level", "unit_code", "title", "week", "topic", "objectives", "status", "created_by", "class_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "class_count", "created_at", "updated_at"]


class CurriculumClassAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)

    class Meta:
        model = CurriculumClassAssignment
        fields = ["id", "curriculum_unit", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]

    def validate(self, attrs):
        school_class = attrs["school_class"]
        unit = attrs["curriculum_unit"]
        if not accessible_class_queryset(self.context["request"].user).filter(pk=school_class.pk).exists():
            raise serializers.ValidationError("You cannot assign curriculum to this class.")
        if str(unit.grade).upper() != str(school_class.grade).upper():
            raise serializers.ValidationError("Curriculum grade must match the class grade.")
        return attrs

    def create(self, validated_data):
        return CurriculumClassAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)


class LearningContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningContent
        fields = ["id", "title", "description", "content_type", "grade", "level", "unit_code", "url", "file", "target_role", "status", "is_watermarked", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class ContentClassAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)

    class Meta:
        model = ContentClassAssignment
        fields = ["id", "content", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]

    def validate(self, attrs):
        user = self.context["request"].user
        school_class = attrs["school_class"]
        content = attrs["content"]
        if not accessible_class_queryset(user).filter(pk=school_class.pk).exists():
            raise serializers.ValidationError("You cannot assign content to this class.")
        if content.grade and str(content.grade).upper() != str(school_class.grade).upper():
            raise serializers.ValidationError("Content grade must match the class grade.")
        return attrs

    def create(self, validated_data):
        return ContentClassAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)


class QuizQuestionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizQuestion
        fields = ["id", "quiz", "question_order", "question_text", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation", "points"]
        read_only_fields = ["id"]


class QuizQuestionStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizQuestion
        fields = ["id", "question_order", "question_text", "option_a", "option_b", "option_c", "option_d", "points"]


class QuizSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ["id", "title", "grade", "level", "unit_code", "duration_minutes", "max_attempts", "status", "created_by", "questions", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "questions", "created_at", "updated_at"]

    def get_questions(self, obj):
        user = self.context["request"].user
        serializer = QuizQuestionStudentSerializer if user.role == UserRole.STUDENT else QuizQuestionWriteSerializer
        return serializer(obj.questions.all(), many=True).data


class QuizClassAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)

    class Meta:
        model = QuizClassAssignment
        fields = ["id", "quiz", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]

    def validate(self, attrs):
        user = self.context["request"].user
        if not accessible_class_queryset(user).filter(pk=attrs["school_class"].pk).exists():
            raise serializers.ValidationError("You cannot assign this quiz to the selected class.")
        if str(attrs["quiz"].grade).upper() != str(attrs["school_class"].grade).upper():
            raise serializers.ValidationError("Quiz grade must match the class grade.")
        return attrs

    def create(self, validated_data):
        return QuizClassAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)


class QuizAttemptReadSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)
    student_id = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = QuizAttempt
        fields = ["id", "quiz", "quiz_title", "student", "student_id", "attempt_number", "score", "total_marks", "percentage", "correct_count", "attempted_count", "total_questions", "time_taken_seconds", "violation_count", "status", "completed_at"]
        read_only_fields = fields


class QuizAttemptCreateSerializer(serializers.Serializer):
    quiz = serializers.PrimaryKeyRelatedField(queryset=Quiz.objects.all())
    student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(), required=False)
    answers = serializers.JSONField()
    time_taken_seconds = serializers.IntegerField(min_value=0, default=0)
    violation_count = serializers.IntegerField(min_value=0, default=0)

    def validate(self, attrs):
        request = self.context["request"]
        student = attrs.get("student") or getattr(request.user, "student_profile", None)
        if not student:
            raise serializers.ValidationError({"student": "Student is required for this submission."})
        if not accessible_student_queryset(request.user).filter(pk=student.pk).exists():
            raise serializers.ValidationError({"student": "You cannot submit an attempt for this student."})
        if not accessible_quizzes(request.user).filter(pk=attrs["quiz"].pk).exists():
            raise serializers.ValidationError({"quiz": "You cannot attempt this quiz."})
        if request.user.role == UserRole.STUDENT and student.account_id != request.user.id:
            raise serializers.ValidationError({"student": "Students can only submit their own attempts."})
        attrs["student"] = student
        return attrs

    def create(self, validated_data):
        return grade_attempt(**validated_data)


class StudentAssessmentSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True)
    trainer_id = serializers.CharField(source="trainer.trainer_id", read_only=True)

    class Meta:
        model = StudentAssessment
        fields = ["id", "student", "student_id", "trainer", "trainer_id", "unit_code", "level", "title", "score", "rating", "status", "feedback", "assessment_date", "created_at", "updated_at"]
        read_only_fields = ["id", "student_id", "trainer_id", "created_at", "updated_at"]

    def validate(self, attrs):
        user = self.context["request"].user
        student = attrs.get("student", getattr(self.instance, "student", None))
        if student and not accessible_student_queryset(user).filter(pk=student.pk).exists():
            raise serializers.ValidationError("You cannot assess this student.")
        if user.role == UserRole.TRAINER:
            trainer = attrs.get("trainer", getattr(self.instance, "trainer", None))
            if trainer and trainer.account_id != user.id:
                raise serializers.ValidationError("A trainer can only submit their own assessments.")
        return attrs


class ProjectSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = Project
        fields = ["id", "student", "student_id", "title", "description", "status", "score", "trainer_feedback", "submitted_at", "completed_at", "created_at", "updated_at"]
        read_only_fields = ["id", "student_id", "created_at", "updated_at"]

    def validate_student(self, student):
        if not accessible_student_queryset(self.context["request"].user).filter(pk=student.pk).exists():
            raise serializers.ValidationError("You cannot manage a project for this student.")
        return student


class ProjectEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectEvidence
        fields = ["id", "project", "title", "note", "file", "external_url", "uploaded_by", "created_at"]
        read_only_fields = ["id", "uploaded_by", "created_at"]

    def validate_project(self, project):
        user = self.context["request"].user
        if not accessible_student_queryset(user).filter(pk=project.student_id).exists():
            raise serializers.ValidationError("You cannot add evidence to this project.")
        return project

    def create(self, validated_data):
        return ProjectEvidence.objects.create(uploaded_by=self.context["request"].user, **validated_data)
