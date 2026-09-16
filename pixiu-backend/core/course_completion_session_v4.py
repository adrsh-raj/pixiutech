from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import Student
from learning.models import AttendanceRecord, Session
from .course_completion_session_v3 import CourseAwareSessionViewSet
from .strict_learning_scope_views import SafeScopedSessionViewSet


class ProgrammeAwareSessionViewSet(CourseAwareSessionViewSet):
    """Session API with one class-level final-programme marker.

    Completing a session must never trigger the legacy unit evaluator. The final
    programme evaluator runs only when the trainer explicitly clicks Evaluate.
    """

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        self.required_action = 'EDIT'
        session = self.get_object()
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied('Your role cannot complete sessions.')

        roster = list(
            Student.objects.filter(school_class_id=session.school_class_id, status='active')
            .order_by('roll_number', 'student_id')
        )
        roster_ids = {student.pk for student in roster}
        marked_ids = set(
            AttendanceRecord.objects.filter(
                session=session,
                student_id__in=roster_ids,
            ).values_list('student_id', flat=True)
        )
        missing = [student.student_id for student in roster if student.pk not in marked_ids]
        if missing:
            raise ValidationError({
                'attendance':
                    'Attendance is incomplete. Mark attendance for every active student '
                    'before completing this session. Missing: ' + ', '.join(missing) + '.',
            })

        # Call the parent *scoped session* implementation directly. The v3
        # implementation also invokes the old unit evaluator after completion;
        # we deliberately skip that side effect here.
        response = SafeScopedSessionViewSet.complete(self, request, pk=pk)
        completed = Session.objects.get(pk=session.pk)
        return Response(self.map_out(completed), status=response.status_code)
