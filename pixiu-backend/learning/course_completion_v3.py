from urllib.parse import quote
import uuid

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Max
from django.utils import timezone

from accounts.models import UserRole
from academics.models import Student, TrainerSchoolAssignment
from audit.models import AuditAction, AuditLog
from .models import AttendanceStatus, AssessmentStatus, CurriculumClassAssignment, Quiz, QuizAttempt, Session, StudentAssessment
from .course_completion_models import Certificate, CompletionPolicy, ProgrammeCompletion, SessionWorkflow, Technology, UnitCompletion

ISSUER_ROLES = {UserRole.TRAINER}


def _bool(value):
    if isinstance(value, bool):
        return value
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


def serialize_policy(policy):
    return {
        'id': policy.id,
        'name': policy.name,
        'school_class_id': str(policy.school_class_id) if policy.school_class_id else None,
        'requires_attendance': bool(policy.requires_attendance),
        'min_attendance_pct': float(policy.min_attendance_pct),
        'requires_quiz': bool(policy.requires_quiz),
        'min_quiz_pct': float(policy.min_quiz_pct),
        'requires_practical': bool(policy.requires_practical),
        'min_practical_pct': float(policy.min_practical_pct),
        'requires_trainer_review': bool(policy.requires_trainer_review),
        'min_trainer_review_rating': float(policy.min_trainer_review_rating),
        'weight_practical': float(policy.weight_practical),
        'weight_quiz': float(policy.weight_quiz),
        'weight_attendance': float(policy.weight_attendance),
        'weight_trainer_review': float(policy.weight_trainer_review),
        'active': bool(policy.active),
    }


def policy_for(school_class):
    return (
        CompletionPolicy.objects.filter(school_class=school_class, active=True).first()
        or CompletionPolicy.objects.filter(school_class__isnull=True, active=True).first()
        or CompletionPolicy.objects.create(school_class=None, name='Standard Pixiu completion policy')
    )


def update_policy(school_class, data):
    policy = CompletionPolicy.objects.filter(school_class=school_class).first()
    if policy is None:
        policy = CompletionPolicy.objects.create(school_class=school_class, name='Class completion policy')
    for field in {'requires_attendance', 'requires_quiz', 'requires_practical', 'requires_trainer_review', 'active'}:
        if field in data:
            setattr(policy, field, _bool(data[field]))
    if 'name' in data and str(data['name']).strip():
        policy.name = str(data['name']).strip()[:160]
    ranges = {
        'min_attendance_pct': (0, 100),
        'min_quiz_pct': (0, 100),
        'min_practical_pct': (0, 100),
        'min_trainer_review_rating': (0, 5),
        'weight_practical': (0, 100),
        'weight_quiz': (0, 100),
        'weight_attendance': (0, 100),
        'weight_trainer_review': (0, 100),
    }
    for field, (lo, hi) in ranges.items():
        if field in data:
            try:
                value = float(data[field])
            except (TypeError, ValueError):
                raise ValueError(f'{field} must be numeric.')
            if not lo <= value <= hi:
                raise ValueError(f'{field} must be between {lo} and {hi}.')
            setattr(policy, field, value)
    weights = sum(float(getattr(policy, field)) for field in ('weight_practical', 'weight_quiz', 'weight_attendance', 'weight_trainer_review'))
    if weights <= 0:
        raise ValueError('At least one scoring weight must be greater than zero.')
    policy.save()
    return policy


def required_units(student):
    assignments = (
        CurriculumClassAssignment.objects
        .filter(school_class=student.school_class, curriculum_unit__status='published')
        .select_related('curriculum_unit', 'curriculum_unit__completion_profile__technology')
        .order_by('curriculum_unit__unit_code')
    )
    units = []
    for assignment in assignments:
        profile = getattr(assignment.curriculum_unit, 'completion_profile', None)
        if profile is None or profile.certificate_required:
            units.append(assignment.curriculum_unit)
    return units


def unit_sessions(student, unit):
    return Session.objects.filter(
        school_class=student.school_class,
        curriculum_unit=unit,
        status='completed',
    ).order_by('date', 'start_time')


