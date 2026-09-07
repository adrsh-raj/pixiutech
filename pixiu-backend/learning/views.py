from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from academics.services import accessible_class_queryset

from .models import (
    AttendanceRecord, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit,
    LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment,
    QuizQuestion, Session, StudentAssessment,
)
from .permissions import LearningScopePermission
from .serializers import (
    AttendanceRecordSerializer, ContentClassAssignmentSerializer, CurriculumClassAssignmentSerializer,
    CurriculumUnitSerializer, LearningContentSerializer, ProjectEvidenceSerializer, ProjectSerializer,
    QuizAttemptCreateSerializer, QuizAttemptReadSerializer, QuizClassAssignmentSerializer,
    QuizQuestionStudentSerializer, QuizQuestionWriteSerializer, QuizSerializer, SessionSerializer,
    StudentAssessmentSerializer,
)
from .services import (
    accessible_assessments, accessible_attempts, accessible_attendance, accessible_content,
    accessible_curriculum, accessible_evidence, accessible_projects, accessible_quizzes, accessible_sessions,
)


class LearningViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission, LearningScopePermission]
    ACTIONS = {"list": "VIEW", "retrieve": "VIEW", "create": "CREATE", "update": "EDIT", "partial_update": "EDIT", "destroy": "DELETE"}

    def initial(self, request, *args, **kwargs):
        self.required_action = self.ACTIONS.get(self.action, "VIEW")
        super().initial(request, *args, **kwargs)

    def get_object(self):
        queryset = self.queryset if self.action in {"retrieve", "update", "partial_update", "destroy"} else self.scoped_queryset()
        queryset = self.filter_queryset(queryset)
        obj = queryset.get(**{self.lookup_field: self.kwargs[self.lookup_url_kwarg or self.lookup_field]})
        self.check_object_permissions(self.request, obj)
        return obj

    def role_only(self, *roles):
        if self.request.user.role not in roles:
            raise PermissionDenied("Your role cannot perform this operation.")


class SessionViewSet(LearningViewSet):
    queryset = Session.objects.select_related("school_class__school", "trainer", "created_by")
    serializer_class = SessionSerializer

    def scoped_queryset(self): return accessible_sessions(self.request.user)

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        serializer.save()

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        serializer.save()

    def perform_destroy(self, instance):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        if instance.is_locked or instance.status == "completed":
            raise ValidationError("Completed or locked sessions cannot be deleted.")
        instance.status = "cancelled"
        instance.save(update_fields=["status", "updated_at"])

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        self.required_action = "EDIT"
        session = self.get_object()
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        if session.status != "planned":
            raise ValidationError("Only planned sessions can be completed.")
        session.status = "completed"
        session.is_locked = True
        session.save(update_fields=["status", "is_locked", "updated_at"])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        self.required_action = "EDIT"
        session = self.get_object()
        self.role_only(UserRole.ADMIN)
        if not session.is_locked:
            raise ValidationError("Session is already unlocked.")
        session.is_locked = False
        session.save(update_fields=["is_locked", "updated_at"])
        return Response(self.get_serializer(session).data)


class AttendanceViewSet(LearningViewSet):
    queryset = AttendanceRecord.objects.select_related("session", "student", "marked_by")
    serializer_class = AttendanceRecordSerializer

    def scoped_queryset(self): return accessible_attendance(self.request.user)

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        serializer.save()

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        serializer.save()

    def perform_destroy(self, instance):
        self.role_only(UserRole.ADMIN)
        instance.delete()


class CurriculumUnitViewSet(LearningViewSet):
    queryset = CurriculumUnit.objects.select_related("created_by")
    serializer_class = CurriculumUnitSerializer

    def scoped_queryset(self): return accessible_curriculum(self.request.user)
    def perform_create(self, serializer): self.role_only(UserRole.ADMIN); serializer.save(created_by=self.request.user)
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.status = "archived"; instance.save(update_fields=["status", "updated_at"])


class CurriculumAssignmentViewSet(LearningViewSet):
    queryset = CurriculumClassAssignment.objects.select_related("curriculum_unit", "school_class", "assigned_by")
    serializer_class = CurriculumClassAssignmentSerializer

    def scoped_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user.role == UserRole.ADMIN: return qs
        return qs.filter(school_class__id__in=accessible_class_queryset(user).values("id"))

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.delete()


class ContentViewSet(LearningViewSet):
    queryset = LearningContent.objects.select_related("created_by")
    serializer_class = LearningContentSerializer

    def scoped_queryset(self): return accessible_content(self.request.user)
    def perform_create(self, serializer): self.role_only(UserRole.ADMIN); serializer.save(created_by=self.request.user)
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.status = "archived"; instance.save(update_fields=["status", "updated_at"])


