from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework import status

from accounts.models import UserRole
from academics.models import SchoolClass, Trainer
from academics.services import accessible_class_queryset
from learning.models import Session, CurriculumClassAssignment, CurriculumUnit
from learning.serializers import SessionSerializer
from .scoped_contract_views import ScopedContractSessionCompatViewSet


class StrictScopedSessionViewSet(ScopedContractSessionCompatViewSet):
    """Canonical session create/update adapter for the portal.

    The portal sends legacy class/trainer keys plus curriculum_unit. This adapter
    resolves those ids, validates the trainer/class relationship explicitly, and
    persists the curriculum binding in the existing session metadata marker.
    """

    def _resolve_class(self, value):
        obj = SchoolClass.objects.filter(pk=value).first()
        if not obj:
            raise self._validation({"school_class": "Selected class was not found."})
        if not accessible_class_queryset(self.request.user).filter(pk=obj.pk).exists():
            raise self._validation({"school_class": "You cannot schedule a session for this class."})
        if obj.status != "active":
            raise self._validation({"school_class": "Only active classes can receive sessions."})
        return obj

    def _resolve_trainer(self, value, school_class):
        trainer = Trainer.objects.filter(pk=value).first()
        if not trainer:
            trainer = Trainer.objects.filter(trainer_id=str(value).strip().upper()).first()
        if not trainer:
            raise self._validation({"trainer": "Selected trainer was not found."})
        if trainer.status != "active":
            raise self._validation({"trainer": "Only active trainers can be scheduled."})
        if self.request.user.role == UserRole.TRAINER and trainer.account_id != self.request.user.id:
            raise self._validation({"trainer": "A trainer can only schedule their own sessions."})
        if self.request.user.role != UserRole.ADMIN and not trainer.school_assignments.filter(
            school_id=school_class.school_id, status="active"
        ).exists():
            raise self._validation({"trainer": "Trainer is not assigned to this school."})
        return trainer

    @staticmethod
    def _validation(detail):
        from rest_framework.exceptions import ValidationError
        return ValidationError(detail)

    def create(self, request, *args, **kwargs):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Your role cannot create sessions.")

        class_value = request.data.get("school_class") or request.data.get("class_id") or request.data.get("class")
        trainer_value = request.data.get("trainer") or request.data.get("trainer_id")
        curriculum_id = request.data.get("curriculum_unit") or request.data.get("curriculum") or request.data.get("curriculum_unit_id")
        if not class_value:
            raise self._validation({"school_class": "Class is required."})
        if not trainer_value:
            raise self._validation({"trainer": "Trainer is required."})
        if not curriculum_id:
            raise self._validation({"curriculum_unit": "Select a curriculum unit before scheduling the session."})

        school_class = self._resolve_class(class_value)
        trainer = self._resolve_trainer(trainer_value, school_class)
        curriculum = get_object_or_404(CurriculumUnit, pk=curriculum_id)
        if str(curriculum.grade).strip().upper() != str(school_class.grade).strip().upper():
            raise self._validation({"curriculum_unit": "Curriculum grade must match the selected class grade."})
        if not CurriculumClassAssignment.objects.filter(
            curriculum_unit=curriculum, school_class=school_class
        ).exists():
            raise self._validation({"curriculum_unit": "This curriculum unit is not assigned to the selected class."})

        payload = request.data.copy()
        payload["school_class"] = str(school_class.pk)
        payload["trainer"] = str(trainer.pk)
        payload["topic"] = str(payload.get("topic") or curriculum.topic or curriculum.title).strip()
        payload["notes"] = str(payload.get("notes") or "").strip()

        normalized = super().map_in(payload)
        serializer = SessionSerializer(data=normalized, context={"request": request})
        serializer.is_valid(raise_exception=True)
        session = serializer.save(created_by=request.user)

        clean_notes = str(session.notes or "")
        marker = "__PIXIU_CURRICULUM_UNIT_ID__:{0}__".format(curriculum.pk)
        if marker not in clean_notes:
            session.notes = (clean_notes + " " + marker).strip()
            session.save(update_fields=["notes", "updated_at"])

        output = SessionSerializer(session, context={"request": request}).data
        output["curriculum_unit"] = str(curriculum.pk)
        return Response(output, status=status.HTTP_201_CREATED)