def final_session(student, unit):
    return (
        Session.objects
        .filter(school_class=student.school_class, curriculum_unit=unit, status='completed', workflow__is_last_session_for_unit=True)
        .order_by('-date', '-start_time', '-id')
        .first()
    )


def attendance_pct(student, sessions):
    total = sessions.count()
    if not total:
        return None
    attended = student.attendance_records.filter(
        session__in=sessions,
        status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED],
    ).count()
    return round(attended * 100 / total, 2)


def quiz_pct(student, unit):
    quiz_ids = Quiz.objects.filter(
        unit_code__iexact=unit.unit_code,
        class_assignments__school_class=student.school_class,
    ).values_list('id', flat=True)
    value = QuizAttempt.objects.filter(
        student=student,
        quiz_id__in=quiz_ids,
        status='completed',
    ).aggregate(best=Max('percentage'))['best']
    return float(value) if value is not None else None


def practical_pct(student, unit):
    values = list(
        StudentAssessment.objects.filter(
            student=student,
            unit_code__iexact=unit.unit_code,
            status=AssessmentStatus.PUBLISHED,
            score__isnull=False,
        ).values_list('score', flat=True)
    )
    return round(sum(float(value) for value in values) / len(values), 2) if values else None


def trainer_review_avg(student, unit):
    value = StudentAssessment.objects.filter(
        student=student,
        unit_code__iexact=unit.unit_code,
        status=AssessmentStatus.PUBLISHED,
        rating__isnull=False,
    ).aggregate(value=Avg('rating'))['value']
    return round(float(value), 2) if value is not None else None


def effective_criteria(unit, policy):
    profile = getattr(unit, 'completion_profile', None)
    if profile is None:
        return {
            'requires_attendance': bool(policy.requires_attendance),
            'min_attendance_pct': float(policy.min_attendance_pct),
            'requires_quiz': bool(policy.requires_quiz),
            'min_quiz_pct': float(policy.min_quiz_pct),
            'requires_practical': bool(policy.requires_practical),
            'min_practical_pct': float(policy.min_practical_pct),
            'requires_trainer_review': bool(policy.requires_trainer_review),
            'min_trainer_review_rating': float(policy.min_trainer_review_rating),
        }
    return {
        'requires_attendance': bool(policy.requires_attendance) if profile.requires_attendance is None else bool(profile.requires_attendance),
        'min_attendance_pct': float(policy.min_attendance_pct) if profile.min_attendance_pct is None else float(profile.min_attendance_pct),
        'requires_quiz': bool(policy.requires_quiz) if profile.requires_quiz is None else bool(profile.requires_quiz),
        'min_quiz_pct': float(policy.min_quiz_pct) if profile.min_quiz_pct is None else float(profile.min_quiz_pct),
        'requires_practical': bool(policy.requires_practical) if profile.requires_practical is None else bool(profile.requires_practical),
        'min_practical_pct': float(policy.min_practical_pct) if profile.min_practical_pct is None else float(profile.min_practical_pct),
        'requires_trainer_review': bool(policy.requires_trainer_review) if profile.requires_trainer_review is None else bool(profile.requires_trainer_review),
        'min_trainer_review_rating': float(policy.min_trainer_review_rating) if profile.min_trainer_review_rating is None else float(profile.min_trainer_review_rating),
    }


def unit_score(metrics, policy, criteria):
    values = []
    if criteria['requires_practical'] and metrics['practical_pct'] is not None:
        values.append((metrics['practical_pct'], float(policy.weight_practical)))
    if criteria['requires_quiz'] and metrics['quiz_pct'] is not None:
        values.append((metrics['quiz_pct'], float(policy.weight_quiz)))
    if criteria['requires_attendance'] and metrics['attendance_pct'] is not None:
        values.append((metrics['attendance_pct'], float(policy.weight_attendance)))
    if criteria['requires_trainer_review'] and metrics['trainer_review_avg'] is not None:
        values.append((metrics['trainer_review_avg'] * 20, float(policy.weight_trainer_review)))
    total_weight = sum(weight for _, weight in values)
    return round(sum(value * weight for value, weight in values) / total_weight, 2) if total_weight else 0


