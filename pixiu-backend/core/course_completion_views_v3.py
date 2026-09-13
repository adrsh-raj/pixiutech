import logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset, accessible_student_queryset
from learning import course_completion_v3 as completion_service
from learning.cohort_rank import cohort_rank
from learning.course_completion_v3 import (
    admin_complete,
    certificate_payload,
    ensure_scope,
    evaluate_last_session,
    issue_certificate,
    policy_for,
    request_completion,
    serialize_policy,
    summary,
    update_policy,
)
from learning.course_completion_models import Certificate, CompletionPolicy, CurriculumUnitProfile, ProgrammeCompletion, SessionWorkflow, Technology, UnitCompletion
from learning.models import CurriculumClassAssignment
from learning.services import accessible_sessions

logger = logging.getLogger(__name__)

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
    """Read one student's live completion state without mutating the ledger."""
    return summary(student)


def _summary_for_request(student):
    try:
        return _read_summary(student)
    except Exception:
        logger.exception('Live course-completion summary failed for student %s', getattr(student, 'student_id', student.pk))
        try:
            return _read_summary_from_ledger(student)
        except Exception:
            logger.exception('Ledger course-completion fallback failed for student %s', getattr(student, 'student_id', student.pk))
            return _safe_minimal_student_summary(student)


def _read_summary_from_ledger(student):
    units = completion_service.required_units(student)
    policy = policy_for(student.school_class)
    rows = []
    passed_scores = []
    for unit in units:
        completion = UnitCompletion.objects.filter(student=student, curriculum_unit=unit).select_related('curriculum_unit').first()
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
            status, score = 'pending', 0
            metrics = {'attendance_pct': 0, 'quiz_pct': None, 'practical_pct': None, 'trainer_review_avg': None}
            reasons = ['Unit has not been evaluated yet.']
            last_session, completed_at = False, None
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
        if technology:
            technologies[technology.code] = {'id': str(technology.id), 'code': technology.code, 'name': technology.name}
    certificate_id = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').values_list('certificate_id', flat=True).first()
    return {
        'student_id': student.student_id, 'student_name': student.name,
        'school_name': student.school_class.school.name, 'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name, 'status': programme.status if programme else 'in_progress',
        'required_units': len(units), 'completed_units': len(passed_scores),
        'overall_score': round(sum(passed_scores) / len(passed_scores), 2) if passed_scores else 0,
        'rank': cohort_rank(student), 'policy': serialize_policy(policy), 'technologies': list(technologies.values()),
        'units': rows,
        'sessions_by_technology': completion_service.session_counts_by_technology(student, units),
        'trainer_requested_at': programme.requested_at.isoformat() if programme and programme.requested_at else None,
        'admin_completed_at': programme.completed_at.isoformat() if programme and programme.completed_at else None,
        'certificate_id': certificate_id,
    }


def _safe_minimal_student_summary(student):
    """Last-resort 200-safe payload: no completion calculation can break the registry."""
    school = getattr(getattr(student, 'school_class', None), 'school', None)
    school_class = getattr(student, 'school_class', None)
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': getattr(school, 'name', ''),
        'school_code': getattr(school, 'school_code', ''),
        'class_name': getattr(school_class, 'display_name', ''),
        'status': 'in_progress',
        'required_units': 0,
        'completed_units': 0,
        'overall_score': 0,
        'rank': None,
        'policy': None,
        'technologies': [],
        'units': [],
        'sessions_by_technology': [],
        'trainer_requested_at': None,
        'admin_completed_at': None,
        'certificate_id': None,
    }


