from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import quote
import uuid

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Max
from django.utils import timezone

from accounts.models import UserRole
from academics.models import Student, TrainerSchoolAssignment
from academics.services import accessible_class_queryset, accessible_student_queryset
from audit.models import AuditAction, AuditLog
from .models import AttendanceStatus, AssessmentStatus, CurriculumClassAssignment, CurriculumUnit, QuizAttempt, Session, StudentAssessment
from .course_completion_models import Certificate, CompletionPolicy, ProgrammeCompletion, SessionWorkflow, Technology, UnitCompletion


def get_policy(school_class):
    return CompletionPolicy.objects.filter(school_class=school_class, active=True).first() or CompletionPolicy.objects.filter(school_class__isnull=True, active=True).first()


def get_or_create_default_policy(school_class=None):
    policy = get_policy(school_class) if school_class else CompletionPolicy.objects.filter(school_class__isnull=True, active=True).first()
    if policy:
        return policy
    return CompletionPolicy.objects.create(school_class=school_class, name='Standard Pixiu completion policy')


def _required_units(student):
    rows = CurriculumClassAssignment.objects.filter(
        school_class=student.school_class,
        curriculum_unit__status='published',
    ).select_related('curriculum_unit').order_by('curriculum_unit__unit_code')
    return [row.curriculum_unit for row in rows if not hasattr(row.curriculum_unit, 'completion_profile') or row.curriculum_unit.completion_profile.certificate_required]


def _unit_sessions(student, unit):
    return Session.objects.filter(
        school_class=student.school_class,
        curriculum_unit=unit,
        status__in=['in_progress', 'completed'],
    ).order_by('date', 'start_time')


def _final_session(unit, student):
    return Session.objects.filter(
        school_class=student.school_class,
        curriculum_unit=unit,
        status='completed',
        workflow__is_last_session_for_unit=True,
    ).select_related('trainer').order_by('-date', '-start_time').first()


def _metric_attendance(student, sessions):
    total = sessions.count()
    if not total:
        return None
    good = AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED
    present = student.attendance_records.filter(session__in=sessions, status__in=good).count()
    return round((present / total) * 100, 2)


def _metric_quiz(student, unit):
    attempts = QuizAttempt.objects.filter(
        student=student,
        quiz__unit_code__iexact=unit.unit_code,
        status='completed',
    ).exclude(quiz__status='closed')
    best = attempts.aggregate(value=Max('percentage'))['value']
    return float(best) if best is not None else None


def _metric_practical(student, unit):
    values = StudentAssessment.objects.filter(
        student=student,
        unit_code__iexact=unit.unit_code,
        status=AssessmentStatus.PUBLISHED,
        score__isnull=False,
    ).values_list('score', flat=True)
    if not values:
        return None
    return round(sum(float(v) for v in values) / len(values), 2)


def _metric_review(student, unit):
    value = StudentAssessment.objects.filter(
        student=student,
        unit_code__iexact=unit.unit_code,
        status=AssessmentStatus.PUBLISHED,
        rating__isnull=False,
    ).aggregate(value=Avg('rating'))['value']
    return round(float(value), 2) if value is not None else None


def _weighted_score(metrics, policy):
    items = []
    if policy.requires_practical and metrics['practical_pct'] is not None:
        items.append((float(metrics['practical_pct']), float(policy.weight_practical)))
    if policy.requires_quiz and metrics['quiz_pct'] is not None:
        items.append((float(metrics['quiz_pct']), float(policy.weight_quiz)))
    if policy.requires_attendance and metrics['attendance_pct'] is not None:
        items.append((float(metrics['attendance_pct']), float(policy.weight_attendance)))
    if policy.requires_trainer_review and metrics['trainer_review_avg'] is not None:
        items.append((float(metrics['trainer_review_avg']) * 20, float(policy.weight_trainer_review)))
    weight = sum(w for _, w in items)
    if weight <= 0:
        return 0.0
    return round(sum(value * w for value, w in items) / weight, 2)


