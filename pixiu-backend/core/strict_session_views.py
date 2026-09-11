from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import UserRole
from academics.models import SchoolClass, Trainer
from academics.services import accessible_class_queryset
from learning.models import Session, CurriculumClassAssignment, CurriculumUnit
from learning.serializers import SessionSerializer
from learning.services import accessible_sessions
from .scoped_contract_views import ScopedContractSessionCompatViewSet


_CURRICULUM_PREFIX = "__PIXIU_CURRICULUM_UNIT_ID__:"


class StrictScopedSessionViewSet(ScopedContractSessionCompatViewSet):
    """Canonical session endpoint with real curriculum FK persistence and scope isolation."""

    def get_queryset(self):
        return accessible_sessions(self.request.user)

    def scoped_queryset(self):
        return self.get_queryset()

    def _resolve_class(self, value):
        obj = SchoolClass.objects.filter(pk=value).first()
        if not obj:
            raise ValidationError({"school_class": "Selected class was not found."})
        if not accessible_class_queryset(self.request.user).filter(pk=obj.pk).exists():
            raise PermissionDenied("You cannot schedule a session for this class.")
        if obj.status != "active":
            raise ValidationError({"school_class": "Only active classes can receive sessions."})
        return obj

    def _resolve_trainer(self, value, school_class):
        trainer = Trainer.objects.filter(pk=value).first() or Trainer.objects.filter(
            trainer_id=str(value).strip().upper()
        ).first()
        if not trainer:
            raise ValidationError({"trainer": "Selected trainer was not found."})
        if trainer.status != "active":
            raise ValidationError({"trainer": "Only active trainers can be scheduled."})
        if self.request.user.role == UserRole.TRAINER and trainer.account_id != self.request.user.id:
            raise PermissionDenied("A trainer can only schedule their own sessions.")
        if self.request.user.role != UserRole.ADMIN and not trainer.school_assignments.filter(
            school_id=school_class.school_id, status="active"
        ).exists():
            raise PermissionDenied("Trainer is not assigned to this school.")
        return trainer

    def map_out(self, obj):
        payload = super().map_out(obj)
        curriculum_id = str(obj.curriculum_unit_id) if obj.curriculum_unit_id else ""
        payload["curriculum_unit"] = curriculum_id
        payload["curriculum_unit_id"] = curriculum_id
        return payload

    def create(self, request, *args, **kwargs):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied("Your role cannot create sessions.")

        class_value = request.data.get("school_class") or request.data.get("class_id") or request.data.get("class")
        trainer_value = request.data.get("trainer") or request.data.get("trainer_id")
        curriculum_id = request.data.get("curriculum_unit") or request.data.get("curriculum") or request.data.get("curriculum_unit_id")
        if not class_value:
            raise ValidationError({"school_class": "Class is required."})
        if not trainer_value:
            raise ValidationError({"trainer": "Trainer is required."})
        if not curriculum_id:
            raise ValidationError({"curriculum_unit": "Select a curriculum unit before scheduling the session."})

        school_class = self._resolve_class(class_value)
        trainer = self._resolve_trainer(trainer_value, school_class)
        curriculum = get_object_or_404(CurriculumUnit, pk=curriculum_id)
        if str(curriculum.grade).strip().upper() != str(school_class.grade).strip().upper():
            raise ValidationError({"curriculum_unit": "Curriculum grade must match the selected class grade."})
        if not CurriculumClassAssignment.objects.filter(curriculum_unit=curriculum, school_class=school_class).exists():
            raise ValidationError({"curriculum_unit": "This curriculum unit is not assigned to the selected class."})

        payload = dict(request.data)
        payload["school_class"] = str(school_class.pk)
        payload["trainer"] = str(trainer.pk)
        payload["topic"] = str(payload.get("topic") or curriculum.topic or curriculum.title).strip()
        payload["notes"] = str(payload.get("notes") or "").strip()
        payload = super().map_in(payload)
        # Keep the legacy marker only for existing progress rows that still parse it;
        # the real database FK below is now the source of truth for all new sessions.
        clean_notes = str(request.data.get("notes") or "").strip()
        payload["notes"] = f"{clean_notes} {_CURRICULUM_PREFIX}{curriculum.pk}__".strip()

        serializer = SessionSerializer(data=payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        session = serializer.save()
        session.curriculum_unit = curriculum
        session.save(update_fields=["curriculum_unit", "updated_at"])

        output = self.map_out(session)
        return Response(output, status=status.HTTP_201_CREATED)
