import json

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount

from .models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from .permissions import ScopePermission
from .serializers import (
    SchoolClassSerializer,
    SchoolSerializer,
    StudentCreateSerializer,
    StudentReadSerializer,
    StudentUpdateSerializer,
    TrainerSchoolAssignmentSerializer,
    TrainerSerializer,
)
from .services import (
    accessible_assignment_queryset,
    accessible_class_queryset,
    accessible_school_queryset,
    accessible_student_queryset,
    accessible_trainer_queryset,
    create_school_account,
    create_trainer_account,
    next_trainer_id,
)


class Phase3ViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission, ScopePermission]

    ACTION_TO_BUSINESS = {
        "list": "VIEW",
        "retrieve": "VIEW",
        "create": "CREATE",
        "update": "EDIT",
        "partial_update": "EDIT",
        "destroy": "DELETE",
    }

    def initial(self, request, *args, **kwargs):
        self.required_action = self.ACTION_TO_BUSINESS.get(self.action, "VIEW")
        super().initial(request, *args, **kwargs)

    def get_queryset(self):
        return self.scoped_queryset() if self.action == "list" else self.queryset

    def scoped_queryset(self):
        return self.queryset

    def get_object(self):
        queryset = self.queryset if self.action in {"retrieve", "update", "partial_update", "destroy"} else self.scoped_queryset()
        queryset = self.filter_queryset(queryset)
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj = queryset.get(**{self.lookup_field: self.kwargs[lookup_url_kwarg]})
        self.check_object_permissions(self.request, obj)
        return obj

    def assert_role(self, *roles):
        if self.request.user.role not in roles:
            raise PermissionDenied("Your role cannot perform this operation.")


class SchoolViewSet(Phase3ViewSet):
    queryset = School.objects.select_related("account")
    serializer_class = SchoolSerializer

    def scoped_queryset(self):
        return accessible_school_queryset(self.request.user)

    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN)
        with transaction.atomic():
            school = serializer.save()
            create_school_account(school=school)

    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL)
        serializer.save()

    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN)
        raise ValidationError("Schools are deactivated instead of hard-deleted.")

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        self.required_action = "EDIT"
        school = self.get_object()
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only administrators can deactivate a school.")
        school.status = "inactive"
        if school.account_id:
            school.account.status = "inactive"
            school.account.is_active = False
            school.account.save(update_fields=["status", "is_active"])
        school.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(school).data)


class TrainerViewSet(Phase3ViewSet):
    queryset = Trainer.objects.select_related("account")
    serializer_class = TrainerSerializer

    def scoped_queryset(self):
        return accessible_trainer_queryset(self.request.user)

    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN)
        try:
            original = json.loads((self.request.body or b"{}").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            original = {}

        password = str(original.get("password") or "").strip()
        if not password:
            raise ValidationError({"password": "Trainer password is required."})

        requested_trainer_id = str(original.get("trainer_id") or "").strip().upper()
        trainer_id = requested_trainer_id or next_trainer_id()
        assigned_schools = original.get("assigned_schools") or []
        if isinstance(assigned_schools, str):
            assigned_schools = [item.strip() for item in assigned_schools.split(",") if item.strip()]
        elif not isinstance(assigned_schools, list):
            assigned_schools = []

        with transaction.atomic():
            trainer = serializer.save(trainer_id=trainer_id)
            create_trainer_account(trainer=trainer, password=password)

            for school_value in assigned_schools:
                raw = str(school_value or "").strip()
                if not raw:
                    continue
                try:
                    school = School.objects.filter(pk=raw).first()
                except (ValueError, TypeError):
                    school = None
                school = school or School.objects.filter(school_code=raw.upper()).first()
                if school is None:
                    raise ValidationError({"assigned_schools": f"School '{raw}' was not found."})
                TrainerSchoolAssignment.objects.update_or_create(
                    trainer=trainer,
                    school=school,
                    assigned_from=timezone.localdate(),
                    defaults={"status": "active", "assigned_to": None},
                )

    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.TRAINER)
        serializer.save()

    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN)
        raise ValidationError("Trainers are deactivated instead of hard-deleted.")


class TrainerSchoolAssignmentViewSet(Phase3ViewSet):
    queryset = TrainerSchoolAssignment.objects.select_related("trainer", "school")
    serializer_class = TrainerSchoolAssignmentSerializer

    def scoped_queryset(self):
        return accessible_assignment_queryset(self.request.user)

    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN)
        serializer.save()

    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN)
        serializer.save()

    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN)
        instance.status = "inactive"
        instance.save(update_fields=["status"])


class SchoolClassViewSet(Phase3ViewSet):
    queryset = SchoolClass.objects.select_related("school")
    serializer_class = SchoolClassSerializer

    def scoped_queryset(self):
        return accessible_class_queryset(self.request.user)

    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL)
        serializer.save()

    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL)
        serializer.save()

    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL)
        instance.status = "inactive"
        instance.save(update_fields=["status", "updated_at"])


class StudentViewSet(Phase3ViewSet):
    queryset = Student.objects.select_related("school_class__school", "account")

    def get_serializer_class(self):
        if self.action == "create":
            return StudentCreateSerializer
        if self.action in {"update", "partial_update"}:
            return StudentUpdateSerializer
        return StudentReadSerializer

    def scoped_queryset(self):
        return accessible_student_queryset(self.request.user)

    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        student = serializer.instance
        payload = StudentReadSerializer(student, context={"request": request}).data
        payload["initial_password"] = serializer.generated_password
        headers = self.get_success_headers(payload)
        return Response(payload, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        serializer.save()

    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN)
        raise ValidationError("Students are deactivated instead of hard-deleted.")

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        self.required_action = "EDIT"
        student = self.get_object()
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        student.status = "inactive"
        if student.account_id:
            student.account.status = "inactive"
            student.account.is_active = False
            student.account.save(update_fields=["status", "is_active"])
        student.save(update_fields=["status", "updated_at"])
        return Response(StudentReadSerializer(student, context={"request": request}).data)
