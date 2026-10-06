import logging
from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import (
    accessible_class_queryset,
    accessible_school_queryset,
    accessible_student_queryset,
)
from learning import course_completion_final as service
from learning.certificate_pdf import build_certificate_pdf
from learning.course_completion_models import Certificate, Technology
from learning.models import Session
from learning.services import accessible_sessions

logger = logging.getLogger(__name__)


def _error(exc, code=400):
    return Response({'detail': str(exc)}, status=code)


def _student_for(user, key):
    """Resolve a scoped student by UUID primary key or human-facing student_id."""
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


def _safe_call(label, fn, default):
    try:
        return fn()
    except Exception:
        logger.exception('Course completion %s failed', label)
        return default


def _default_policy():
    return {
        'id': None,
        'name': 'Standard Pixiu completion policy',
        'school_class_id': None,
        'requires_attendance': True,
        'requires_quiz': True,
        'requires_practical': True,
        'requires_trainer_review': True,
        'weight_practical': service.WEIGHT_PRACTICAL,
        'weight_quiz': service.WEIGHT_QUIZ,
        'weight_attendance': service.WEIGHT_ATTENDANCE,
        'weight_trainer_review': service.WEIGHT_TRAINER_REVIEW,
        'min_attendance_pct': 75.0,
        'min_quiz_pct': 60.0,
        'min_practical_pct': 70.0,
        'min_trainer_review_rating': 3.0,
        'active': True,
    }