def _list_rows(user):
    students = list(
        accessible_student_queryset(user)
        .select_related('school_class__school')
        .filter(status='active')[:500]
    )
    if not students:
        return []

    student_ids = [student.id for student in students]
    class_ids = sorted({student.school_class_id for student in students})
    assignments = list(
        CurriculumClassAssignment.objects
        .filter(school_class_id__in=class_ids, curriculum_unit__status='published')
        .select_related('curriculum_unit__completion_profile__technology')
        .order_by('school_class_id', 'curriculum_unit__unit_code')
    )
    units_by_class = {}
    unit_ids = []
    for assignment in assignments:
        units_by_class.setdefault(assignment.school_class_id, []).append(assignment.curriculum_unit)
        unit_ids.append(assignment.curriculum_unit_id)

    completions = list(
        UnitCompletion.objects
        .filter(student_id__in=student_ids, curriculum_unit_id__in=set(unit_ids) if unit_ids else [])
        .only('student_id', 'curriculum_unit_id', 'status', 'score')
    )
    completion_map = {(row.student_id, row.curriculum_unit_id): row for row in completions}

    programmes = list(
        ProgrammeCompletion.objects
        .filter(student_id__in=student_ids)
        .only('student_id', 'status', 'overall_score')
    )
    programme_map = {row.student_id: row for row in programmes}

    certificates = list(
        Certificate.objects
        .filter(student_id__in=student_ids, status='issued')
        .only('student_id', 'certificate_id')
        .order_by('-issued_at')
    )
    certificate_map = {}
    for row in certificates:
        certificate_map.setdefault(row.student_id, row.certificate_id)

    workflows = list(
        SessionWorkflow.objects
        .filter(session__school_class_id__in=class_ids, session__curriculum_unit_id__in=set(unit_ids) if unit_ids else [])
        .select_related('technology')
        .exclude(session__status='cancelled')
    )
    tech_counts_by_class = {}
    for workflow in workflows:
        bucket = tech_counts_by_class.setdefault(workflow.session.school_class_id, {})
        code = workflow.technology.code
        item = bucket.setdefault(code, {'id': str(workflow.technology_id), 'code': code, 'name': workflow.technology.name, 'sessions': 0})
        item['sessions'] += 1

    global_policy = CompletionPolicy.objects.filter(school_class__isnull=True, active=True).first()
    class_policies = {
        row.school_class_id: row
        for row in CompletionPolicy.objects.filter(school_class_id__in=class_ids, active=True)
    }

    programme_scores_by_class = {}
    for student in students:
        programme = programme_map.get(student.id)
        if programme:
            programme_scores_by_class.setdefault(student.school_class_id, []).append((student.id, float(programme.overall_score)))
    rank_map = {}
    for class_id, scores in programme_scores_by_class.items():
        ordered = sorted(scores, key=lambda item: (-item[1], str(item[0])))
        rank_map.update({student_id: index for index, (student_id, _) in enumerate(ordered, 1)})

    rows = []
    for student in students:
        units = units_by_class.get(student.school_class_id, [])
        passed = [
            completion_map[(student.id, unit.id)]
            for unit in units
            if (student.id, unit.id) in completion_map and completion_map[(student.id, unit.id)].status == 'passed'
        ]
        programme = programme_map.get(student.id)
        technologies = dict(tech_counts_by_class.get(student.school_class_id, {}))
        if not technologies:
            for unit in units:
                profile = getattr(unit, 'completion_profile', None)
                technology = getattr(profile, 'technology', None)
                if technology:
                    technologies[technology.code] = {'id': str(technology.id), 'code': technology.code, 'name': technology.name, 'sessions': 0}
        rows.append({
            'student_id': student.student_id,
            'student_name': student.name,
            'school_name': student.school_class.school.name,
            'school_code': student.school_class.school.school_code,
            'class_name': student.school_class.display_name,
            'status': programme.status if programme else 'in_progress',
            'required_units': len(units),
            'completed_units': len(passed),
            'overall_score': float(programme.overall_score) if programme else (round(sum(float(row.score) for row in passed) / len(passed), 2) if passed else 0),
            'rank': rank_map.get(student.id),
            'policy': serialize_policy(class_policies.get(student.school_class_id) or global_policy) if (class_policies.get(student.school_class_id) or global_policy) else None,
            'technologies': list(technologies.values()),
            'units': [],
            'sessions_by_technology': [
                {'technology': item['name'], 'sessions': item['sessions'], 'code': item['code']}
                for item in technologies.values()
            ],
            'trainer_requested_at': programme.requested_at.isoformat() if programme and programme.requested_at else None,
            'admin_completed_at': programme.completed_at.isoformat() if programme and programme.completed_at else None,
            'certificate_id': certificate_map.get(student.id),
        })
    return rows