class ContentAssignmentViewSet(LearningViewSet):
    queryset = ContentClassAssignment.objects.select_related("content", "school_class", "assigned_by")
    serializer_class = ContentClassAssignmentSerializer

    def scoped_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user.role == UserRole.ADMIN: return qs
        return qs.filter(school_class__id__in=accessible_class_queryset(user).values("id"))

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.delete()


class QuizViewSet(LearningViewSet):
    queryset = Quiz.objects.select_related("created_by").prefetch_related("questions")
    serializer_class = QuizSerializer

    def scoped_queryset(self): return accessible_quizzes(self.request.user)
    def perform_create(self, serializer): self.role_only(UserRole.ADMIN, UserRole.TRAINER); serializer.save(created_by=self.request.user)
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN, UserRole.TRAINER); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.status = "closed"; instance.save(update_fields=["status", "updated_at"])

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        self.required_action = "CREATE"
        quiz = self.get_object()
        serializer = QuizAttemptCreateSerializer(data={**request.data, "quiz": quiz.pk}, context={"request": request})
        serializer.is_valid(raise_exception=True)
        attempt = serializer.save()
        return Response(QuizAttemptReadSerializer(attempt, context={"request": request}).data, status=status.HTTP_201_CREATED)


class QuizQuestionViewSet(LearningViewSet):
    queryset = QuizQuestion.objects.select_related("quiz")

    def scoped_queryset(self):
        return self.queryset.filter(quiz__in=accessible_quizzes(self.request.user))

    def get_serializer_class(self):
        return QuizQuestionStudentSerializer if self.request.user.role == UserRole.STUDENT else QuizQuestionWriteSerializer

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN, UserRole.TRAINER); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN, UserRole.TRAINER); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN, UserRole.TRAINER); instance.delete()


class QuizAssignmentViewSet(LearningViewSet):
    queryset = QuizClassAssignment.objects.select_related("quiz", "school_class", "assigned_by")
    serializer_class = QuizClassAssignmentSerializer

    def scoped_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user.role == UserRole.ADMIN: return qs
        return qs.filter(school_class__id__in=accessible_class_queryset(user).values("id"))

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.delete()


class QuizAttemptViewSet(LearningViewSet):
    queryset = QuizAttempt.objects.select_related("quiz", "student")
    serializer_class = QuizAttemptReadSerializer

    def scoped_queryset(self): return accessible_attempts(self.request.user)

    def create(self, request, *args, **kwargs):
        self.required_action = "CREATE"
        serializer = QuizAttemptCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        attempt = serializer.save()
        return Response(QuizAttemptReadSerializer(attempt, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        self.role_only(UserRole.ADMIN)
        instance.status = "invalidated"
        instance.save(update_fields=["status"])


class AssessmentViewSet(LearningViewSet):
    queryset = StudentAssessment.objects.select_related("student", "trainer")
    serializer_class = StudentAssessmentSerializer

    def scoped_queryset(self): return accessible_assessments(self.request.user)

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.TRAINER)
        if self.request.user.role == UserRole.TRAINER:
            serializer.validated_data["trainer"] = self.request.user.trainer_profile
        serializer.save()

    def perform_update(self, serializer): self.role_only(UserRole.ADMIN, UserRole.TRAINER); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.status = "draft"; instance.save(update_fields=["status", "updated_at"])


class ProjectViewSet(LearningViewSet):
    queryset = Project.objects.select_related("student__school_class__school").prefetch_related("evidence")
    serializer_class = ProjectSerializer

    def scoped_queryset(self): return accessible_projects(self.request.user)

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER, UserRole.STUDENT)
        if self.request.user.role == UserRole.STUDENT:
            serializer.validated_data["student"] = self.request.user.student_profile
        serializer.save()

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER, UserRole.STUDENT)
        serializer.save()

    def perform_destroy(self, instance):
        self.role_only(UserRole.ADMIN, UserRole.STUDENT)
        instance.delete()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        self.required_action = "EDIT"
        project = self.get_object()
        self.role_only(UserRole.STUDENT)
        if project.student.account_id != request.user.id:
            raise PermissionDenied("Students can only submit their own project.")
        if project.status not in {"draft", "returned"}:
            raise ValidationError("Only draft or returned projects can be submitted.")
        project.status = "submitted"
        project.submitted_at = transaction.get_connection().ops.adapt_datetimefield_value if False else None
        from django.utils import timezone
        project.submitted_at = timezone.now()
        project.save(update_fields=["status", "submitted_at", "updated_at"])
        return Response(self.get_serializer(project).data)


class ProjectEvidenceViewSet(LearningViewSet):
    queryset = ProjectEvidence.objects.select_related("project__student", "uploaded_by")
    serializer_class = ProjectEvidenceSerializer

    def scoped_queryset(self): return accessible_evidence(self.request.user)

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN, UserRole.STUDENT); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN, UserRole.STUDENT); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN, UserRole.STUDENT); instance.delete()