def _fallback_summary(student):
    """Build a real-data summary without allowing one calculation to blank the student."""
    empty_sessions = []
    sessions = _safe_call('completed_sessions', lambda: service.completed_sessions(student), empty_sessions)
    technologies = _safe_call('completed_technologies', lambda: service.completed_technologies(student), [])
    taught_codes = _safe_call('taught_unit_codes', lambda: service._taught_unit_codes(sessions), set())

    attendance = _safe_call(
        'attendance_metrics',
        lambda: service.attendance_metrics(student, sessions),
        {
            'percentage': 0.0,
            'attended': 0,
            'total': len(sessions),
            'marked': 0,
            'missing': [],
            'complete': False if sessions else True,
        },
    )
    quiz = _safe_call(
        'quiz_metrics',
        lambda: service.quiz_metrics(student, taught_codes),
        {'percentage': 0.0, 'assigned': 0, 'completed': 0, 'missing': [], 'complete': True, 'rows': []},
    )
    assessment = _safe_call(
        'assessment_metrics',
        lambda: service.assessment_metrics(student, taught_codes),
        {'practical_pct': 0.0, 'trainer_review_pct': 0.0, 'trainer_review_rating': None},
    )
    project = _safe_call(
        'project_metrics',
        lambda: service.project_metrics(student),
        {'complete': False, 'status': None, 'title': None, 'score': None},
    )
    final = _safe_call('programme_final_session', lambda: service.programme_final_session(student), None)
    final_ready = bool(final and _safe_call('final_session_is_latest', lambda: service.final_session_is_latest(student, final), False))

    overall = round(
        float(assessment.get('practical_pct', 0.0)) * service.WEIGHT_PRACTICAL / 100
        + float(quiz.get('percentage', 0.0)) * service.WEIGHT_QUIZ / 100
        + float(attendance.get('percentage', 0.0)) * service.WEIGHT_ATTENDANCE / 100
        + float(assessment.get('trainer_review_pct', 0.0)) * service.WEIGHT_TRAINER_REVIEW / 100,
        2,
    )

    blockers = []
    if not final_ready:
        blockers.append('Mark and complete the final programme session; it must be the latest completed session.')
    if attendance.get('missing'):
        blockers.append('Attendance is unmarked for: ' + ', '.join(item['topic'] for item in attendance['missing']) + '.')
    if quiz.get('missing'):
        blockers.append('Quiz pending for: ' + ', '.join(item['title'] for item in quiz['missing']) + '.')
    if not project.get('complete'):
        blockers.append(f"Project is not marked completed (current status: {project.get('status') or 'not submitted'}).")
    if overall < service.PASS_MARK:
        blockers.append(f'Overall score is {overall:.2f}%; minimum required is {service.PASS_MARK:.0f}%.')

    programme = _safe_call(
        'programme_completion_lookup',
        lambda: __import__('learning.course_completion_models', fromlist=['ProgrammeCompletion']).ProgrammeCompletion.objects.filter(student=student).first(),
        None,
    )
    certificate = _safe_call(
        'certificate_lookup',
        lambda: Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first(),
        None,
    )
    policy = _safe_call(
        'policy_lookup',
        lambda: service.serialize_policy(service.policy_for(student.school_class)),
        _default_policy(),
    )

    final_payload = {
        'id': str(final.id),
        'topic': final.topic,
        'date': str(final.date),
        'technology': getattr(getattr(final, 'workflow', None), 'technology', None).name
        if getattr(getattr(final, 'workflow', None), 'technology', None)
        else '',
    } if final else None

    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'status': programme.status if programme else 'in_progress',
        'overall_score': overall,
        'pass_mark': service.PASS_MARK,
        'score_breakdown': {
            'attendance_pct': float(attendance.get('percentage', 0.0)),
            'quiz_pct': float(quiz.get('percentage', 0.0)),
            'practical_pct': float(assessment.get('practical_pct', 0.0)),
            'trainer_review_pct': float(assessment.get('trainer_review_pct', 0.0)),
            'overall_score': overall,
            'pass_mark': service.PASS_MARK,
            'eligible': overall >= service.PASS_MARK,
        },
        'required_units': 0,
        'completed_units': 0,
        'units': [],
        'technologies': technologies,
        'sessions_by_technology': [
            {
                'technology': tech['name'],
                'code': tech['code'],
                'sessions': sum(
                    1
                    for session in sessions
                    if getattr(getattr(session, 'workflow', None), 'technology', None)
                    and session.workflow.technology.code == tech['code']
                ),
            }
            for tech in technologies
        ],
        'programme_final_session': final_payload,
        'final_session_ready': final_ready,
        'trainer_approval_ready': bool(not blockers and not certificate and (programme is None or programme.status == 'in_progress')),
        'can_issue_certificate': bool(not blockers and not certificate and programme and programme.status == 'trainer_requested'),
        'certificate_id': certificate.certificate_id if certificate else None,
        'checklist': {
            'ready': not blockers,
            'final_session_ready': final_ready,
            'attendance_complete': bool(attendance.get('complete')),
            'quiz_complete': bool(quiz.get('complete')),
            'project_complete': bool(project.get('complete')),
            'score_eligible': overall >= service.PASS_MARK,
            'blockers': blockers,
            'attendance': attendance,
            'quiz': quiz,
            'project': project,
            'overall_score': overall,
            'assessment': assessment,
            'final_session': final_payload,
            'taught_unit_codes': sorted(taught_codes),
        },
        'policy': policy,
        'project': project,
        'quizzes': quiz,
    }


def _safe_summary(student):
    try:
        data = service.summary(student)
        # A successful summary is trusted. An empty technology list alongside
        # completed sessions is inconsistent with the certificate model, so use
        # the real-data fallback instead of silently displaying zeros.
        if service.completed_sessions(student) and not data.get('technologies'):
            return _fallback_summary(student)
        return data
    except Exception:
        logger.exception('Course completion summary failed for %s', student.student_id)
        return _fallback_summary(student)


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
    throttle_scope = "public_pdf"

    def get(self, request, certificate_id):
        certificate = Certificate.objects.filter(certificate_id__iexact=str(certificate_id).strip(), status='issued').first()
        if certificate is None:
            return _error(ValueError('No issued Pixiu Tech certificate matches this certificate ID.'), 404)
        return build_certificate_pdf(certificate)


class VerifyProgrammeCertificateView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "public_verification"

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