def evaluate_unit(student, unit, force_final_session=None):
    policy = policy_for(student.school_class)
    criteria = effective_criteria(unit, policy)
    ending = force_final_session or final_session(student, unit)
    sessions = unit_sessions(student, unit)
    metrics = {
        'attendance_pct': attendance_pct(student, sessions),
        'quiz_pct': quiz_pct(student, unit),
        'practical_pct': practical_pct(student, unit),
        'trainer_review_avg': trainer_review_avg(student, unit),
    }
    reasons = []
    if ending is None:
        reasons.append('Last session for this unit has not been completed.')
    checks = [
        ('requires_attendance', metrics['attendance_pct'], criteria['min_attendance_pct'], 'Attendance'),
        ('requires_quiz', metrics['quiz_pct'], criteria['min_quiz_pct'], 'Quiz'),
        ('requires_practical', metrics['practical_pct'], criteria['min_practical_pct'], 'Practical'),
        ('requires_trainer_review', metrics['trainer_review_avg'], criteria['min_trainer_review_rating'], 'Trainer review'),
    ]
    for enabled, value, threshold, label in checks:
        if not criteria[enabled]:
            continue
        if value is None:
            reasons.append(f'{label} is pending.')
        elif value < threshold:
            reasons.append(f'{label} is below {threshold:g}.')
    passed = not reasons
    row, _ = UnitCompletion.objects.update_or_create(
        student=student,
        curriculum_unit=unit,
        defaults={
            'final_session': ending,
            'status': 'passed' if passed else ('failed' if ending else 'pending'),
            'attendance_pct': metrics['attendance_pct'] or 0,
            'quiz_pct': metrics['quiz_pct'],
            'practical_pct': metrics['practical_pct'],
            'trainer_review_avg': metrics['trainer_review_avg'],
            'score': unit_score(metrics, policy, criteria),
            'reasons': reasons,
            'completed_at': timezone.now() if passed else None,
        },
    )
    return row


def evaluate_last_session(session):
    workflow = SessionWorkflow.objects.filter(session=session).first()
    if not workflow or not workflow.is_last_session_for_unit:
        raise ValueError('This session is not marked as the last session for a unit.')
    if session.status != 'completed' or not session.curriculum_unit_id:
        raise ValueError('Complete the last session before evaluating the unit.')
    students = Student.objects.filter(school_class=session.school_class, status='active').order_by('roll_number', 'student_id')
    return [evaluate_unit(student, session.curriculum_unit, session) for student in students]


def programme_state(student):
    units = required_units(student)
    completions = [evaluate_unit(student, unit) for unit in units]
    passed = [row for row in completions if row.status == 'passed']
    overall_score = round(sum(float(row.score) for row in passed) / len(passed), 2) if passed else 0
    return units, completions, overall_score


def unit_technology(unit, school_class):
    profile = getattr(unit, 'completion_profile', None)
    if profile and profile.technology_id:
        return profile.technology
    workflow = (
        SessionWorkflow.objects
        .filter(session__school_class=school_class, session__curriculum_unit=unit, session__status='completed')
        .select_related('technology')
        .order_by('-session__date', '-session__start_time', '-session__id')
        .first()
    )
    return workflow.technology if workflow else None


def cohort_rank(student):
    ranked = []
    people = Student.objects.filter(school_class=student.school_class, status='active').order_by('student_id')
    for person in people:
        units, completions, score = programme_state(person)
        if units and all(row.status == 'passed' for row in completions):
            completed_at = max((row.completed_at for row in completions if row.completed_at), default=timezone.now())
            ranked.append((person.pk, score, completed_at, str(person.student_id)))
    ranked.sort(key=lambda row: (-row[1], row[2], row[3]))
    for position, row in enumerate(ranked, 1):
        if row[0] == student.pk:
            return position
    return None


