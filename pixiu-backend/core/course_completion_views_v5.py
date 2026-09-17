import logging
from uuid import UUID

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset, accessible_school_queryset, accessible_student_queryset
from learning import course_completion_final as service
from learning.certificate_pdf import build_certificate_pdf
from learning.course_completion_models import Certificate, Technology
from learning.models import Session
from learning.services import accessible_sessions

logger = logging.getLogger(__name__)


def _error(exc, code=400):
    return Response({'detail': str(exc)}, status=code)


def _student_for(user, key):
    """Resolve a scoped student by UUID primary key or human-facing student_id.

    Student IDs such as ``XYZ6A 01`` are not UUIDs. Do not send those values
    through the UUIDField lookup because Django can raise ValidationError while
    coercing the query parameter before the fallback lookup is evaluated.
    """
    qs = accessible_student_queryset(user).select_related('school_class__school')
    raw = str(key or '').strip()
    if not raw:
        raise get_object_or_404(qs, student_id__iexact=raw)

    try:
        uuid_key = UUID(raw)
    except (ValueError, TypeError, AttributeError):
        uuid_key = None

    if uuid_key is not None:
        student = qs.filter(pk=uuid_key).first()
        if student is not None:
            return student

    return get_object_or_404(qs, student_id__iexact=raw)


def _safe_summary(student):
    try:
        return service.summary(student)
    except Exception:
        logger.exception('Course completion summary failed for %s', student.student_id)
        return {'student_id': student.student_id, 'student_name': student.name, 'school_name': student.school_class.school.name, 'school_code': student.school_class.school.school_code, 'class_name': student.school_class.display_name, 'status': 'in_progress', 'overall_score': 0, 'pass_mark': service.PASS_MARK, 'score_breakdown': {'attendance_pct': 0, 'quiz_pct': 0, 'practical_pct': 0, 'trainer_review_pct': 0, 'overall_score': 0, 'pass_mark': service.PASS_MARK, 'eligible': False}, 'required_units': 0, 'completed_units': 0, 'units': [], 'technologies': [], 'sessions_by_technology': [], 'programme_final_session': None, 'final_session_ready': False, 'trainer_approval_ready': False, 'can_issue_certificate': False, 'certificate_id': None, 'checklist': {'ready': False, 'blockers': ['Completion data is temporarily unavailable. Please refresh and retry.']}, 'project': {'complete': False, 'status': None, 'title': None, 'score': None}, 'quizzes': {'complete': False, 'missing': [], 'rows': []}, 'policy': service.serialize_policy(service.policy_for(student.school_class))}


class TechnologyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(list(Technology.objects.filter(active=True).values('id', 'code', 'name', 'sort_order')))


class CourseCompletionScopeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        schools = list(accessible_school_queryset(request.user).order_by('name').values('id', 'name', 'school_code'))
        classes = list(accessible_class_queryset(request.user).order_by('school_id', 'display_name').values('id', 'display_name', 'grade', 'section', 'school_id'))
        return Response({'schools': schools, 'classes': classes})


class CourseCompletionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school_id = str(request.query_params.get('school_id') or '').strip()
        class_id = str(request.query_params.get('class_id') or '').strip()
        school_scope = accessible_school_queryset(request.user)
        class_scope = accessible_class_queryset(request.user)
        if school_id and not school_scope.filter(pk=school_id).exists():
            return _error(PermissionError('School is outside your authorised scope.'), 403)
        if class_id and not class_scope.filter(pk=class_id).exists():
            return _error(PermissionError('Class is outside your authorised scope.'), 403)
        qs = accessible_student_queryset(request.user).select_related('school_class__school').filter(status='active')
        if school_id:
            qs = qs.filter(school_class__school_id=school_id)
        if class_id:
            qs = qs.filter(school_class_id=class_id)
        return Response([_safe_summary(student) for student in qs.order_by('school_class__school__name', 'school_class__display_name', 'roll_number', 'student_id')[:500]])


class CourseCompletionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_key):
        return Response(_safe_summary(_student_for(request.user, student_key)))


class CompletionPolicyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, class_key):
        school_class = get_object_or_404(accessible_class_queryset(request.user), pk=class_key)
        return Response(service.serialize_policy(service.policy_for(school_class)))

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
        session = get_object_or_404(Session.objects.select_related('school_class', 'curriculum_unit', 'workflow__technology'), pk=session_id)
        if request.user.role == UserRole.TRAINER and not accessible_sessions(request.user).filter(pk=session.pk).exists():
            return _error(PermissionError('This session is outside your authorised trainer scope.'), 403)
        try:
            return Response(service.evaluate_final_programme(session))
        except ValueError as exc:
            return _error(exc)


class ApproveFinalProgrammeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            programme = service.approve_programme(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'pass_mark': service.PASS_MARK, 'detail': 'Final programme approved. Certificate is ready to issue.'})
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


class CertificatePdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_key):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            return _error(PermissionError('Only authorised trainers or administrators can access certificate PDFs.'), 403)
        student = _student_for(request.user, student_key)
        try:
            service.ensure_scope(request.user, student)
        except PermissionError as exc:
            return _error(exc, 403)
        certificate = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
        if certificate is None:
            return _error(ValueError('No issued certificate exists for this student.'), 404)
        return build_certificate_pdf(certificate)


class PublicCertificatePdfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, certificate_id):
        certificate = Certificate.objects.filter(certificate_id__iexact=str(certificate_id).strip(), status='issued').first()
        if certificate is None:
            return _error(ValueError('No issued Pixiu Tech certificate matches this certificate ID.'), 404)
        return build_certificate_pdf(certificate)


class VerifyProgrammeCertificateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, student_id=None):
        if student_id:
            return Response({'verified': False, 'status': 'legacy_not_supported', 'reason': 'Use the certificate ID or verification token.'}, status=410)
        key = str(request.query_params.get('certificate') or request.query_params.get('cert') or '').strip()
        token = str(request.query_params.get('token') or '').strip()
        if not key and not token:
            return Response({'verified': False, 'status': 'invalid_request', 'reason': 'Certificate ID or verification token is required.'}, status=400)
        certificate = Certificate.objects.filter(verification_token=token, status='issued').first() if token else None
        if certificate is None and key:
            certificate = Certificate.objects.filter(certificate_id__iexact=key, status='issued').first()
        if certificate is None:
            return Response({'verified': False, 'status': 'not_found', 'reason': 'No Pixiu Tech certificate matches this verification code.'}, status=404)
        return Response(service.certificate_payload(certificate))