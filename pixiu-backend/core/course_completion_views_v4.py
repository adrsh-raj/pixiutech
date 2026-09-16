import logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset, accessible_school_queryset, accessible_student_queryset
from learning import course_completion_v4 as service
from learning.course_completion_models import Certificate, CompletionPolicy, Technology
from learning.models import CurriculumClassAssignment
from learning.services import accessible_sessions

logger = logging.getLogger(__name__)


def _error(exc, code=400):
    return Response({'detail': str(exc)}, status=code)


def _student_for(user, key):
    qs = accessible_student_queryset(user).select_related('school_class__school')
    return qs.filter(pk=key).first() or get_object_or_404(qs, student_id__iexact=str(key).strip())


def _class_for(user, key):
    qs = accessible_class_queryset(user)
    return qs.filter(pk=key).first() or get_object_or_404(qs, pk=key)


def _rows(user, school_id='', class_id=''):
    qs = accessible_student_queryset(user).select_related('school_class__school').filter(status='active')
    if school_id:
        qs = qs.filter(school_class__school_id=school_id)
    if class_id:
        qs = qs.filter(school_class_id=class_id)
    rows = []
    for student in qs.order_by('school_class__school__name', 'school_class__display_name', 'roll_number', 'student_id')[:500]:
        try:
            rows.append(service.summary(student))
        except Exception:
            logger.exception('course completion summary failed for %s', student.student_id)
            rows.append({'student_id': student.student_id, 'student_name': student.name, 'school_name': student.school_class.school.name, 'school_code': student.school_class.school.school_code, 'class_name': student.school_class.display_name, 'status': 'in_progress', 'required_units': 0, 'completed_units': 0, 'overall_score': 0, 'technologies': [], 'sessions_by_technology': [], 'units': [], 'programme_final_session': None, 'final_session_ready': False, 'certificate_id': None, 'trainer_approval_ready': False, 'can_issue_certificate': False, 'policy': None})
    return rows


class TechnologyListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(list(Technology.objects.filter(active=True).values('id', 'code', 'name', 'sort_order')))


class CourseCompletionListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        school_id = str(request.query_params.get('school_id') or '').strip()
        class_id = str(request.query_params.get('class_id') or '').strip()
        if school_id and not accessible_school_queryset(request.user).filter(pk=school_id).exists():
            return _error(PermissionError('School is outside your authorised scope.'), 403)
        if class_id and not accessible_class_queryset(request.user).filter(pk=class_id).exists():
            return _error(PermissionError('Class is outside your authorised scope.'), 403)
        return Response(_rows(request.user, school_id, class_id))


class CourseCompletionScopeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        schools = list(accessible_school_queryset(request.user).order_by('name').values('id', 'name', 'school_code'))
        classes = list(accessible_class_queryset(request.user).order_by('display_name').values('id', 'display_name', 'grade', 'section', 'school_id'))
        return Response({'schools': schools, 'classes': classes})


class CourseCompletionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, student_key):
        student = _student_for(request.user, student_key)
        return Response(service.summary(student))


class CompletionPolicyView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, class_key):
        school_class = _class_for(request.user, class_key)
        policy = service.policy_for(school_class)
        return Response(service.serialize_policy(policy))
    def put(self, request, class_key):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can edit completion criteria.'), 403)
        school_class = get_object_or_404(SchoolClass, pk=class_key)
        try:
            return Response(service.serialize_policy(service.update_policy(school_class, request.data)))
        except ValueError as exc:
            return _error(exc)


class EvaluateLastSessionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, session_id):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            return _error(PermissionError('Only trainers and administrators can evaluate a session.'), 403)
        from learning.models import Session
        session = get_object_or_404(Session.objects.select_related('school_class', 'curriculum_unit'), pk=session_id)
        if request.user.role == UserRole.TRAINER and not accessible_sessions(request.user).filter(pk=session.pk).exists():
            return _error(PermissionError('This session is outside your authorised trainer scope.'), 403)
        try:
            rows = service.evaluate_last_session(session)
            return Response({'session_id': str(session.id), 'evaluated_students': len(rows), 'passed': len(rows), 'failed_or_pending': 0})
        except ValueError as exc:
            return _error(exc)


class ApproveFinalProgrammeView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            programme = service.approve_programme(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'detail': 'Final programme session approved. Certificate is now ready to issue.'})
        except PermissionError as exc:
            return _error(exc, 403)
        except ValueError as exc:
            return _error(exc)


class IssueProgrammeCertificateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            return Response(service.certificate_payload(service.issue_certificate(request.user, student)))
        except PermissionError as exc:
            return _error(exc, 403)
        except ValueError as exc:
            return _error(exc)


class VerifyProgrammeCertificateView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, student_id=None):
        key = str(request.query_params.get('certificate') or request.query_params.get('cert') or '').strip()
        token = str(request.query_params.get('token') or '').strip()
        if student_id:
            return Response({'verified': False, 'status': 'legacy_not_supported', 'reason': 'Use the certificate ID or verification token.'}, status=410)
        if not key and not token:
            return Response({'verified': False, 'status': 'invalid_request', 'reason': 'Certificate ID or verification token is required.'}, status=400)
        certificate = Certificate.objects.filter(verification_token=token).first() if token else None
        if certificate is None and key:
            certificate = Certificate.objects.filter(certificate_id__iexact=key).first()
        if certificate is None:
            return Response({'verified': False, 'status': 'not_found', 'reason': 'No Pixiu Tech certificate matches this verification code.'}, status=404)
        return Response(service.certificate_payload(certificate))