def summary(student):
    units, completions, overall_score = programme_state(student)
    policy = policy_for(student.school_class)
    technology_map = {}
    unit_rows = []
    for unit, completion in zip(units, completions):
        technology = unit_technology(unit, student.school_class)
        technology_payload = None
        if technology:
            technology_payload = {'id': str(technology.id), 'code': technology.code, 'name': technology.name}
            technology_map[technology.code] = technology_payload
        unit_rows.append({
            'id': str(unit.id),
            'unit_code': unit.unit_code,
            'title': unit.title,
            'level': unit.level,
            'technology': technology_payload,
            'sessions': Session.objects.filter(school_class=student.school_class, curriculum_unit=unit).exclude(status='cancelled').count(),
            'status': completion.status,
            'attendance_pct': float(completion.attendance_pct),
            'quiz_pct': float(completion.quiz_pct) if completion.quiz_pct is not None else None,
            'practical_pct': float(completion.practical_pct) if completion.practical_pct is not None else None,
            'trainer_review_avg': float(completion.trainer_review_avg) if completion.trainer_review_avg is not None else None,
            'score': float(completion.score),
            'reasons': completion.reasons or [],
            'last_session': bool(completion.final_session_id),
            'completed_at': completion.completed_at.isoformat() if completion.completed_at else None,
        })
    programme = ProgrammeCompletion.objects.filter(student=student).first()
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'status': programme.status if programme else 'in_progress',
        'required_units': len(units),
        'completed_units': sum(row.status == 'passed' for row in completions),
        'overall_score': overall_score,
        'rank': cohort_rank(student),
        'policy': serialize_policy(policy),
        'technologies': list(technology_map.values()),
        'units': unit_rows,
        'sessions_by_technology': [
            {
                'technology': item['name'],
                'sessions': SessionWorkflow.objects.filter(
                    technology_id=item['id'],
                    session__school_class=student.school_class,
                ).exclude(session__status='cancelled').count(),
            }
            for item in technology_map.values()
        ],
        'trainer_requested_at': programme.requested_at.isoformat() if programme and programme.requested_at else None,
        'admin_completed_at': programme.completed_at.isoformat() if programme and programme.completed_at else None,
        'certificate_id': Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').values_list('certificate_id', flat=True).first(),
    }


def ensure_scope(user, student):
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.TRAINER and TrainerSchoolAssignment.objects.filter(
        trainer__account=user,
        school=student.school_class.school,
        status='active',
    ).exists():
        return
    raise PermissionError('Student is outside your authorised school scope.')


def request_completion(user, student):
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only a trainer can request programme completion.')
    ensure_scope(user, student)
    units, completions, score = programme_state(student)
    missing = [unit.unit_code for unit, row in zip(units, completions) if row.status != 'passed']
    if not units:
        raise ValueError('No published certificate-required curriculum units are assigned to this class.')
    if missing:
        raise ValueError(f'Programme is not ready. Pending units: {", ".join(missing)}.')
    programme, _ = ProgrammeCompletion.objects.get_or_create(student=student)
    if programme.status == 'admin_completed':
        raise ValueError('Programme is already completed by Admin.')
    programme.status = 'trainer_requested'
    programme.overall_score = score
    programme.requested_by = user
    programme.requested_at = timezone.now()
    programme.save(update_fields=['status', 'overall_score', 'requested_by', 'requested_at', 'updated_at'])
    return programme


def admin_complete(user, student):
    if user.role != UserRole.ADMIN:
        raise PermissionError('Only administrators can mark the programme completed.')
    units, completions, score = programme_state(student)
    missing = [unit.unit_code for unit, row in zip(units, completions) if row.status != 'passed']
    if not units:
        raise ValueError('No published certificate-required curriculum units are assigned to this class.')
    if missing:
        raise ValueError(f'Programme cannot be completed. Pending units: {", ".join(missing)}.')
    programme = ProgrammeCompletion.objects.filter(student=student).first()
    if programme is None or programme.status != 'trainer_requested':
        raise ValueError('Trainer must request programme completion before Admin can mark it completed.')
    programme.status = 'admin_completed'
    programme.overall_score = score
    programme.completed_by = user
    programme.completed_at = timezone.now()
    programme.save(update_fields=['status', 'overall_score', 'completed_by', 'completed_at', 'updated_at'])
    AuditLog.objects.create(
        actor=user,
        action=AuditAction.OTHER,
        entity_type='programme_completion',
        entity_id=str(student.pk),
        summary=f'Programme completion approved for {student.student_id}.',
        changes={'student_id': student.student_id, 'overall_score': score, 'required_units': len(units)},
    )
    return programme


