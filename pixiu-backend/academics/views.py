import json

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole, UserStatus
from accounts.permissions import HasActionPermission, IsActiveAccount
from audit.services import record_audit
from .models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from .permissions import ScopePermission
from .serializers import SchoolClassSerializer, SchoolSerializer, StudentCreateSerializer, StudentReadSerializer, StudentUpdateSerializer, TrainerSchoolAssignmentSerializer, TrainerSerializer
from .services import accessible_assignment_queryset, accessible_class_queryset, accessible_school_queryset, accessible_student_queryset, accessible_trainer_queryset, create_school_account, create_trainer_account, next_trainer_id


class Phase3ViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission, ScopePermission]
    ACTION_TO_BUSINESS = {"list": "VIEW", "retrieve": "VIEW", "create": "CREATE", "update": "EDIT", "partial_update": "EDIT", "destroy": "DELETE"}
    def initial(self, request, *args, **kwargs): self.required_action = self.ACTION_TO_BUSINESS.get(self.action, "VIEW"); super().initial(request, *args, **kwargs)
    def get_queryset(self): return self.scoped_queryset() if self.action == "list" else self.queryset
    def scoped_queryset(self): return self.queryset
    def get_object(self):
        queryset = self.queryset if self.action in {"retrieve", "update", "partial_update", "destroy"} else self.scoped_queryset(); queryset = self.filter_queryset(queryset)
        obj = queryset.get(**{self.lookup_field: self.kwargs[self.lookup_url_kwarg or self.lookup_field]}); self.check_object_permissions(self.request, obj); return obj
    def assert_role(self, *roles):
        if self.request.user.role not in roles: raise PermissionDenied("Your role cannot perform this operation.")


class SchoolViewSet(Phase3ViewSet):
    queryset = School.objects.select_related("account"); serializer_class = SchoolSerializer
    def scoped_queryset(self): return accessible_school_queryset(self.request.user)
    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN)
        with transaction.atomic():
            school = serializer.save(); create_school_account(school=school)
            record_audit(actor=self.request.user, action="create", entity_type="school", entity_id=school.id, summary=f"School {school.school_code} created", request=self.request)
    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL); school = serializer.save(); record_audit(actor=self.request.user, action="update", entity_type="school", entity_id=school.id, summary=f"School {school.school_code} updated", request=self.request)
    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN)
        instance.status = "inactive"
        if instance.account_id:
            instance.account.status = UserStatus.INACTIVE
            instance.account.is_active = False
            instance.account.save(update_fields=["status", "is_active"])
        instance.save(update_fields=["status", "updated_at"])
        record_audit(actor=self.request.user, action="update", entity_type="school", entity_id=instance.id, summary=f"School {instance.school_code} deactivated", request=self.request)
    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        self.required_action = "EDIT"; school = self.get_object();
        if request.user.role != UserRole.ADMIN: raise PermissionDenied("Only administrators can deactivate a school.")
        school.status = "inactive"
        if school.account_id:
            school.account.status = UserStatus.INACTIVE; school.account.is_active = False; school.account.save(update_fields=["status", "is_active"])
        school.save(update_fields=["status", "updated_at"]); record_audit(actor=request.user, action="update", entity_type="school", entity_id=school.id, summary=f"School {school.school_code} deactivated", request=request)
        return Response(self.get_serializer(school).data)


class TrainerViewSet(Phase3ViewSet):
    queryset = Trainer.objects.select_related("account"); serializer_class = TrainerSerializer
    def scoped_queryset(self): return accessible_trainer_queryset(self.request.user)
    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN)
        try: original = json.loads((self.request.body or b"").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError): original = {}
        password = str(original.get("password") or "").strip()
        if not password: raise ValidationError({"password": "Trainer password is required."})
        trainer_id = str(original.get("trainer_id") or "").strip().upper() or next_trainer_id(); assigned_schools = original.get("assigned_schools") or []
        if isinstance(assigned_schools, str): assigned_schools = [item.strip() for item in assigned_schools.split(",") if item.strip()]
        elif not isinstance(assigned_schools, list): assigned_schools = []
        with transaction.atomic():
            trainer = serializer.save(trainer_id=trainer_id); create_trainer_account(trainer=trainer, password=password)
            for school_value in assigned_schools:
                raw = str(school_value or "").strip()
                if not raw: continue
                try: school = School.objects.filter(pk=raw).first()
                except (ValueError, TypeError): school = None
                school = school or School.objects.filter(school_code=raw.upper()).first()
                if school is None: raise ValidationError({"assigned_schools": f"School '{raw}' was not found."})
                TrainerSchoolAssignment.objects.update_or_create(trainer=trainer, school=school, assigned_from=timezone.localdate(), defaults={"status": "active", "assigned_to": None})
            record_audit(actor=self.request.user, action="create", entity_type="trainer", entity_id=trainer.id, summary=f"Trainer {trainer.trainer_id} created", request=self.request)
    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.TRAINER); trainer = serializer.save(); record_audit(actor=self.request.user, action="update", entity_type="trainer", entity_id=trainer.id, summary=f"Trainer {trainer.trainer_id} updated", request=self.request)
    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN)
        instance.status = "inactive"
        if instance.account_id:
            instance.account.status = UserStatus.INACTIVE
            instance.account.is_active = False
            instance.account.save(update_fields=["status", "is_active"])
        instance.save(update_fields=["status", "updated_at"])
        record_audit(actor=self.request.user, action="update", entity_type="trainer", entity_id=instance.id, summary=f"Trainer {instance.trainer_id} deactivated", request=self.request)
    @action(detail=True, methods=["put"], url_path="status")
    def status_action(self, request, pk=None):
        self.required_action = "EDIT"
        trainer = self.get_object()
        self.assert_role(UserRole.ADMIN)
        next_status = str(request.data.get("status") or "").strip().lower()
        if next_status not in {"active", "inactive"}:
            raise ValidationError({"status": "Status must be active or inactive."})
        trainer.status = next_status
        if trainer.account_id:
            trainer.account.status = UserStatus.ACTIVE if next_status == "active" else UserStatus.INACTIVE
            trainer.account.is_active = next_status == "active"
            trainer.account.save(update_fields=["status", "is_active"])
        trainer.save(update_fields=["status", "updated_at"])
        record_audit(actor=request.user, action="update", entity_type="trainer", entity_id=trainer.id, summary=f"Trainer {trainer.trainer_id} status changed to {next_status}", changes={"status": next_status}, request=request)
        return Response(self.get_serializer(trainer).data)


