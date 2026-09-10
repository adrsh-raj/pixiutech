from accounts.models import UserRole
from academics.models import Student, Trainer
from academics.services import accessible_class_queryset, accessible_student_queryset

from rest_framework import serializers

from .models import (
    AttendanceRecord, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit,
    LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment,
    QuizQuestion, Session, SessionActivity, StudentAssessment,
)
from .services import accessible_quizzes, create_attendance, grade_attempt


class SessionSerializer(serializers.ModelSerializer):
    school_id = serializers.CharField(source="school_class.school.school_code", read_only=True)
    school_code = serializers.CharField(source="school_class.school.school_code", read_only=True)
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    trainer_id = serializers.CharField(source="trainer.trainer_id", read_only=True)
    trainer_name = serializers.CharField(source="trainer.name", read_only=True)
    activities = serializers.SerializerMethodField()
    class Meta:
        model = Session
        fields = ["id", "school_class", "school_id", "school_code", "class_name", "trainer", "trainer_id", "trainer_name", "date", "start_time", "end_time", "topic", "notes", "status", "is_locked", "created_by", "created_at", "updated_at", "activities"]
        read_only_fields = ["id", "school_id", "school_code", "class_name", "trainer_id", "trainer_name", "status", "is_locked", "created_by", "created_at", "updated_at", "activities"]
    def validate(self, attrs):
        request = self.context["request"]; instance = self.instance
        school_class = attrs.get("school_class", getattr(instance, "school_class", None)); trainer = attrs.get("trainer", getattr(instance, "trainer", None))
        if not school_class: raise serializers.ValidationError({"school_class": "Class is required."})
        if not trainer: raise serializers.ValidationError({"trainer": "Trainer is required."})
        if not accessible_class_queryset(request.user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot manage a session for this class.")
        if trainer.status != "active": raise serializers.ValidationError({"trainer": "Only active trainers can be scheduled."})
        if request.user.role != UserRole.ADMIN and not trainer.school_assignments.filter(school_id=school_class.school_id, status="active").exists(): raise serializers.ValidationError("Trainer is not assigned to this school.")
        if request.user.role == UserRole.TRAINER and trainer.account_id != request.user.id: raise serializers.ValidationError("A trainer can only schedule their own sessions.")
        if instance and instance.is_locked and request.user.role != UserRole.ADMIN: raise serializers.ValidationError("Locked sessions cannot be edited.")
        if instance and instance.status in {"completed", "cancelled"} and request.user.role != UserRole.ADMIN: raise serializers.ValidationError("Completed or cancelled sessions cannot be edited.")
        return attrs
    def create(self, validated_data): return Session.objects.create(created_by=self.context["request"].user, **validated_data)
    def get_activities(self, obj): return SessionActivitySerializer(obj.activities.all(), many=True, context=self.context).data


class SessionActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionActivity
        fields = ["id", "session", "title", "activity_type", "notes", "completed_at", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
    def validate(self, attrs):
        title = attrs.get("title", ""); session = self.instance.session if self.instance else attrs.get("session")
        if not str(title).strip(): raise serializers.ValidationError({"title": "Activity title is required."})
        if not session: raise serializers.ValidationError({"session": "Session is required."})
        return attrs


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True); student_name = serializers.CharField(source="student.name", read_only=True); roll_number = serializers.IntegerField(source="student.roll_number", read_only=True)
    class_id = serializers.SerializerMethodField(); class_name = serializers.CharField(source="session.school_class.display_name", read_only=True); school_code = serializers.CharField(source="session.school_class.school.school_code", read_only=True); trainer_id = serializers.CharField(source="session.trainer.trainer_id", read_only=True); session_topic = serializers.CharField(source="session.topic", read_only=True); date = serializers.DateField(source="session.date", read_only=True); time = serializers.TimeField(source="session.start_time", read_only=True); marked_by_username = serializers.CharField(source="marked_by.username", read_only=True)
    class Meta:
        model = AttendanceRecord
        fields = ["id", "session", "student", "student_id", "student_name", "roll_number", "class_id", "class_name", "school_code", "trainer_id", "session_topic", "date", "time", "status", "marked_by", "marked_by_username", "marked_at", "note"]
        read_only_fields = ["id", "student_id", "student_name", "roll_number", "class_id", "class_name", "school_code", "trainer_id", "session_topic", "date", "time", "marked_by", "marked_by_username", "marked_at"]
    def get_class_id(self, obj): return str(obj.session.school_class_id)
    def create(self, validated_data): return create_attendance(user=self.context["request"].user, **validated_data)
    def update(self, instance, validated_data): return create_attendance(user=self.context["request"].user, session=instance.session, student=instance.student, status=validated_data.get("status", instance.status), note=validated_data.get("note", instance.note))


class CurriculumUnitSerializer(serializers.ModelSerializer):
    class_count = serializers.IntegerField(source="class_assignments.count", read_only=True)
    class Meta:
        model = CurriculumUnit
        fields = ["id", "grade", "level", "unit_code", "title", "week", "topic", "objectives", "status", "created_by", "class_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "class_count", "created_at", "updated_at"]
    def validate(self, attrs):
        for field in ("grade", "level", "unit_code", "title", "objectives"):
            if field in attrs and not str(attrs[field]).strip(): raise serializers.ValidationError({field: "This field cannot be blank."})
        if "grade" in attrs and not str(attrs["grade"]).strip().isdigit(): raise serializers.ValidationError({"grade": "Grade must be numeric."})
        return attrs


class CurriculumClassAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    class Meta:
        model = CurriculumClassAssignment
        fields = ["id", "curriculum_unit", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]
    def validate(self, attrs):
        user = self.context["request"].user; school_class = attrs.get("school_class", getattr(self.instance, "school_class", None)); unit = attrs.get("curriculum_unit", getattr(self.instance, "curriculum_unit", None))
        if not school_class or not unit: raise serializers.ValidationError("Both curriculum unit and class are required.")
        if not accessible_class_queryset(user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot assign curriculum to this class.")
        if str(unit.grade).upper() != str(school_class.grade).upper(): raise serializers.ValidationError("Curriculum grade must match the class grade.")
        if self.instance and unit != self.instance.curriculum_unit: raise serializers.ValidationError("Curriculum unit cannot be changed after assignment.")
        return attrs
    def create(self, validated_data): return CurriculumClassAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)


class LearningContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningContent
        fields = ["id", "title", "description", "content_type", "grade", "level", "unit_code", "url", "file", "target_role", "status", "is_watermarked", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
    def validate(self, attrs):
        title = attrs.get("title", getattr(self.instance, "title", "")); grade = attrs.get("grade", getattr(self.instance, "grade", "")); target_role = attrs.get("target_role", getattr(self.instance, "target_role", "student")); url = attrs.get("url", getattr(self.instance, "url", "")); file_value = attrs.get("file", getattr(self.instance, "file", None)); content_type = attrs.get("content_type", getattr(self.instance, "content_type", "")); content_status = attrs.get("status", getattr(self.instance, "status", "draft"))
        if not str(title).strip(): raise serializers.ValidationError({"title": "Title is required."})
        if grade and not str(grade).strip().isdigit(): raise serializers.ValidationError({"grade": "Grade must be numeric."})
        if target_role not in {"student", "trainer", "school", "all"}: raise serializers.ValidationError({"target_role": "Unsupported target role."})
        if content_status == "published" and not url and not file_value: raise serializers.ValidationError("Published content must have a URL or file.")
        if content_type == "link" and not url: raise serializers.ValidationError({"url": "Link content requires a URL."})
        return attrs


class ContentClassAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    class Meta:
        model = ContentClassAssignment
        fields = ["id", "content", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]
    def validate(self, attrs):
        user = self.context["request"].user; school_class = attrs.get("school_class", getattr(self.instance, "school_class", None)); content = attrs.get("content", getattr(self.instance, "content", None))
        if not school_class or not content: raise serializers.ValidationError("Both content and class are required.")
        if not accessible_class_queryset(user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot assign content to this class.")
        if content.grade and str(content.grade).upper() != str(school_class.grade).upper(): raise serializers.ValidationError("Content grade must match class grade.")
        if content.status == "archived": raise serializers.ValidationError("Archived content cannot be assigned.")
        if self.instance and content != self.instance.content: raise serializers.ValidationError("Content cannot be changed after assignment.")
        return attrs
    def create(self, validated_data): return ContentClassAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)


class QuizQuestionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizQuestion
        fields = ["id", "quiz", "question_order", "question_text", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation", "points"]
        read_only_fields = ["id"]
    def validate(self, attrs):
        quiz = attrs.get("quiz", getattr(self.instance, "quiz", None))
        if quiz is None: raise serializers.ValidationError({"quiz": "Quiz is required."})
        if quiz.status == "closed": raise serializers.ValidationError("Closed quizzes cannot be edited.")
        if self.instance and quiz != self.instance.quiz: raise serializers.ValidationError("Question quiz cannot be changed after creation.")
        if int(attrs.get("points", getattr(self.instance, "points", 1))) <= 0: raise serializers.ValidationError({"points": "Points must be positive."})
        return attrs

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
    def validate(self, attrs):
        grade = attrs.get("grade", getattr(self.instance, "grade", "")); title = attrs.get("title", getattr(self.instance, "title", ""))
        if not str(grade).strip().isdigit(): raise serializers.ValidationError({"grade": "Grade must be numeric."})
        if not str(title).strip(): raise serializers.ValidationError({"title": "Title is required."})
        return attrs
    def get_questions(self, obj):
        serializer = QuizQuestionStudentSerializer if self.context["request"].user.role == UserRole.STUDENT else QuizQuestionWriteSerializer
        return serializer(obj.questions.all(), many=True, context=self.context).data

class QuizClassAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    class Meta:
        model = QuizClassAssignment
        fields = ["id", "quiz", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]
    def validate(self, attrs):
        user = self.context["request"].user; school_class = attrs.get("school_class", getattr(self.instance, "school_class", None)); quiz = attrs.get("quiz", getattr(self.instance, "quiz", None))
        if not school_class or not quiz: raise serializers.ValidationError("Both quiz and class are required.")
        if not accessible_class_queryset(user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot assign this quiz to the selected class.")
        if str(quiz.grade).upper() != str(school_class.grade).upper(): raise serializers.ValidationError("Quiz grade must match class grade.")
        if quiz.status == "closed": raise serializers.ValidationError("Closed quizzes cannot be assigned.")
        if self.instance and quiz != self.instance.quiz: raise serializers.ValidationError("Quiz cannot be changed after assignment.")
        return attrs
    def create(self, validated_data): return QuizClassAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)

class QuizAttemptReadSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True); student_id = serializers.CharField(source="student.student_id", read_only=True)
    class Meta:
        model = QuizAttempt
        fields = ["id", "quiz", "quiz_title", "student", "student_id", "attempt_number", "score", "total_marks", "percentage", "correct_count", "attempted_count", "total_questions", "time_taken_seconds", "violation_count", "status", "completed_at"]
        read_only_fields = fields

class QuizAttemptCreateSerializer(serializers.Serializer):
    quiz = serializers.PrimaryKeyRelatedField(queryset=Quiz.objects.all()); student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(), required=False); answers = serializers.JSONField(); time_taken_seconds = serializers.IntegerField(min_value=0, default=0); violation_count = serializers.IntegerField(min_value=0, default=0)
    def validate(self, attrs):
        request = self.context["request"]; student = attrs.get("student") or getattr(request.user, "student_profile", None)
        if not student: raise serializers.ValidationError({"student": "Student is required for this submission."})
        if not accessible_student_queryset(request.user).filter(pk=student.pk).exists(): raise serializers.ValidationError({"student": "You cannot submit an attempt for this student."})
        if not accessible_quizzes(request.user).filter(pk=attrs["quiz"].pk).exists(): raise serializers.ValidationError({"quiz": "You cannot attempt this quiz."})
        if request.user.role == UserRole.STUDENT and student.account_id != request.user.id: raise serializers.ValidationError({"student": "Students can only submit their own attempts."})
        attrs["student"] = student; return attrs
    def create(self, validated_data): return grade_attempt(**validated_data)

class StudentAssessmentSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True); trainer_id = serializers.CharField(source="trainer.trainer_id", read_only=True)
    class Meta:
        model = StudentAssessment
        fields = ["id", "student", "student_id", "trainer", "trainer_id", "unit_code", "level", "title", "score", "rating", "status", "feedback", "assessment_date", "created_at", "updated_at"]
        read_only_fields = ["id", "student_id", "trainer_id", "created_at", "updated_at"]
    def validate(self, attrs):
        user = self.context["request"].user; student = attrs.get("student", getattr(self.instance, "student", None)); trainer = attrs.get("trainer", getattr(self.instance, "trainer", None))
        if student and not accessible_student_queryset(user).filter(pk=student.pk).exists(): raise serializers.ValidationError("You cannot assess this student.")
        if user.role == UserRole.TRAINER:
            if trainer and trainer.account_id != user.id: raise serializers.ValidationError("A trainer can only submit their own assessments.")
            attrs["trainer"] = trainer or user.trainer_profile; trainer = attrs["trainer"]
        if trainer and student and user.role != UserRole.ADMIN and not trainer.school_assignments.filter(school_id=student.school_class.school_id, status="active").exists(): raise serializers.ValidationError("Trainer is not assigned to the student's school.")
        return attrs

class ProjectSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    class Meta:
        model = Project
        fields = ["id", "student", "student_id", "title", "description", "status", "score", "trainer_feedback", "submitted_at", "completed_at", "created_at", "updated_at", "cover_image_url"]
        read_only_fields = ["id", "student_id", "submitted_at", "completed_at", "created_at", "updated_at", "cover_image_url"]
    def get_cover_image_url(self, obj):
        for item in obj.evidence.all():
            try:
                if item.file and item.file.url:
                    name = str(item.file.name or '').lower()
                    if name.endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')):
                        return item.file.url
            except ValueError:
                pass
        return ""
    def validate(self, attrs):
        user = self.context["request"].user; student = attrs.get("student", getattr(self.instance, "student", None))
        if user.role == UserRole.STUDENT:
            if {"score", "status", "trainer_feedback"}.intersection(attrs): raise serializers.ValidationError("Students cannot change evaluation fields.")
            if self.instance and student and student.account_id != user.id: raise serializers.ValidationError("Students can only edit their own projects.")
            attrs["student"] = user.student_profile
            if self.instance and self.instance.status not in {"draft", "returned"}: raise serializers.ValidationError("Only draft or returned projects can be edited.")
        elif student and not accessible_student_queryset(user).filter(pk=student.pk).exists(): raise serializers.ValidationError("You cannot manage this student's project.")
        return attrs

class ProjectEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectEvidence
        fields = ["id", "project", "title", "note", "file", "external_url", "uploaded_by", "created_at"]
        read_only_fields = ["id", "uploaded_by", "created_at"]