def issue_certificate(user, student):
    if user.role not in ISSUER_ROLES:
        raise PermissionError('Only the authorised trainer can issue the final certificate.')
    ensure_scope(user, student)
    if not ProgrammeCompletion.objects.filter(student=student, status='admin_completed').exists():
        raise ValueError('Admin must mark the programme completed before certificate issuance.')
    existing = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    if existing:
        return existing
    units, completions, score = programme_state(student)
    ranked = cohort_rank(student)
    technology_snapshot = []
    unit_snapshot = []
    seen = set()
    for unit, completion in zip(units, completions):
        technology = unit_technology(unit, student.school_class)
        if technology and technology.code not in seen:
            technology_snapshot.append({'code': technology.code, 'name': technology.name})
            seen.add(technology.code)
        unit_snapshot.append({
            'unit_code': unit.unit_code,
            'title': unit.title,
            'level': unit.level,
            'technology': technology.name if technology else '',
            'sessions': Session.objects.filter(school_class=student.school_class, curriculum_unit=unit).exclude(status='cancelled').count(),
            'score': float(completion.score),
        })
    cert_id = f"PX-{student.school_class.school.school_code}-{str(student.student_id).replace(' ', '')}-{timezone.localdate().year}-{uuid.uuid4().hex[:6].upper()}"
    origin = str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')
    verify_url = f"{origin}/verify?cert={quote(cert_id)}"
    rank_printed = bool(ranked and ranked <= 10)
    issued_at = timezone.now()
    snapshot = {
        'certificate_id': cert_id,
        'certificate_ref': cert_id,
        'verification_url': verify_url,
        'verified': True,
        'issued': True,
        'status': 'verified',
        'student_name': student.name,
        'student_id': student.student_id,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'current_level': student.current_level,
        'technologies': technology_snapshot,
        'completed_technologies': technology_snapshot,
        'units': unit_snapshot,
        'overall_score': score,
        'rank': ranked if rank_printed else None,
        'rank_portal': ranked,
        'completion_count': sum(row.status == 'passed' for row in completions),
        'required_completion_count': len(units),
        'issued_by': user.display_name or user.username,
        'issued_at': issued_at.isoformat(),
    }
    with transaction.atomic():
        certificate = Certificate.objects.create(
            certificate_id=cert_id,
            student=student,
            school_class=student.school_class,
            technologies_snapshot=technology_snapshot,
            units_snapshot=unit_snapshot,
            overall_score=score,
            rank=ranked,
            rank_printed=rank_printed,
            issued_by=user,
            snapshot=snapshot,
        )
        final_level = units[-1].level if units else student.current_level
        student.current_level = f"{final_level} (Certified Graduate)" if final_level else 'Certified Graduate'
        student.save(update_fields=['current_level', 'updated_at'])
        snapshot['current_level'] = student.current_level
        certificate.snapshot = snapshot
        certificate.save(update_fields=['snapshot'])
        AuditLog.objects.create(
            actor=user,
            action=AuditAction.OTHER,
            entity_type='student_certificate',
            entity_id=str(student.pk),
            summary=f'Graduate certificate issued for {student.student_id}.',
            changes={'certificate_id': cert_id, 'technologies': technology_snapshot, 'rank': ranked, 'score': score},
        )
    return certificate


def certificate_payload(certificate):
    data = dict(certificate.snapshot or {})
    data.update({
        'verified': certificate.status == 'issued',
        'issued': certificate.status == 'issued',
        'status': 'verified' if certificate.status == 'issued' else 'revoked',
        'certificate_id': certificate.certificate_id,
        'certificate_ref': certificate.certificate_id,
        'verification_token': str(certificate.verification_token),
        'verification_url': data.get('verification_url') or f"{str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')}/verify?token={quote(str(certificate.verification_token))}",
        'issued_at': certificate.issued_at.isoformat() if certificate.issued_at else data.get('issued_at'),
        'rank': certificate.rank if certificate.rank_printed else None,
        'rank_portal': certificate.rank,
        'technologies': certificate.technologies_snapshot,
        'completed_technologies': certificate.technologies_snapshot,
        'units': certificate.units_snapshot,
        'overall_score': float(certificate.overall_score),
    })
    return data