def _list_rows_safe(user):
    try:
        return _list_rows(user)
    except Exception:
        logger.exception('Course-completion registry failed during optimized aggregation')
        try:
            return [_safe_minimal_student_summary(student) for student in accessible_student_queryset(user).select_related('school_class__school').filter(status='active')[:500]]
        except Exception:
            logger.exception('Course-completion minimal registry fallback failed')
            return []


class TechnologyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(list(Technology.objects.filter(active=True).values('id', 'code', 'name', 'sort_order')))

    def post(self, request):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can manage the technology catalogue.'), 403)
        name = str(request.data.get('name') or '').strip()
        code = str(request.data.get('code') or name).strip().lower().replace(' ', '-')
        if not name or not code:
            return _error(ValueError('Technology name is required.'))
        raw_active = request.data.get('active', True)
        active = raw_active if isinstance(raw_active, bool) else str(raw_active).strip().lower() not in {'false', '0', 'no', 'off'}
        try:
            sort_order = int(request.data.get('sort_order') or 0)
        except (TypeError, ValueError):
            sort_order = 0
        technology, created = Technology.objects.get_or_create(code=code, defaults={'name': name, 'sort_order': sort_order, 'active': active})
        if not created:
            technology.name, technology.sort_order, technology.active = name, sort_order, active
            technology.save(update_fields=['name', 'sort_order', 'active', 'updated_at'])
        return Response({'id': str(technology.id), 'code': technology.code, 'name': technology.name, 'sort_order': technology.sort_order, 'active': technology.active}, status=201 if created else 200)


class CourseCompletionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_list_rows_safe(request.user))


class CourseCompletionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_key):
        student = _student_for(request.user, student_key)
        return Response(_summary_for_request(student))


class CompletionPolicyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, class_key):
        school_class = _class_for(request.user, class_key)
        first_student = school_class.students.first()
        if first_student:
            try:
                ensure_scope(request.user, first_student)
            except PermissionError:
                return _error(PermissionError('Class is outside your authorised scope.'), 403)
        return Response(serialize_policy(policy_for(school_class)))

    def put(self, request, class_key):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can edit completion criteria.'), 403)
        school_class = get_object_or_404(SchoolClass, pk=class_key)
        try:
            return Response(serialize_policy(update_policy(school_class, request.data)))
        except (TypeError, ValueError) as exc:
            return _error(exc)


class EvaluateLastSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            return _error(PermissionError('Only trainers and administrators can evaluate a unit.'), 403)
        from learning.models import Session
        session = get_object_or_404(Session.objects.select_related('school_class', 'curriculum_unit'), pk=session_id)
        if request.user.role == UserRole.TRAINER and not accessible_sessions(request.user).filter(pk=session.pk).exists():
            return _error(PermissionError('This session is outside your authorised trainer scope.'), 403)
        try:
            rows = evaluate_last_session(session)
            return Response({
                'session_id': str(session.id),
                'unit_code': session.curriculum_unit.unit_code,
                'evaluated_students': len(rows),
                'passed': sum(row.status == 'passed' for row in rows),
                'failed_or_pending': sum(row.status != 'passed' for row in rows),
            })
        except ValueError as exc:
            return _error(exc)


class RequestProgrammeCompletionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            programme = request_completion(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'detail': 'Course completion requested from Admin.'})
        except PermissionError as exc:
            return _error(exc, 403)
        except ValueError as exc:
            return _error(exc)


class AdminCompleteProgrammeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_key):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can mark a programme completed.'), 403)
        student = _student_for(request.user, student_key)
        try:
            programme = admin_complete(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'detail': 'Programme marked completed.'})
        except PermissionError as exc:
            return _error(exc, 403)
        except ValueError as exc:
            return _error(exc)


class IssueProgrammeCertificateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            return Response(certificate_payload(issue_certificate(request.user, student)))
        except PermissionError as exc:
            return _error(exc, 403)
        except ValueError as exc:
            return _error(exc)


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
