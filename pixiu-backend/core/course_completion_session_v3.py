from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.models import UserRole
from learning.course_completion_models import CurriculumUnitProfile, SessionWorkflow, Technology
from learning.models import CurriculumUnit, Session
from .strict_learning_scope_views import SafeScopedSessionViewSet


def as_bool(value):
    if isinstance(value, bool): return value
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


class CourseAwareSessionViewSet(SafeScopedSessionViewSet):
    def _technology(self, value=None, fallback_unit=None):
        if value:
            technology = Technology.objects.filter(pk=value, active=True).first() or Technology.objects.filter(code=str(value).strip().lower(), active=True).first()
            if not technology: raise ValidationError({'technology': 'Select an active technology from the technology catalogue.'})
            return technology
        profile = CurriculumUnitProfile.objects.filter(curriculum_unit=fallback_unit).select_related('technology').first() if fallback_unit else None
        if profile: return profile.technology
        raise ValidationError({'technology': 'Technology is required for this session.'})

    def _check_unit_technology(self, curriculum, technology, create_profile=False):
        profile = CurriculumUnitProfile.objects.filter(curriculum_unit=curriculum).select_related('technology').first()
        if profile and profile.technology_id != technology.id:
            raise ValidationError({'technology': f'This unit is already mapped to {profile.technology.name}. Use the same technology for all sessions of this unit.'})
        if create_profile and profile is None:
            CurriculumUnitProfile.objects.create(curriculum_unit=curriculum, technology=technology, certificate_required=True)

    def _set_last_session(self, session, is_last):
        if not is_last or not session.curriculum_unit_id: return
        SessionWorkflow.objects.filter(
            session__school_class=session.school_class,
            session__curriculum_unit=session.curriculum_unit,
            is_last_session_for_unit=True,
        ).exclude(session=session).update(is_last_session_for_unit=False, updated_at=session.updated_at)

    def map_out(self, obj):
        payload = super().map_out(obj)
        workflow = SessionWorkflow.objects.filter(session=obj).select_related('technology').first()
        payload.update({'technology': str(workflow.technology_id) if workflow else None, 'technology_id': str(workflow.technology_id) if workflow else None, 'technology_name': workflow.technology.name if workflow else '', 'is_last_session_for_unit': bool(workflow.is_last_session_for_unit) if workflow else False, 'last_session': bool(workflow.is_last_session_for_unit) if workflow else False})
        return payload

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}: raise PermissionDenied('Your role cannot create sessions.')
        curriculum_id = request.data.get('curriculum_unit') or request.data.get('curriculum') or request.data.get('curriculum_unit_id')
        curriculum = CurriculumUnit.objects.filter(pk=curriculum_id).first()
        if not curriculum: raise ValidationError({'curriculum_unit': 'Select a valid curriculum unit.'})
        technology = self._technology(request.data.get('technology') or request.data.get('technology_id'), curriculum)
        self._check_unit_technology(curriculum, technology, create_profile=True)
        response = super().create(request, *args, **kwargs)
        session = Session.objects.get(pk=response.data['id'])
        is_last = as_bool(request.data.get('is_last_session_for_unit', request.data.get('last_session', False)))
        workflow, _ = SessionWorkflow.objects.update_or_create(session=session, defaults={'technology': technology, 'is_last_session_for_unit': is_last})
        if is_last: self._set_last_session(session, True)
        response.data = self.map_out(session)
        return response

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs): return self._update_workflow(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs): return self._update_workflow(request, *args, **kwargs)

    def _update_workflow(self, request, *args, **kwargs):
        session = self.get_object()
        provided_technology = request.data.get('technology') or request.data.get('technology_id')
        technology = self._technology(provided_technology, session.curriculum_unit) if provided_technology else self._technology(fallback_unit=session.curriculum_unit)
        if session.curriculum_unit_id: self._check_unit_technology(session.curriculum_unit, technology, create_profile=True)
        workflow, _ = SessionWorkflow.objects.get_or_create(session=session, defaults={'technology': technology, 'is_last_session_for_unit': False})
        if provided_technology: workflow.technology = technology
        if 'is_last_session_for_unit' in request.data or 'last_session' in request.data: workflow.is_last_session_for_unit = as_bool(request.data.get('is_last_session_for_unit', request.data.get('last_session')))
        workflow.save(update_fields=['technology', 'is_last_session_for_unit', 'updated_at'])
        if workflow.is_last_session_for_unit: self._set_last_session(session, True)
        response = super().update(request, *args, **kwargs)
        response.data = self.map_out(Session.objects.get(pk=session.pk))
        return response
