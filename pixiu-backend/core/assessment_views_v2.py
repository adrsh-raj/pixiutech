from django.db import IntegrityError, transaction
from django.db.models.functions import Lower, Trim
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import UserRole
from .strict_learning_scope_views import SafeScopedAssessmentViewSet


def _normalized_unit_code(value):
    return str(value or '').strip().upper()


class IdempotentAssessmentViewSet(SafeScopedAssessmentViewSet):
    """Persist one current assessment per student + curriculum unit.

    The database constraint is the final guard; this view also turns repeated
    POSTs (including browser double-clicks or retried requests) into an update
    of the current assessment instead of creating a second ledger row.
    """

    def _find_existing(self, student, unit_code):
        normalized = _normalized_unit_code(unit_code)
        if not normalized:
            return None
        return (
            self.get_queryset()
            .annotate(_normalized_unit=Lower(Trim('unit_code')))
            .filter(student=student, _normalized_unit=normalized.lower())
            .order_by('-updated_at', '-created_at', '-id')
            .first()
        )

    def create(self, request, *args, **kwargs):
        self.required_action = 'CREATE'
        payload = request.data.copy()
        if request.user.role == UserRole.TRAINER:
            trainer = getattr(request.user, 'trainer_profile', None)
            if trainer is None:
                raise ValidationError({'trainer': 'Your account has no trainer profile.'})
            payload['trainer'] = str(trainer.pk)

        unit_code = _normalized_unit_code(payload.get('unit_code'))
        if unit_code:
            payload['unit_code'] = unit_code
        student = payload.get('student')

        # Normalize the student key through the serializer itself first, then
        # resolve an existing row from the authenticated/scoped queryset.
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        student_obj = serializer.validated_data.get('student')
        unit_code = _normalized_unit_code(serializer.validated_data.get('unit_code'))
        existing = self._find_existing(student_obj, unit_code)

        if existing is not None:
            update_serializer = self.get_serializer(existing, data={**payload, 'student': str(student_obj.pk), 'unit_code': unit_code}, partial=False)
            update_serializer.is_valid(raise_exception=True)
            self.perform_update(update_serializer)
            return Response(self.map_out(update_serializer.instance) if hasattr(self, 'map_out') else update_serializer.data, status=200)

        try:
            with transaction.atomic():
                self.perform_create(serializer)
        except IntegrityError:
            # Another request won the unique race. Re-read the winning row and
            # apply this request's values so the operation remains idempotent.
            existing = self._find_existing(student_obj, unit_code)
            if existing is None:
                raise
            update_serializer = self.get_serializer(existing, data={**payload, 'student': str(student_obj.pk), 'unit_code': unit_code}, partial=False)
            update_serializer.is_valid(raise_exception=True)
            self.perform_update(update_serializer)
            return Response(self.map_out(update_serializer.instance) if hasattr(self, 'map_out') else update_serializer.data, status=200)

        return Response(self.map_out(serializer.instance) if hasattr(self, 'map_out') else serializer.data, status=201, headers=self.get_success_headers(serializer.data))