class TrainerSchoolAssignmentViewSet(Phase3ViewSet):
    queryset = TrainerSchoolAssignment.objects.select_related("trainer", "school"); serializer_class = TrainerSchoolAssignmentSerializer
    def scoped_queryset(self): return accessible_assignment_queryset(self.request.user)
    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN); assignment = serializer.save(); record_audit(actor=self.request.user, action="assignment_change", entity_type="trainer_school_assignment", entity_id=assignment.id, summary=f"Trainer {assignment.trainer.trainer_id} assigned to {assignment.school.school_code}", changes={"trainer": assignment.trainer.trainer_id, "school": assignment.school.school_code, "status": assignment.status}, request=self.request)
    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN); assignment = serializer.save(); record_audit(actor=self.request.user, action="assignment_change", entity_type="trainer_school_assignment", entity_id=assignment.id, summary=f"Assignment for {assignment.trainer.trainer_id} updated", changes={"school": assignment.school.school_code, "status": assignment.status}, request=self.request)
    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN); instance.status = "inactive"; instance.save(update_fields=["status"]); record_audit(actor=self.request.user, action="assignment_change", entity_type="trainer_school_assignment", entity_id=instance.id, summary=f"Trainer {instance.trainer.trainer_id} assignment to {instance.school.school_code} deactivated", changes={"status": "inactive"}, request=self.request)


class SchoolClassViewSet(Phase3ViewSet):
    queryset = SchoolClass.objects.select_related("school"); serializer_class = SchoolClassSerializer
    def scoped_queryset(self): return accessible_class_queryset(self.request.user)
    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL); obj = serializer.save(); record_audit(actor=self.request.user, action="create", entity_type="class", entity_id=obj.id, summary=f"Class {obj.display_name} created", request=self.request)
    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL); obj = serializer.save(); record_audit(actor=self.request.user, action="update", entity_type="class", entity_id=obj.id, summary=f"Class {obj.display_name} updated", request=self.request)
    def perform_destroy(self, instance):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL); instance.status = "inactive"; instance.save(update_fields=["status", "updated_at"]); record_audit(actor=self.request.user, action="update", entity_type="class", entity_id=instance.id, summary=f"Class {instance.display_name} deactivated", request=self.request)


class StudentViewSet(Phase3ViewSet):
    queryset = Student.objects.select_related("school_class__school", "account")
    def get_serializer_class(self):
        if self.action == "create": return StudentCreateSerializer
        if self.action in {"update", "partial_update"}: return StudentUpdateSerializer
        return StudentReadSerializer
    def scoped_queryset(self): return accessible_student_queryset(self.request.user)
    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); serializer.save()
        student = serializer.instance; record_audit(actor=self.request.user, action="create", entity_type="student", entity_id=student.id, summary=f"Student {student.student_id} created", request=self.request)
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True); self.perform_create(serializer); student = serializer.instance; payload = StudentReadSerializer(student, context={"request": request}).data; payload["initial_password"] = serializer.generated_password; return Response(payload, status=status.HTTP_201_CREATED, headers=self.get_success_headers(payload))
    def perform_update(self, serializer):
        self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); student = serializer.save(); record_audit(actor=self.request.user, action="update", entity_type="student", entity_id=student.id, summary=f"Student {student.student_id} updated", request=self.request)
    def perform_destroy(self, instance): self.assert_role(UserRole.ADMIN); raise ValidationError("Students are deactivated instead of hard-deleted.")
    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        self.required_action = "EDIT"; student = self.get_object(); self.assert_role(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER); student.status = "inactive"
        if student.account_id:
            student.account.status = UserStatus.INACTIVE; student.account.is_active = False; student.account.save(update_fields=["status", "is_active"])
        student.save(update_fields=["status", "updated_at"]); record_audit(actor=request.user, action="update", entity_type="student", entity_id=student.id, summary=f"Student {student.student_id} deactivated", request=request); return Response(StudentReadSerializer(student, context={"request": request}).data)
