from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Avg, Max
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset, accessible_student_queryset
from learning import course_completion_v3 as completion_service
from learning.cohort_rank import cohort_rank
from learning.course_completion_v3 import admin_complete, certificate_payload, ensure_scope, evaluate_last_session, issue_certificate, policy_for, request_completion, serialize_policy, summary, update_policy
from learning.course_completion_models import Certificate, Technology, ProgrammeCompletion, UnitCompletion
from learning.models import AttendanceStatus, StudentAssessment, QuizAttempt
from learning.services import accessible_sessions

# Keep the legacy service helper available for older callers while making the
# module self-contained instead of depending on import-time monkey-patching.
completion_service.cohort_rank = cohort_rank


def _error(exc, code=400):
    return Response({'detail': str(exc)}, status=code)


def _student_for(user, key):
    qs = accessible_student_queryset(user).select_related('school_class__school')
    student = qs.filter(pk=key).first()
    return student or get_object_or_404(qs, student_id__iexact=str(key).strip())


def _class_for(user, key):
    qs = accessible_class_queryset(user)
    return qs.filter(pk=key).first() or get_object_or_404(qs, pk=key)


def _read_summary(student):
    """Read completion state without mutating UnitCompletion during GET."""
    units = completion_service.required_units(student)
    policy = policy_for(student.school_class)
    unit_rows = []
    passed_scores = []

    for unit in units:
        ending = completion_service.final_session(student, unit)
        sessions = completion_service.unit_sessions(student, unit)
        metrics = {
            'attendance_pct': completion_service.attendance_pct(student, sessions),
            'quiz_pct': completion_service.quiz_pct(student, unit),
            'practical_pct': completion_service.practical_pct(student, unit),
            'trainer_review_avg': completion_service.trainer_review_avg(student, unit),
        }
        criteria = completion_service.effective_criteria(unit, policy)
        reasons = []
        if ending is None:
            reasons.append('Last session for this unit has not been completed.')
        for enabled, value, threshold, label in [
            ('requires_attendance', metrics['attendance_pct'], criteria['min_attendance_pct'], 'Attendance'),
            ('requires_quiz', metrics['quiz_pct'], criteria['min_quiz_pct'], 'Quiz'),
            ('requires_practical', metrics['practical_pct'], criteria['min_practical_pct'], 'Practical'),
            ('requires_trainer_review', metrics['trainer_review_avg'], criteria['min_trainer_review_rating'], 'Trainer review'),
        ]:
            if not criteria[enabled]:
                continue
            if value is None:
                reasons.append(f'{label} is pending.')
            elif value < threshold:
                reasons.append(f'{label} is below {threshold:g}.')
        status = 'passed' if not reasons else ('failed' if ending else 'pending')
        score = completion_service.unit_score(metrics, policy, criteria)
        if status == 'passed':
            passed_scores.append(score)
        technology = completion_service.unit_technology(unit, student.school_class)
        unit_rows.append({
            'id': str(unit.id),
            'unit_code': unit.unit_code,
            'title': unit.title,
            'level': unit.level,
            'technology': {'id': str(technology.id), 'code': technology.code, 'name': technology.name} if technology else None,
            'sessions': sessions.count(),
            'status': status,
            'attendance_pct': metrics['attendance_pct'],
            'quiz_pct': metrics['quiz_pct'],
            'practical_pct': metrics['practical_pct'],
            'trainer_review_avg': metrics['trainer_review_avg'],
            'score': score,
            'reasons': reasons,
            'last_session': bool(ending),
            'completed_at': None,
            'criteria': criteria,
        })

    technology_map = {}
    for unit in units:
        technology = completion_service.unit_technology(unit, student.school_class)
        if technology:
            technology_map[technology.code] = {'id': str(technology.id), 'code': technology.code, 'name': technology.name}
    for item in completion_service.session_technologies(student, units):
        technology_map[item['code']] = item

    programme = ProgrammeCompletion.objects.filter(student=student).first()
    certificate_id = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').values_list('certificate_id', flat=True).first()
    overall_score = round(sum(passed_scores) / len(passed_scores), 2) if passed_scores else 0
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'status': programme.status if programme else 'in_progress',
        'required_units': len(units),
        'completed_units': len(passed_scores),
        'overall_score': overall_score,
        'rank': cohort_rank(student),
        'policy': serialize_policy(policy),
        'technologies': list(technology_map.values()),
        'units': unit_rows,
        'sessions_by_technology': completion_service.session_counts_by_technology(student, units),
        'trainer_requested_at': programme.requested_at.isoformat() if programme and programme.requested_at else None,
        'admin_completed_at': programme.completed_at.isoformat() if programme and programme.completed_at else None,
        'certificate_id': certificate_id,
    }


