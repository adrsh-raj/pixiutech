from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import UserRole
from learning.course_completion_models import SessionWorkflow, Technology
from learning.models import Session
from .strict_learning_scope_views import SafeScopedSessionViewSet


class CourseAwareSessionViewSet(SafeScopedSessionViewSet):
    def _technology(self, value):
        technology = Technology.objects.filter(pk=value, active=True).first()
        if not technology:
            technology = Technology.objects.filter(code=str(value or '').strip().lower(), active=True).first()
        if not technology:
            raise ValidationError({'technology': 'Select an active technology from the catalogue.'})
        return technology

    def map_out(self, obj):
        payload = super().map_out(obj)
        workflow = SessionWorkflow.objects.filter(session=obj).select_related('technology').first()
        payload['technology'] = str(workflow.technology_id) if workflow else None
        payload['technology_id'] = str(workflow.technology_id) if workflow else None
        payload['technology_name'] = workflow.technology.name if workflow else ''
        payload['is_last_session_for_unit'] = bool(workflow.is_last_session_for_unit) if workflow else False
        payload['last_session'] = bool(workflow.is_last_session_for_unit) if workflow else False
        return payload

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied('Your role cannot create sessions.')
        technology = self._technology(request.data.get('technology') or request.data.get('technology_id'))
        raw_last = request.data.get('is_last_session_for_unit', request.data.get('last_session', False))
        is_last = str(raw_last).strip().lower() in {'true', '1', 'yes', 'on'} if not isinstance(raw_last, bool) else raw_last
        response = super().create(request, *args, **kwargs)
        session_id = response.data.get('id')
        session = Session.objects.get(pk=session_id)
        SessionWorkflow.objects.update_or_create(session=session, defaults={'technology': technology, 'is_last_session_for_unit': is_last})
        response.data.update(self.map_out(session))
        return response

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        workflow_fields = {'technology', 'technology_id', 'is_last_session_for_unit', 'last_session'}
        has_workflow_change = any(key in request.data for key in workflow_fields)
        if has_workflow_change:
            session = self.get_object()
            workflow = SessionWorkflow.objects.filter(session=session).first()
            if not workflow:
                technology = self._technology(request.data.get('technology') or request.data.get('technology_id'))
                workflow = SessionWorkflow.objects.create(session=session, technology=technology, is_last_session_for_unit=False)
            if 'technology' in request.data or 'technology_id' in request.data:
                workflow.technology = self._technology(request.data.get('technology') or request.data.get('technology_id'))
            if 'is_last_session_for_unit' in request.data or 'last_session' in request.data:
                value = request.data.get('is_last_session_for_unit', request.data.get('last_session'))
                workflow.is_last_session_for_unit = str(value).strip().lower() in {'true', '1', 'yes', 'on'} if not isinstance(value, bool) else value
            workflow.save(update_fields=['technology', 'is_last_session_for_unit', 'updated_at'])
        response = super().update(request, *args, **kwargs)
        response.data.update(self.map_out(Session.objects.get(pk=self.kwargs[self.lookup_url_kwarg or self.lookup_field])))
        return response
