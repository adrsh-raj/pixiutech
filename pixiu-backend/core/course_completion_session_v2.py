from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from accounts.models import UserRole
from learning.course_completion_models import CurriculumUnitProfile, SessionWorkflow, Technology
from learning.models import Session
from .strict_learning_scope_views import SafeScopedSessionViewSet


def as_bool(value):
    if isinstance(value, bool): return value
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


class CourseAwareSessionViewSet(SafeScopedSessionViewSet):
    def _technology(self, value):
        technology = Technology.objects.filter(pk=value, active=True).first() or Technology.objects.filter(code=str(value or '').strip().lower(), active=True).first()
        if not technology: raise ValidationError({'technology': 'Select an active technology from the technology catalogue.'})
        return technology

    def _enforce_unit_technology(self, curriculum, technology, *, create=False):
        profile = CurriculumUnitProfile.objects.filter(curriculum_unit=curriculum).select_related('technology').first()
        if profile and profile.technology_id != technology.id:
            raise ValidationError({'technology': f'This curriculum unit is already assigned to {profile.technology.name}.'})
        if create and profile is None:
            CurriculumUnitProfile.objects.create(curriculum_unit=curriculum, technology=technology, certificate_required=True)

    def map_out(self, obj):
        payload = super().map_out(obj)
        workflow = SessionWorkflow.objects.filter(session=obj).select_related('technology').first()
        payload.update({
            'technology': str(workflow.technology_id) if workflow else None,
            'technology_id': str(workflow.technology_id) if workflow else None,
            'technology_name': workflow.technology.name if workflow else '',
            'is_last_session_for_unit': bool(workflow.is_last_session_for_unit) if workflow else False,
            'last_session': bool(workflow.is_last_session_for_unit) if workflow else False,
        })
        return payload

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied('Your role cannot create sessions.')
        technology = self._technology(request.data.get('technology') or request.data.get('technology_id'))
        curriculum_id = request.data.get('curriculum_unit') or request.data.get('curriculum') or request.data.get('curriculum_unit_id')
        curriculum = __import__('learning.models', fromlist=['CurriculumUnit']).CurriculumUnit.objects.filter(pk=curriculum_id).first()
        if curriculum is None: raise ValidationError({'curriculum_unit': 'Select a valid curriculum unit.'})
        self._enforce_unit_technology(curriculum, technology, create=True)
        response = super().create(request, *args, **kwargs)
        session = Session.objects.get(pk=response.data['id'])
        last_session = as_bool(request.data.get('is_last_session_for_unit', request.data.get('last_session', False)))
        SessionWorkflow.objects.update_or_create(session=session, defaults={'technology': technology, 'is_last_session_for_unit': last_session})
        response.data = self.map_out(session)
        return response

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        return self._update_workflow(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return self._update_workflow(request, *args, **kwargs)

    def _update_workflow(self, request, *args, **kwargs):
        session = self.get_object()
        workflow, _ = SessionWorkflow.objects.get_or_create(
            session=session,
            defaults={'technology': self._technology(request.data.get('technology') or request.data.get('technology_id')), 'is_last_session_for_unit': False},
        )
        if 'technology' in request.data or 'technology_id' in request.data:
            technology = self._technology(request.data.get('technology') or request.data.get('technology_id'))
            if session.curriculum_unit_id:
                self._enforce_unit_technology(session.curriculum_unit, technology)
            workflow.technology = technology
        if 'is_last_session_for_unit' in request.data or 'last_session' in request.data:
            workflow.is_last_session_for_unit = as_bool(request.data.get('is_last_session_for_unit', request.data.get('last_session')))
        workflow.save(update_fields=['technology', 'is_last_session_for_unit', 'updated_at'])
        response = super().update(request, *args, **kwargs)
        fresh = Session.objects.get(pk=session.pk)
        response.data = self.map_out(fresh)
        return response