def _summary_for_request(student):
    try:
        return _read_summary(student)
    except Exception:
        # Fallback to the persisted completion ledger so one malformed legacy
        # record cannot turn the entire completion registry into HTTP 500.
        return _read_summary_from_ledger(student)


def _read_summary_from_ledger(student):
    units = completion_service.required_units(student)
    policy = policy_for(student.school_class)
    rows = []
    passed_scores = []
    for unit in units:
        completion = UnitCompletion.objects.filter(student=student, curriculum_unit=unit).first()
        technology = completion_service.unit_technology(unit, student.school_class)
        if completion:
            status = completion.status
            score = float(completion.score)
            metrics = {
                'attendance_pct': float(completion.attendance_pct),
                'quiz_pct': float(completion.quiz_pct) if completion.quiz_pct is not None else None,
                'practical_pct': float(completion.practical_pct) if completion.practical_pct is not None else None,
                'trainer_review_avg': float(completion.trainer_review_avg) if completion.trainer_review_avg is not None else None,
            }
            reasons = completion.reasons or []
            last_session = bool(completion.final_session_id)
            completed_at = completion.completed_at.isoformat() if completion.completed_at else None
        else:
            status = 'pending'
            score = 0
            metrics = {'attendance_pct': 0, 'quiz_pct': None, 'practical_pct': None, 'trainer_review_avg': None}
            reasons = ['Unit has not been evaluated yet.']
            last_session = False
            completed_at = None
        if status == 'passed':
            passed_scores.append(score)
        rows.append({
            'id': str(unit.id), 'unit_code': unit.unit_code, 'title': unit.title, 'level': unit.level,
            'technology': {'id': str(technology.id), 'code': technology.code, 'name': technology.name} if technology else None,
            'sessions': completion_service.unit_sessions(student, unit).count(), 'status': status,
            **metrics, 'score': score, 'reasons': reasons, 'last_session': last_session,
            'completed_at': completed_at, 'criteria': completion_service.effective_criteria(unit, policy),
        })
    programme = ProgrammeCompletion.objects.filter(student=student).first()
    technologies = {}
    for item in completion_service.session_technologies(student, units):
        technologies[item['code']] = item
    for unit in units:
        technology = completion_service.unit_technology(unit, student.school_class)
        if technology: technologies[technology.code] = {'id': str(technology.id), 'code': technology.code, 'name': technology.name}
    certificate_id = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').values_list('certificate_id', flat=True).first()
    return {
        'student_id': student.student_id, 'student_name': student.name,
        'school_name': student.school_class.school.name, 'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name, 'status': programme.status if programme else 'in_progress',
        'required_units': len(units), 'completed_units': len(passed_scores),
        'overall_score': round(sum(passed_scores) / len(passed_scores), 2) if passed_scores else 0,
        'rank': cohort_rank(student), 'policy': serialize_policy(policy), 'technologies': list(technologies.values()),
        'units': rows, 'sessions_by_technology': completion_service.session_counts_by_technology(student, units),
        'trainer_requested_at': programme.requested_at.isoformat() if programme and programme.requested_at else None,
        'admin_completed_at': programme.completed_at.isoformat() if programme and programme.completed_at else None,
        'certificate_id': certificate_id,
    }


class TechnologyListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(list(Technology.objects.filter(active=True).values('id', 'code', 'name', 'sort_order')))
    def post(self, request):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can manage the technology catalogue.'), 403)
        name = str(request.data.get('name') or '').strip()
        code = str(request.data.get('code') or name).strip().lower().replace(' ', '-')
        if not name or not code: return _error(ValueError('Technology name is required.'))
        raw_active = request.data.get('active', True)
        active = raw_active if isinstance(raw_active, bool) else str(raw_active).strip().lower() not in {'false', '0', 'no', 'off'}
        try: sort_order = int(request.data.get('sort_order') or 0)
        except (TypeError, ValueError): sort_order = 0
        technology, created = Technology.objects.get_or_create(code=code, defaults={'name': name, 'sort_order': sort_order, 'active': active})
        if not created:
            technology.name, technology.sort_order, technology.active = name, sort_order, active
            technology.save(update_fields=['name', 'sort_order', 'active', 'updated_at'])
        return Response({'id': str(technology.id), 'code': technology.code, 'name': technology.name, 'sort_order': technology.sort_order, 'active': technology.active}, status=201 if created else 200)


class CourseCompletionListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        students = accessible_student_queryset(request.user).select_related('school_class__school').filter(status='active')[:500]
        return Response([_summary_for_request(student) for student in students])


class CourseCompletionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, student_key):
        student = _student_for(request.user, student_key)
        return Response(_summary_for_request(student))


class CompletionPolicyView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, class_key):
        school_class = _class_for(request.user, class_key)
        try: ensure_scope(request.user, school_class.students.first())
        except AttributeError: pass
        return Response(serialize_policy(policy_for(school_class)))
    def put(self, request, class_key):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can edit completion criteria.'), 403)
        school_class = get_object_or_404(SchoolClass, pk=class_key)
        try: return Response(serialize_policy(update_policy(school_class, request.data)))
        except (TypeError, ValueError) as exc: return _error(exc)


class EvaluateLastSessionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, session_id):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}: return _error(PermissionError('Only trainers and administrators can evaluate a unit.'), 403)
        from learning.models import Session
        session = get_object_or_404(Session.objects.select_related('school_class', 'curriculum_unit'), pk=session_id)
        if request.user.role == UserRole.TRAINER and not accessible_sessions(request.user).filter(pk=session.pk).exists():
            return _error(PermissionError('This session is outside your authorised trainer scope.'), 403)
        try:
            rows = evaluate_last_session(session)
            return Response({'session_id': str(session.id), 'unit_code': session.curriculum_unit.unit_code, 'evaluated_students': len(rows), 'passed': sum(row.status == 'passed' for row in rows), 'failed_or_pending': sum(row.status != 'passed' for row in rows)})
        except ValueError as exc: return _error(exc)


class RequestProgrammeCompletionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            programme = request_completion(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'detail': 'Course completion requested from Admin.'})
        except PermissionError as exc: return _error(exc, 403)
        except ValueError as exc: return _error(exc)


class AdminCompleteProgrammeView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        if request.user.role != UserRole.ADMIN: return _error(PermissionError('Only administrators can mark a programme completed.'), 403)
        student = _student_for(request.user, student_key)
        try:
            programme = admin_complete(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'detail': 'Programme marked completed.'})
        except ValueError as exc: return _error(exc)


class IssueProgrammeCertificateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try: return Response(certificate_payload(issue_certificate(request.user, student)))
        except PermissionError as exc: return _error(exc, 403)
        except ValueError as exc: return _error(exc)


class VerifyProgrammeCertificateView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, student_id=None):
        if student_id:
            return Response({'verified': False, 'status': 'legacy_not_supported', 'reason': 'Student ID verification is disabled. Use the certificate ID or QR verification link.'}, status=410)
        key = str(request.query_params.get('certificate') or request.query_params.get('cert') or '').strip()
        token = str(request.query_params.get('token') or '').strip()
        if not key and not token:
            return Response({'verified': False, 'status': 'invalid_request', 'reason': 'Certificate ID or verification token is required.'}, status=400)
        certificate = Certificate.objects.filter(verification_token=token).first() if token else None
        if certificate is None and key:
            certificate = Certificate.objects.filter(certificate_id__iexact=key).first()
        if certificate is not None:
            payload = certificate_payload(certificate)
            payload.pop('verification_token', None)
            payload.pop('rank_portal', None)
            return Response(payload, status=200)
        return Response({'verified': False, 'status': 'not_found', 'reason': 'No Pixiu Tech certificate matches this verification code.'}, status=404)
