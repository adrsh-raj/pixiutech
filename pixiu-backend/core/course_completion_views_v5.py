import logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset, accessible_school_queryset, accessible_student_queryset
from learning import course_completion_v5 as service
from learning.certificate_pdf import build_certificate_pdf
from learning.course_completion_models import Certificate, Technology
from learning.course_completion_v3 import evaluate_last_session as evaluate_legacy_unit_last_session
from learning.services import accessible_sessions

logger = logging.getLogger(__name__)


def _error(exc, code=400):
    return Response({'detail': str(exc)}, status=code)


def _student_for(user, key):
    qs = accessible_student_queryset(user).select_related('school_class__school')
    return qs.filter(pk=key).first() or get_object_or_404(qs, student_id__iexact=str(key).strip())


def _basic_student_row(student):
    school_class = getattr(student, 'school_class', None)
    school = getattr(school_class, 'school', None)
    pass_mark = float(getattr(service, 'PASS_MARK', 70.0))
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': school.name if school else '',
        'school_code': school.school_code if school else '',
        'class_name': school_class.display_name if school_class else '',
        'status': 'in_progress',
        'overall_score': 0,
        'score_breakdown': {'overall_score': 0, 'pass_mark': pass_mark, 'eligible': False, 'attendance_pct': None, 'quiz_pct': None, 'practical_pct': None, 'trainer_review_pct': None},
        'required_units': 0,
        'completed_units': 0,
        'units': [],
        'technologies': [],
        'sessions_by_technology': [],
        'programme_final_session': None,
        'final_session_ready': False,
        'trainer_approval_ready': False,
        'can_issue_certificate': False,
        'certificate_id': None,
        'policy': None,
    }


def _fallback_registry_row(student):
    row = _basic_student_row(student)
    pass_mark = row['score_breakdown']['pass_mark']

    try:
        technologies = service.completed_technologies(student)
    except Exception:
        technologies = []
        logger.exception('Technology fallback failed for %s', student.student_id)

    row['technologies'] = technologies
    row['sessions_by_technology'] = []
    try:
        sessions = service.completed_sessions(student)
        for technology in technologies:
            row['sessions_by_technology'].append({
                'technology': technology.get('name') or technology.get('code') or '',
                'code': technology.get('code') or '',
                'sessions': sum(
                    1 for session in sessions
                    if getattr(getattr(session, 'workflow', None), 'technology', None)
                    and session.workflow.technology.code == technology.get('code')
                ),
            })
    except Exception:
        logger.exception('Session technology fallback failed for %s', student.student_id)

    try:
        final = service.programme_final_session(student)
        if final:
            technology = getattr(getattr(final, 'workflow', None), 'technology', None)
            row['programme_final_session'] = {
                'id': str(final.id),
                'topic': final.topic,
                'date': str(final.date),
                'technology': technology.name if technology else '',
            }
            row['final_session_ready'] = True
    except Exception:
        logger.exception('Final-session fallback failed for %s', student.student_id)

    try:
        score = float(service.student_score(student))
        row['overall_score'] = score
        row['score_breakdown']['overall_score'] = score
        row['score_breakdown']['eligible'] = score >= pass_mark
    except Exception:
        logger.exception('Score fallback failed for %s', student.student_id)

    return row


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
        try:
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
            students = list(qs.order_by('school_class__school__name', 'school_class__display_name', 'roll_number', 'student_id')[:500])
        except Exception:
            logger.exception('Course completion roster query failed')
            return _error(ValueError('Unable to load the Course Completion student registry.'), 503)

        rows = []
        for student in students:
            try:
                rows.append(service.summary(student))
            except Exception:
                logger.exception('Course completion summary failed for %s', student.student_id)
                rows.append(_fallback_registry_row(student))
        return Response(rows)


class CourseCompletionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_key):
        return Response(_fallback_registry_row(_student_for(request.user, student_key)))


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
        from learning.models import Session
        session = get_object_or_404(Session.objects.select_related('school_class', 'curriculum_unit'), pk=session_id)
        if request.user.role == UserRole.TRAINER and not accessible_sessions(request.user).filter(pk=session.pk).exists():
            return _error(PermissionError('This session is outside your authorised trainer scope.'), 403)
        try:
            rows = evaluate_legacy_unit_last_session(session)
            return Response({'session_id': str(session.id), 'evaluated_students': len(rows), 'passed': sum(row.status == 'passed' for row in rows), 'failed_or_pending': sum(row.status != 'passed' for row in rows)})
        except ValueError as exc:
            return _error(exc)


class ApproveFinalProgrammeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            programme = service.approve_programme(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'pass_mark': service.PASS_MARK, 'detail': 'Final programme session approved. Certificate is ready to issue.'})
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
        certificate = Certificate.objects.filter(certificate_id__iexact=str(certificate_id).strip(), status='issued').select_related('student__school_class__school', 'school_class__school').first()
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
        certificate = Certificate.objects.filter(verification_token=token).first() if token else None
        if certificate is None and key:
            certificate = Certificate.objects.filter(certificate_id__iexact=key).first()
        if certificate is None:
            return Response({'verified': False, 'status': 'not_found', 'reason': 'No Pixiu Tech certificate matches this verification code.'}, status=404)
        return Response(service.certificate_payload(certificate))
