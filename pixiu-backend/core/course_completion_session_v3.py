from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import Student
from learning.course_completion_models import CurriculumUnitProfile, SessionWorkflow, Technology
from learning.models import AttendanceRecord, CurriculumUnit, Session
from learning.serializers import SessionSerializer
from learning.course_completion_v4 import evaluate_last_session
from .strict_learning_scope_views import SafeScopedSessionViewSet


def as_bool(value):
    if isinstance(value, bool):
        return value
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


class CourseAwareSessionViewSet(SafeScopedSessionViewSet):
    def _technology(self, value=None, fallback_unit=None):
        if value:
            technology = Technology.objects.filter(pk=value, active=True).first() or Technology.objects.filter(code=str(value).strip().lower(), active=True).first()
            if not technology:
                raise ValidationError({'technology': 'Select an active technology from the technology catalogue.'})
            return technology
        profile = CurriculumUnitProfile.objects.filter(curriculum_unit=fallback_unit).select_related('technology').first() if fallback_unit else None
        if profile:
            return profile.technology
        raise ValidationError({'technology': 'Technology is required for this session.'})

    def _check_unit_technology(self, curriculum, technology, create_profile=False):
        profile = CurriculumUnitProfile.objects.filter(curriculum_unit=curriculum).select_related('technology').first()
        if profile and profile.technology_id != technology.id:
            raise ValidationError({'technology': f'This unit is already mapped to {profile.technology.name}. Use the same technology for all sessions of this unit.'})
        if create_profile and profile is None:
            CurriculumUnitProfile.objects.create(curriculum_unit=curriculum, technology=technology, certificate_required=True)

    def _set_last_session(self, session, is_last):
        if not is_last:
            return
        # There is exactly one final-programme marker per class. The existing field
        # is retained for backward-compatible clients but now has programme scope.
        SessionWorkflow.objects.filter(
            session__school_class=session.school_class,
            is_last_session_for_unit=True,
        ).exclude(session=session).update(is_last_session_for_unit=False)

    def map_out(self, obj):
        payload = super().map_out(obj)
        workflow = SessionWorkflow.objects.filter(session=obj).select_related('technology').first()
        curriculum = getattr(obj, 'curriculum_unit', None)
        school_class = getattr(obj, 'school_class', None)
        school = getattr(school_class, 'school', None)
        technology = workflow.technology if workflow and workflow.technology_id else None
        if technology is None and curriculum is not None:
            profile = CurriculumUnitProfile.objects.filter(curriculum_unit=curriculum).select_related('technology').first()
            technology = profile.technology if profile else None
        final_marker = bool(workflow.is_last_session_for_unit) if workflow else False
        payload.update({
            'technology': str(technology.id) if technology else None,
            'technology_id': str(technology.id) if technology else None,
            'technology_name': technology.name if technology else '',
            'is_last_session_for_unit': final_marker,
            'is_last_programme_session': final_marker,
            'last_session': final_marker,
            'school_class_id': str(obj.school_class_id) if obj.school_class_id else None,
            'school_class_school': str(school.id) if school else None,
            'school_name': school.name if school else '',
            'school_code': school.school_code if school else '',
            'class_name': school_class.display_name if school_class else '',
            'curriculum_unit_id': str(obj.curriculum_unit_id) if obj.curriculum_unit_id else None,
            'curriculum_unit_name': curriculum.title if curriculum else '',
            'curriculum_unit_title': curriculum.title if curriculum else '',
            'curriculum_unit_code': curriculum.unit_code if curriculum else '',
            'curriculum_unit_week': curriculum.week if curriculum else '',
            'curriculum_unit_topic': curriculum.topic if curriculum else '',
        })
        return payload

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied('Your role cannot create sessions.')
        curriculum_id = request.data.get('curriculum_unit') or request.data.get('curriculum') or request.data.get('curriculum_unit_id')
        curriculum = CurriculumUnit.objects.filter(pk=curriculum_id).first()
        if not curriculum:
            raise ValidationError({'curriculum_unit': 'Select a valid curriculum unit.'})
        technology = self._technology(request.data.get('technology') or request.data.get('technology_id'), curriculum)
        self._check_unit_technology(curriculum, technology, create_profile=True)
        response = super().create(request, *args, **kwargs)
        session = Session.objects.get(pk=response.data['id'])
        is_last = as_bool(request.data.get('is_last_session_for_unit', request.data.get('last_session', False)))
        SessionWorkflow.objects.update_or_create(session=session, defaults={'technology': technology, 'is_last_session_for_unit': is_last})
        if is_last:
            self._set_last_session(session, True)
        response.data = self.map_out(session)
        return response

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        self.required_action = 'EDIT'
        session = self.get_object()
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied('Your role cannot complete sessions.')
        roster = list(Student.objects.filter(school_class_id=session.school_class_id, status='active').order_by('roll_number', 'student_id'))
        roster_ids = {student.pk for student in roster}
        marked_ids = set(AttendanceRecord.objects.filter(session=session, student_id__in=roster_ids).values_list('student_id', flat=True))
        missing = [student.student_id for student in roster if student.pk not in marked_ids]
        if missing:
            raise ValidationError({'attendance': f'Attendance is incomplete. Mark attendance for every active student before completing this session. Missing: {", ".join(missing)}.'})
        response = super().complete(request, pk=pk)
        completed = Session.objects.get(pk=session.pk)
        workflow = SessionWorkflow.objects.filter(session=completed).first()
        if workflow and workflow.is_last_session_for_unit:
            evaluate_last_session(completed)
        return Response(self.map_out(completed), status=response.status_code)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        return self._update_workflow(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return self._update_workflow(request, *args, **kwargs)

    def _update_workflow(self, request, *args, **kwargs):
        session = self.get_object()
        provided_technology = request.data.get('technology') or request.data.get('technology_id')
        technology = self._technology(provided_technology, session.curriculum_unit) if provided_technology else self._technology(fallback_unit=session.curriculum_unit)
        if session.curriculum_unit_id:
            self._check_unit_technology(session.curriculum_unit, technology, create_profile=True)
        workflow, _ = SessionWorkflow.objects.get_or_create(session=session, defaults={'technology': technology, 'is_last_session_for_unit': False})
        if provided_technology:
            workflow.technology = technology
        if 'is_last_session_for_unit' in request.data or 'last_session' in request.data:
            workflow.is_last_session_for_unit = as_bool(request.data.get('is_last_session_for_unit', request.data.get('last_session')))
        workflow.save(update_fields=['technology', 'is_last_session_for_unit', 'updated_at'])
        if workflow.is_last_session_for_unit:
            self._set_last_session(session, True)
        payload = request.data.copy()
        payload['school_class'] = str(session.school_class_id)
        payload['trainer'] = str(session.trainer_id)
        payload['curriculum_unit'] = str(session.curriculum_unit_id) if session.curriculum_unit_id else ''
        serializer = SessionSerializer(session, data=payload, partial=str(request.method).upper() == 'PATCH', context={'request': request})
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        updated = Session.objects.select_related('school_class__school', 'trainer', 'curriculum_unit').get(pk=updated.pk)
        return Response(self.map_out(updated))
