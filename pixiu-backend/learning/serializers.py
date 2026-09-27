from accounts.models import UserRole
from academics.models import Student, Trainer
from rest_framework import serializers
from .models import (AttendanceRecord, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit, LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment, QuizQuestion, Session, SessionActivity, StudentAssessment)
from .services import (
    accessible_content,
    accessible_curriculum,
    accessible_evidence,
    accessible_projects,
    accessible_quizzes,
    accessible_sessions,
    create_attendance,
    grade_attempt,
)

class SessionSerializer(serializers.ModelSerializer):
    school_id = serializers.CharField(source="school_class.school.school_code", read_only=True)
    school_code = serializers.CharField(source="school_class.school.school_code", read_only=True)
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    trainer_id = serializers.CharField(source="trainer.trainer_id", read_only=True)
    trainer_name = serializers.CharField(source="trainer.name", read_only=True)
    activities = serializers.SerializerMethodField()
    class Meta:
        model = Session
        fields = ["id", "school_class", "school_id", "school_code", "class_name", "trainer", "trainer_id", "trainer_name", "date", "start_time", "end_time", "topic", "notes", "status", "is_locked", "created_by", "created_at", "updated_at", "activities", "curriculum_unit"]
        read_only_fields = ["id", "school_id", "school_code", "class_name", "trainer_id", "trainer_name", "status", "is_locked", "created_by", "created_at", "updated_at", "activities"]
    def validate(self, attrs):
        request = self.context["request"]; instance = self.instance
        school_class = attrs.get("school_class", getattr(instance, "school_class", None)); trainer = attrs.get("trainer", getattr(instance, "trainer", None))
        if not school_class: raise serializers.ValidationError({"school_class": "Class is required."})
        if not trainer: raise serializers.ValidationError({"trainer": "Trainer is required."})
        if not __import__("academics.services", fromlist=["accessible_class_queryset"]).accessible_class_queryset(request.user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot manage a session for this class.")
        curriculum = attrs.get("curriculum_unit", getattr(self.instance, "curriculum_unit", None))
        if curriculum is not None:
            if not accessible_curriculum(request.user).filter(pk=curriculum.pk).exists():
                raise serializers.ValidationError({"curriculum_unit": "You cannot use this curriculum unit."})
            if str(curriculum.grade).strip().upper() != str(school_class.grade).strip().upper():
                raise serializers.ValidationError({"curriculum_unit": "Curriculum grade must match the selected class."})
            if not CurriculumClassAssignment.objects.filter(curriculum_unit=curriculum, school_class=school_class).exists():
                raise serializers.ValidationError({"curriculum_unit": "This curriculum unit is not assigned to the selected class."})
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
        request = self.context["request"]
        title = attrs.get("title", getattr(self.instance, "title", ""))
        session = self.instance.session if self.instance else attrs.get("session")
        if not str(title).strip(): raise serializers.ValidationError({"title": "Activity title is required."})
        if not session: raise serializers.ValidationError({"session": "Session is required."})
        if not accessible_sessions(request.user).filter(pk=session.pk).exists():
            raise serializers.ValidationError({"session": "You cannot manage activities for this session."})
        if self.instance and session != self.instance.session:
            raise serializers.ValidationError({"session": "Session cannot be changed after activity creation."})
        return attrs

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True); student_name = serializers.CharField(source="student.name", read_only=True); roll_number = serializers.IntegerField(source="student.roll_number", read_only=True); class_id = serializers.SerializerMethodField(); class_name = serializers.CharField(source="session.school_class.display_name", read_only=True); school_code = serializers.CharField(source="session.school_class.school.school_code", read_only=True); trainer_id = serializers.CharField(source="session.trainer.trainer_id", read_only=True); session_topic = serializers.CharField(source="session.topic", read_only=True); date = serializers.DateField(source="session.date", read_only=True); time = serializers.TimeField(source="session.start_time", read_only=True); marked_by_username = serializers.CharField(source="marked_by.username", read_only=True)
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
        fields = ["id", "grade", "unit_code", "title", "week", "topic", "objectives", "status", "created_by", "class_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "class_count", "created_at", "updated_at"]
    def validate(self, attrs):
        for field in ("grade", "unit_code", "title", "objectives"):
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
        from academics.services import accessible_class_queryset
        user = self.context["request"].user; school_class = attrs.get("school_class", getattr(self.instance, "school_class", None)); unit = attrs.get("curriculum_unit", getattr(self.instance, "curriculum_unit", None))
        if not school_class or not unit: raise serializers.ValidationError("Both curriculum unit and class are required.")
        if not accessible_class_queryset(user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot assign curriculum to this class.")
        if not __import__("learning.services", fromlist=["accessible_curriculum"]).accessible_curriculum(user).filter(pk=unit.pk).exists():
            raise serializers.ValidationError({"curriculum_unit": "You cannot assign this curriculum unit."})
        if str(unit.grade).upper() != str(school_class.grade).upper(): raise serializers.ValidationError("Curriculum grade must match the class grade.")
        if self.instance and unit != self.instance.curriculum_unit: raise serializers.ValidationError("Curriculum unit cannot be changed after assignment.")
        return attrs
    def create(self, validated_data): return CurriculumClassAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)

class LearningContentFileField(serializers.FileField):
    """Accept uploads but serialize only a boolean presence marker."""
    def to_representation(self, value):
        return bool(value)


class LearningContentSerializer(serializers.ModelSerializer):
    file = LearningContentFileField(required=False, allow_null=True)
    file_available = serializers.SerializerMethodField()
    video_processing_status = serializers.CharField(read_only=True)
    video_processing_error = serializers.SerializerMethodField()
    video_duration_seconds = serializers.IntegerField(read_only=True)
    video_size_bytes = serializers.IntegerField(read_only=True)
    video_width = serializers.IntegerField(read_only=True)
    video_height = serializers.IntegerField(read_only=True)

    class Meta:
        model = LearningContent
        fields = [
            "id", "title", "description", "content_type", "grade", "unit_code", "url",
            "file", "file_available", "target_role", "status", "is_watermarked",
            "video_processing_status", "video_processing_error", "video_duration_seconds",
            "video_size_bytes", "video_width", "video_height",
            "created_by", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "file_available", "created_by", "created_at", "updated_at",
            "video_processing_status", "video_processing_error", "video_duration_seconds",
            "video_size_bytes", "video_width", "video_height",
        ]

    def get_file_available(self, obj):
        return bool(obj.file) and (
            obj.content_type != "video" or obj.video_processing_status == LearningContent.VIDEO_PROCESSING_READY
        )

    def get_video_processing_error(self, obj):
        role = getattr(self.context.get("request"), "user", None)
        if getattr(role, "role", None) in {UserRole.ADMIN, UserRole.TRAINER}:
            return str(obj.video_processing_error or "")
        return "" if obj.video_processing_status != LearningContent.VIDEO_PROCESSING_FAILED else "Video processing failed. Please contact your trainer."

    def validate(self, attrs):
        title = attrs.get("title", getattr(self.instance, "title", "")); grade = attrs.get("grade", getattr(self.instance, "grade", "")); target_role = attrs.get("target_role", getattr(self.instance, "target_role", "student")); url = attrs.get("url", getattr(self.instance, "url", "")); file_value = attrs.get("file", getattr(self.instance, "file", None)); content_type = attrs.get("content_type", getattr(self.instance, "content_type", "")); content_status = attrs.get("status", getattr(self.instance, "status", "draft"))
        if not str(title).strip(): raise serializers.ValidationError({"title": "Title is required."})
        if grade and not str(grade).strip().isdigit(): raise serializers.ValidationError({"grade": "Grade must be numeric."})
        if target_role not in {"student", "trainer", "school", "student_trainer", "all"}: raise serializers.ValidationError({"target_role": "Unsupported target role."})
        if content_status == "published" and not url and not file_value: raise serializers.ValidationError("Published content must have a URL or file.")
        if content_type == "video":
            if not file_value:
                raise serializers.ValidationError({"file": "Video content must use an uploaded MP4 or WebM file."})
            filename = str(getattr(file_value, "name", "")).lower()
            content_mime = str(getattr(file_value, "content_type", "")).lower()
            if not (filename.endswith(".mp4") or filename.endswith(".webm")):
                raise serializers.ValidationError({"file": "Only MP4 and WebM videos are supported."})
            if content_mime and content_mime not in {"video/mp4", "video/webm"}:
                raise serializers.ValidationError({"file": "Video MIME type must be video/mp4 or video/webm."})
        if content_type == "link" and not url: raise serializers.ValidationError({"url": "Link content requires a URL."})
        return attrs

class ContentClassAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    class Meta:
        model = ContentClassAssignment
        fields = ["id", "content", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]
    def validate(self, attrs):
        from academics.services import accessible_class_queryset
        user = self.context["request"].user; school_class = attrs.get("school_class", getattr(self.instance, "school_class", None)); content = attrs.get("content", getattr(self.instance, "content", None))
        if not school_class or not content: raise serializers.ValidationError("Both content and class are required.")
        if not accessible_class_queryset(user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot assign content to this class.")
        if not accessible_content(user).filter(pk=content.pk).exists():
            raise serializers.ValidationError({"content": "You cannot assign this learning content."})
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
        request = self.context["request"]
        quiz = attrs.get("quiz", getattr(self.instance, "quiz", None))
        if quiz is None: raise serializers.ValidationError({"quiz": "Quiz is required."})
        if quiz.status == "closed": raise serializers.ValidationError("Closed quizzes cannot be edited.")
        if not accessible_quizzes(request.user).filter(pk=quiz.pk).exists():
            raise serializers.ValidationError({"quiz": "You cannot manage questions for this quiz."})
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
        fields = ["id", "title", "grade", "unit_code", "duration_minutes", "duration_seconds", "max_attempts", "status", "created_by", "questions", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "questions", "created_at", "updated_at", "max_attempts"]
    def validate(self, attrs):
        grade = attrs.get("grade", getattr(self.instance, "grade", "")); title = attrs.get("title", getattr(self.instance, "title", "")); duration_seconds = attrs.get("duration_seconds", getattr(self.instance, "duration_seconds", None))
        if not str(grade).strip().isdigit(): raise serializers.ValidationError({"grade": "Grade must be numeric."})
        if not str(title).strip(): raise serializers.ValidationError({"title": "Title is required."})
        if duration_seconds is None: duration_seconds = max(60, int(attrs.get("duration_minutes", getattr(self.instance, "duration_minutes", 1)) or 1) * 60)
        if not 10 <= int(duration_seconds) <= 14400: raise serializers.ValidationError({"duration_seconds": "Timer must be between 10 seconds and 4 hours."})
        attrs["duration_seconds"] = int(duration_seconds); attrs["max_attempts"] = 1; return attrs
    def create(self, validated_data): validated_data["max_attempts"] = 1; return super().create(validated_data)
    def update(self, instance, validated_data): validated_data["max_attempts"] = 1; return super().update(instance, validated_data)
    def get_questions(self, obj):
        serializer = QuizQuestionStudentSerializer if self.context["request"].user.role == UserRole.STUDENT else QuizQuestionWriteSerializer
        return serializer(obj.questions.all(), many=True, context=self.context).data

class QuizClassAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizClassAssignment
        fields = ["id", "quiz", "school_class", "class_name", "assigned_by", "assigned_at"]
        read_only_fields = ["id", "class_name", "assigned_by", "assigned_at"]
    def validate(self, attrs):
        from academics.services import accessible_class_queryset
        user = self.context["request"].user; school_class = attrs.get("school_class", getattr(self.instance, "school_class", None)); quiz = attrs.get("quiz", getattr(self.instance, "quiz", None))
        if not school_class or not quiz: raise serializers.ValidationError("Both quiz and class are required.")
        if not accessible_class_queryset(user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot assign this quiz to the selected class.")
        if not accessible_quizzes(user).filter(pk=quiz.pk).exists():
            raise serializers.ValidationError({"quiz": "You cannot assign this quiz."})
        if str(quiz.grade).upper() != str(school_class.grade).upper(): raise serializers.ValidationError("Quiz grade must match class grade.")
        if quiz.status == "closed": raise serializers.ValidationError("Closed quizzes cannot be assigned.")
        if self.instance and quiz != self.instance.quiz: raise serializers.ValidationError("Quiz cannot be changed after assignment.")
        return attrs
    def create(self, validated_data): return QuizClassAssignment.objects.create(assigned_by=validated_data.pop("assigned_by", self.context["request"].user), **validated_data)

class QuizAttemptReadSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True); student_id = serializers.CharField(source="student.student_id", read_only=True)
    class Meta:
        model = QuizAttempt
        fields = ["id", "quiz", "quiz_title", "student", "student_id", "attempt_number", "score", "total_marks", "percentage", "correct_count", "attempted_count", "total_questions", "time_taken_seconds", "violation_count", "status", "completed_at"]
        read_only_fields = fields

class QuizAttemptCreateSerializer(serializers.Serializer):
    quiz = serializers.PrimaryKeyRelatedField(queryset=Quiz.objects.all()); student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(), required=False); answers = serializers.JSONField(); time_taken_seconds = serializers.IntegerField(min_value=0, default=0); violation_count = serializers.IntegerField(min_value=0, default=0)
    def validate(self, attrs):
        from academics.services import accessible_student_queryset
        request = self.context["request"]; student = attrs.get("student") or getattr(request.user, "student_profile", None)
        if not student: raise serializers.ValidationError({"student": "Student is required for this submission."})
        if not accessible_student_queryset(request.user).filter(pk=student.pk).exists(): raise serializers.ValidationError({"student": "You cannot submit an attempt for this student."})
        if not accessible_quizzes(self.context["request"].user).filter(pk=attrs["quiz"].pk).exists(): raise serializers.ValidationError({"quiz": "You cannot attempt this quiz."})
        if request.user.role == UserRole.STUDENT and student.account_id != request.user.id: raise serializers.ValidationError({"student": "Students can only submit their own attempts."})
        attrs["student"] = student; return attrs
    def create(self, validated_data): return grade_attempt(**validated_data)

class StudentAssessmentSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True); trainer_id = serializers.CharField(source="trainer.trainer_id", read_only=True)
    class Meta:
        model = StudentAssessment
        fields = ["id", "student", "student_id", "trainer", "trainer_id", "unit_code", "title", "score", "rating", "status", "feedback", "assessment_date", "created_at", "updated_at"]
        read_only_fields = ["id", "student_id", "trainer_id", "created_at", "updated_at"]
    def to_internal_value(self, data):
        payload = data.copy(); raw_student = payload.get("student")
        if raw_student not in (None, ""):
            student = Student.objects.filter(pk=raw_student).first() or Student.objects.filter(student_id=str(raw_student).strip().upper()).first()
            if student is not None: payload["student"] = student.pk
        raw_trainer = payload.get("trainer")
        if raw_trainer not in (None, ""):
            trainer = Trainer.objects.filter(pk=raw_trainer).first() or Trainer.objects.filter(trainer_id=str(raw_trainer).strip().upper()).first()
            if trainer is not None: payload["trainer"] = trainer.pk
        return super().to_internal_value(payload)
    def validate(self, attrs):
        from academics.services import accessible_student_queryset
        user = self.context["request"].user; student = attrs.get("student", getattr(self.instance, "student", None)); trainer = attrs.get("trainer", getattr(self.instance, "trainer", None))
        if not student: raise serializers.ValidationError({"student": "Select a student for this review."})
        if not student.school_class_id: raise serializers.ValidationError({"student": "Student is not assigned to a class."})
        if not accessible_student_queryset(user).filter(pk=student.pk).exists(): raise serializers.ValidationError({"student": "You cannot assess this student."})
        if user.role == UserRole.TRAINER:
            own_trainer = getattr(user, "trainer_profile", None)
            if own_trainer is None: raise serializers.ValidationError({"trainer": "This trainer account is not linked to a trainer profile."})
            if trainer and trainer.account_id != user.id: raise serializers.ValidationError({"trainer": "A trainer can only submit their own assessments."})
            attrs["trainer"] = own_trainer; trainer = own_trainer
        if trainer is None: raise serializers.ValidationError({"trainer": "Trainer is required for this review."})
        if user.role != UserRole.ADMIN and not trainer.school_assignments.filter(school_id=student.school_class.school_id, status="active").exists(): raise serializers.ValidationError({"trainer": "Trainer is not assigned to the student's school."})
        if not str(attrs.get("title", getattr(self.instance, "title", ""))).strip(): raise serializers.ValidationError({"title": "Review title is required."})
        return attrs

class ProjectEvidenceSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = ProjectEvidence
        fields = ["id", "project", "title", "note", "file", "external_url", "uploaded_by", "uploaded_by_username", "created_at"]
        read_only_fields = ["id", "uploaded_by", "uploaded_by_username", "created_at"]

    def validate(self, attrs):
        from .services import accessible_projects
        request = self.context["request"]
        file_value = attrs.get("file", getattr(self.instance, "file", None))
        external_url = attrs.get("external_url", getattr(self.instance, "external_url", ""))
        project = attrs.get("project", getattr(self.instance, "project", None))
        if project is None:
            raise serializers.ValidationError({"project": "Project is required."})
        if not accessible_projects(request.user).filter(pk=project.pk).exists():
            raise serializers.ValidationError({"project": "You cannot add evidence to this project."})
        if self.instance and project != self.instance.project:
            raise serializers.ValidationError({"project": "Evidence cannot be moved between projects."})
        if not file_value and not str(external_url or "").strip():
            raise serializers.ValidationError("Evidence must include a file or an external URL.")
        return attrs

class ProjectSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.student_id", read_only=True)
    student_name = serializers.CharField(source="student.name", read_only=True)
    evidence = ProjectEvidenceSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "student", "student_id", "student_name", "title", "description", "status",
            "score", "trainer_feedback", "submitted_at", "completed_at", "created_at", "updated_at", "evidence",
        ]
        read_only_fields = ["id", "student_id", "student_name", "submitted_at", "completed_at", "created_at", "updated_at", "evidence"]

    def validate(self, attrs):
        from academics.services import accessible_student_queryset
        request = self.context["request"]
        student = attrs.get("student", getattr(self.instance, "student", None))
        if student is None:
            raise serializers.ValidationError({"student": "Student is required."})
        if not accessible_student_queryset(request.user).filter(pk=student.pk).exists():
            raise serializers.ValidationError({"student": "You cannot manage a project for this student."})
        title = attrs.get("title", getattr(self.instance, "title", ""))
        if not str(title).strip():
            raise serializers.ValidationError({"title": "Project title is required."})
        return attrs