def evaluate_unit(student, unit, final_session=None):
    policy = get_or_create_default_policy(student.school_class)
    final_session = final_session or _final_session(unit, student)
    sessions = _unit_sessions(student, unit)
    metrics = {
        'attendance_pct': _metric_attendance(student, sessions),
        'quiz_pct': _metric_quiz(student, unit),
        'practical_pct': _metric_practical(student, unit),
        'trainer_review_avg': _metric_review(student, unit),
    }
    reasons = []
    if final_session is None:
        reasons.append('Last session for this unit has not been completed.')
    checks = [
        ('requires_attendance', metrics['attendance_pct'], float(policy.min_attendance_pct), 'Attendance'),
        ('requires_quiz', metrics['quiz_pct'], float(policy.min_quiz_pct), 'Quiz'),
        ('requires_practical', metrics['practical_pct'], float(policy.min_practical_pct), 'Practical'),
        ('requires_trainer_review', metrics['trainer_review_avg'], float(policy.min_trainer_review_rating), 'Trainer review'),
    ]
    for enabled_key, value, minimum, label in checks:
        if getattr(policy, enabled_key):
            if value is None:
                reasons.append(f'{label} is pending.')
            elif value < minimum:
                reasons.append(f'{label} is below {minimum:g}.')
    passed = not reasons
    completion, _ = UnitCompletion.objects.update_or_create(
        student=student,
        curriculum_unit=unit,
        defaults={
            'final_session': final_session,
            'status': 'passed' if passed else ('failed' if final_session else 'pending'),
            'attendance_pct': metrics['attendance_pct'] or 0,
            'quiz_pct': metrics['quiz_pct'],
            'practical_pct': metrics['practical_pct'],
            'trainer_review_avg': metrics['trainer_review_avg'],
            'score': _weighted_score(metrics, policy),
            'reasons': reasons,
            'completed_at': timezone.now() if passed else None,
        },
    )
    return completion


def evaluate_session(session):
    if not hasattr(session, 'workflow') or not session.workflow.is_last_session_for_unit:
        raise ValueError('This is not marked as the last session for a unit.')
    students = Student.objects.filter(school_class=session.school_class, status='active')
    unit = session.curriculum_unit
    rows = [evaluate_unit(student, unit, session) for student in students]
    return rows


def programme_metrics(student):
    required = _required_units(student)
    completions = [evaluate_unit(student, unit) for unit in required]
    passed = [row for row in completions if row.status == 'passed']
    score = round(sum(float(row.score) for row in passed) / len(passed), 2) if passed else 0.0
    return required, completions, score


def _ranked_students(student):
    cohort = accessible_student_queryset(type('User', (), {'role': UserRole.ADMIN})())
    # Ranking is calculated on the same school class, independent of caller scope.
    students = list(Student.objects.filter(school_class=student.school_class, status='active').order_by('student_id'))
    rows = []
    for item in students:
        _, completions, score = programme_metrics(item)
        if all(row.status == 'passed' for row in completions) and completions:
            rows.append((item, score, min((row.completed_at for row in completions if row.completed_at), default=timezone.now())))
    rows.sort(key=lambda row: (-row[1], row[2], str(row[0].student_id)))
    return rows


def get_student_rank(student):
    rows = _ranked_students(student)
    for index, (item, score, _) in enumerate(rows, start=1):
        if item.pk == student.pk:
            return index
    return None


def _technology_for_unit(unit):
    session_workflow = SessionWorkflow.objects.filter(
        session__curriculum_unit=unit,
        session__status__in=['in_progress', 'completed'],
    ).select_related('technology').order_by('-session__date', '-session__start_time').first()
    return session_workflow.technology if session_workflow else None


def student_summary(student):
    required, completions, overall_score = programme_metrics(student)
    units = []
    technologies = {}
    for unit, completion in zip(required, completions):
        technology = _technology_for_unit(unit)
        tech_payload = {'id': str(technology.id), 'code': technology.code, 'name': technology.name} if technology else None
        if technology:
            technologies[technology.code] = tech_payload
        units.append({
            'id': str(unit.id),
            'unit_code': unit.unit_code,
            'title': unit.title,
            'level': unit.level,
            'technology': tech_payload,
            'sessions': Session.objects.filter(school_class=student.school_class, curriculum_unit=unit).exclude(status='cancelled').count(),
            'status': completion.status,
            'attendance_pct': float(completion.attendance_pct),
            'quiz_pct': float(completion.quiz_pct) if completion.quiz_pct is not None else None,
            'practical_pct': float(completion.practical_pct) if completion.practical_pct is not None else None,
            'trainer_review_avg': float(completion.trainer_review_avg) if completion.trainer_review_avg is not None else None,
            'score': float(completion.score),
            'reasons': completion.reasons or [],
            'completed_at': completion.completed_at.isoformat() if completion.completed_at else None,
            'last_session': bool(completion.final_session_id),
        })
    programme = ProgrammeCompletion.objects.filter(student=student).first()
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'status': programme.status if programme else 'in_progress',
        'required_units': len(required),
        'completed_units': sum(1 for row in completions if row.status == 'passed'),
        'overall_score': overall_score,
        'rank': get_student_rank(student),
        'technologies': list(technologies.values()),
        'units': units,
        'sessions_by_technology': [
            {'technology': item['name'], 'sessions': SessionWorkflow.objects.filter(technology_id=item['id'], session__school_class=student.school_class).exclude(session__status='cancelled').count()}
            for item in technologies.values()
        ],
        'trainer_requested_at': programme.requested_at.isoformat() if programme and programme.requested_at else None,
        'admin_completed_at': programme.completed_at.isoformat() if programme and programme.completed_at else None,
        'certificate_id': Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').values_list('certificate_id', flat=True).first(),
    }


def can_manage_student(user, student):
    if user.role in {UserRole.ADMIN, UserRole.SUPERADMIN}:
        return True
    if user.role == UserRole.TRAINER:
        return TrainerSchoolAssignment.objects.filter(trainer__account=user, school=student.school_class.school, status='active').exists()
    return False


def request_programme_completion(user, student):
    required, completions, score = programme_metrics(student)
    missing = [unit.unit_code for unit, row in zip(required, completions) if row.status != 'passed']
    if missing:
        raise ValueError(f'Programme is not ready. Pending units: {", ".join(missing)}.')
    programme, _ = ProgrammeCompletion.objects.get_or_create(student=student)
    programme.status = 'trainer_requested'
    programme.overall_score = score
    programme.requested_by = user
    programme.requested_at = timezone.now()
    programme.save(update_fields=['status', 'overall_score', 'requested_by', 'requested_at', 'updated_at'])
    return programme


def mark_programme_completed(user, student):
    required, completions, score = programme_metrics(student)
    missing = [unit.unit_code for unit, row in zip(required, completions) if row.status != 'passed']
    if missing:
        raise ValueError(f'Programme cannot be completed. Pending units: {", ".join(missing)}.')
    programme, _ = ProgrammeCompletion.objects.get_or_create(student=student)
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
        changes={'student_id': student.student_id, 'overall_score': score, 'required_units': len(required)},
    )
    return programme


def issue_certificate(user, student):
    if user.role not in {UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TRAINER}:
        raise PermissionError('Only trainers and administrators can issue certificates.')
    if not can_manage_student(user, student):
        raise PermissionError('Student is outside your authorised school scope.')
    programme = ProgrammeCompletion.objects.filter(student=student, status='admin_completed').first()
    if not programme:
        raise ValueError('Admin must mark the programme completed before the trainer can issue the certificate.')
    existing = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    if existing:
        return existing
    required, completions, score = programme_metrics(student)
    ranked = get_student_rank(student)
    technology_names = []
    unit_snapshot = []
    seen = set()
    for unit, completion in zip(required, completions):
        tech = _technology_for_unit(unit)
        if tech and tech.code not in seen:
            technology_names.append({'code': tech.code, 'name': tech.name})
            seen.add(tech.code)
        unit_snapshot.append({'unit_code': unit.unit_code, 'title': unit.title, 'level': unit.level, 'technology': tech.name if tech else '', 'score': float(completion.score)})
    certificate_id = f"PX-{student.school_class.school.school_code}-{student.student_id.replace(' ', '')}-{timezone.localdate().year}-{uuid.uuid4().hex[:6].upper()}"
    origin = str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')
    verification_url = f"{origin}/verify?cert={quote(certificate_id)}"
    rank_printed = bool(ranked and ranked <= 10)
    snapshot = {
        'certificate_id': certificate_id,
        'verification_url': verification_url,
        'student_name': student.name,
        'student_id': student.student_id,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'technologies': technology_names,
        'units': unit_snapshot,
        'overall_score': score,
        'rank': ranked if rank_printed else None,
        'rank_portal': ranked,
        'issued_by': getattr(user, 'display_name', '') or getattr(user, 'username', ''),
    }
    with transaction.atomic():
        certificate = Certificate.objects.create(
            certificate_id=certificate_id,
            student=student,
            school_class=student.school_class,
            technologies_snapshot=technology_names,
            units_snapshot=unit_snapshot,
            overall_score=score,
            rank=ranked,
            rank_printed=rank_printed,
            issued_by=user,
            snapshot=snapshot,
        )
        final_level = required[-1].level if required else student.current_level
        student.current_level = f"{final_level} (Certified Graduate)" if final_level else 'Certified Graduate'
        student.save(update_fields=['current_level', 'updated_at'])
        AuditLog.objects.create(
            actor=user,
            action=AuditAction.OTHER,
            entity_type='student_certificate',
            entity_id=str(student.pk),
            summary=f'Graduate certificate issued for {student.student_id}.',
            changes={'certificate_id': certificate_id, 'technologies': technology_names, 'rank': ranked, 'score': score},
        )
    return certificate
