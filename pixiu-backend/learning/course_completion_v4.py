import uuid
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Max
from django.utils import timezone

from accounts.models import UserRole
from academics.models import Student, TrainerSchoolAssignment
from audit.models import AuditAction, AuditLog
from .models import AttendanceStatus, AssessmentStatus, CurriculumClassAssignment, Quiz, QuizAttempt, Session, StudentAssessment
from .course_completion_models import Certificate, CompletionPolicy, SessionWorkflow, Technology, UnitCompletion, ProgrammeCompletion


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
    if str(data.get('name') or '').strip():
        policy.name = str(data['name']).strip()[:160]
    ranges = {
        'min_attendance_pct': (0, 100), 'min_quiz_pct': (0, 100), 'min_practical_pct': (0, 100),
        'min_trainer_review_rating': (0, 5), 'weight_practical': (0, 100), 'weight_quiz': (0, 100),
        'weight_attendance': (0, 100), 'weight_trainer_review': (0, 100),
    }
    for field, (lo, hi) in ranges.items():
        if field not in data:
            continue
        try:
            value = float(data[field])
        except (TypeError, ValueError):
            raise ValueError(f'{field} must be numeric.')
        if not lo <= value <= hi:
            raise ValueError(f'{field} must be between {lo} and {hi}.')
        setattr(policy, field, value)
    if sum(float(getattr(policy, f)) for f in ('weight_practical', 'weight_quiz', 'weight_attendance', 'weight_trainer_review')) <= 0:
        raise ValueError('At least one scoring weight must be greater than zero.')
    policy.save()
    return policy


def ensure_scope(user, student):
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.TRAINER and TrainerSchoolAssignment.objects.filter(
        trainer__account=user,
        school=student.school_class.school,
        status='active',
        assigned_from__lte=timezone.localdate(),
    ).filter(assigned_to__isnull=True) | TrainerSchoolAssignment.objects.filter(
        trainer__account=user,
        school=student.school_class.school,
        status='active',
        assigned_from__lte=timezone.localdate(),
        assigned_to__gte=timezone.localdate(),
    ).exists():
        return
    raise PermissionError('Student is outside your authorised school scope.')


def programme_final_session(student):
    return (
        Session.objects.filter(
            school_class=student.school_class,
            status='completed',
            workflow__is_last_session_for_unit=True,
        )
        .select_related('curriculum_unit', 'workflow__technology')
        .order_by('-date', '-start_time', '-id')
        .first()
    )


def all_completed_sessions(student):
    return (
        Session.objects.filter(school_class=student.school_class, status='completed')
        .select_related('curriculum_unit', 'workflow__technology')
        .order_by('date', 'start_time', 'id')
    )


def completed_technologies(student):
    result = {}
    for session in all_completed_sessions(student):
        technology = getattr(getattr(session, 'workflow', None), 'technology', None)
        if technology:
            result[technology.code] = {
                'id': str(technology.id),
                'code': technology.code,
                'name': technology.name,
            }
    return list(result.values())


def attendance_pct(student, sessions):
    total = sessions.count()
    if not total:
        return None
    attended = student.attendance_records.filter(
        session__in=sessions,
        status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED],
    ).count()
    return round(attended * 100 / total, 2)


def latest_metrics(student):
    sessions = all_completed_sessions(student)
    return {
        'attendance_pct': attendance_pct(student, sessions),
        'quiz_pct': float(QuizAttempt.objects.filter(student=student, status='completed').aggregate(best=Max('percentage'))['best']) if QuizAttempt.objects.filter(student=student, status='completed').exists() else None,
        'practical_pct': float(StudentAssessment.objects.filter(student=student, status=AssessmentStatus.PUBLISHED, score__isnull=False).aggregate(value=Avg('score'))['value']) if StudentAssessment.objects.filter(student=student, status=AssessmentStatus.PUBLISHED, score__isnull=False).exists() else None,
        'trainer_review_avg': float(StudentAssessment.objects.filter(student=student, status=AssessmentStatus.PUBLISHED, rating__isnull=False).aggregate(value=Avg('rating'))['value']) if StudentAssessment.objects.filter(student=student, status=AssessmentStatus.PUBLISHED, rating__isnull=False).exists() else None,
    }


def summary(student):
    school_class = student.school_class
    policy = policy_for(school_class)
    final_session = programme_final_session(student)
    technologies = completed_technologies(student)
    sessions = list(all_completed_sessions(student))
    unit_rows = []
    for unit in CurriculumClassAssignment.objects.filter(
        school_class=school_class,
        curriculum_unit__status='published',
    ).select_related('curriculum_unit', 'curriculum_unit__completion_profile__technology').order_by('curriculum_unit__unit_code'):
        completion = UnitCompletion.objects.filter(student=student, curriculum_unit=unit.curriculum_unit).first()
        technology = getattr(getattr(unit.curriculum_unit, 'completion_profile', None), 'technology', None)
        unit_rows.append({
            'id': str(unit.curriculum_unit.id),
            'unit_code': unit.curriculum_unit.unit_code,
            'title': unit.curriculum_unit.title,
            'technology': {'id': str(technology.id), 'code': technology.code, 'name': technology.name} if technology else None,
            'sessions': sum(1 for s in sessions if s.curriculum_unit_id == unit.curriculum_unit.id),
            'status': completion.status if completion else 'pending',
            'score': float(completion.score) if completion else 0,
            'attendance_pct': float(completion.attendance_pct) if completion else 0,
            'quiz_pct': float(completion.quiz_pct) if completion and completion.quiz_pct is not None else None,
            'practical_pct': float(completion.practical_pct) if completion and completion.practical_pct is not None else None,
            'trainer_review_avg': float(completion.trainer_review_avg) if completion and completion.trainer_review_avg is not None else None,
            'reasons': completion.reasons if completion else [],
            'last_session': bool(completion and completion.final_session_id),
            'completed_at': completion.completed_at.isoformat() if completion and completion.completed_at else None,
        })
    programme = ProgrammeCompletion.objects.filter(student=student).first()
    certificate = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    overall_score = float(programme.overall_score) if programme else 0
    if not overall_score:
        scores = [row['score'] for row in unit_rows if row['score'] > 0]
        overall_score = round(sum(scores) / len(scores), 2) if scores else 0
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': school_class.school.name,
        'school_code': school_class.school.school_code,
        'class_name': school_class.display_name,
        'status': programme.status if programme else 'in_progress',
        'required_units': len(unit_rows),
        'completed_units': sum(row['status'] == 'passed' for row in unit_rows),
        'overall_score': overall_score,
        'technologies': technologies,
        'sessions_by_technology': [
            {'technology': item['name'], 'code': item['code'], 'sessions': sum(1 for s in sessions if getattr(getattr(s, 'workflow', None), 'technology', None) and s.workflow.technology.code == item['code'])}
            for item in technologies
        ],
        'units': unit_rows,
        'programme_final_session': {
            'id': str(final_session.id),
            'topic': final_session.topic,
            'date': str(final_session.date),
            'technology': getattr(getattr(final_session, 'workflow', None), 'technology', None).name if getattr(getattr(final_session, 'workflow', None), 'technology', None) else '',
        } if final_session else None,
        'final_session_ready': bool(final_session),
        'certificate_id': certificate.certificate_id if certificate else None,
        'trainer_approval_ready': bool(final_session and not certificate and (programme is None or programme.status == 'in_progress')),
        'can_issue_certificate': bool(programme and programme.status == 'trainer_requested' and not certificate),
        'policy': serialize_policy(policy),
    }


def approve_programme(user, student):
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only a trainer can approve the final programme session.')
    ensure_scope(user, student)
    final_session = programme_final_session(student)
    if not final_session:
        raise ValueError('No completed final programme session is marked for this class.')
    later = Session.objects.filter(
        school_class=student.school_class,
        status='completed',
    ).filter(date__gt=final_session.date).exists()
    if later:
        raise ValueError('The marked final programme session is not the latest completed class session.')
    programme, _ = ProgrammeCompletion.objects.get_or_create(student=student)
    metrics = latest_metrics(student)
    values = [v for v in (metrics['quiz_pct'], metrics['practical_pct'], metrics['attendance_pct']) if v is not None]
    score = round(sum(values) / len(values), 2) if values else 0
    programme.status = 'trainer_requested'
    programme.overall_score = score
    programme.requested_by = user
    programme.requested_at = timezone.now()
    programme.completed_by = None
    programme.completed_at = None
    programme.save(update_fields=['status', 'overall_score', 'requested_by', 'requested_at', 'completed_by', 'completed_at', 'updated_at'])
    AuditLog.objects.create(
        actor=user,
        action=AuditAction.OTHER,
        entity_type='programme_completion',
        entity_id=str(student.pk),
        summary=f'Final programme session approved for {student.student_id}.',
        changes={'student_id': student.student_id, 'final_session_id': str(final_session.id), 'technologies': completed_technologies(student), 'overall_score': score},
    )
    return programme


def issue_certificate(user, student):
    if user.role not in ISSUER_ROLES:
        raise PermissionError('Only the authorised trainer can issue the final certificate.')
    ensure_scope(user, student)
    if not ProgrammeCompletion.objects.filter(student=student, status='trainer_requested').exists():
        raise ValueError('Trainer must approve the final programme session before certificate issuance.')
    existing = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    if existing:
        return existing
    technologies = completed_technologies(student)
    sessions = list(all_completed_sessions(student))
    unit_snapshot = []
    for session in sessions:
        technology = getattr(getattr(session, 'workflow', None), 'technology', None)
        unit_snapshot.append({
            'technology': technology.name if technology else '',
            'unit_code': session.curriculum_unit.unit_code if session.curriculum_unit else '',
            'title': session.curriculum_unit.title if session.curriculum_unit else session.topic,
            'session_date': str(session.date),
            'topic': session.topic,
        })
    programme = ProgrammeCompletion.objects.get(student=student)
    cert_id = f"PX-{student.school_class.school.school_code}-{student.student_id}-{timezone.localdate().year}-{uuid.uuid4().hex[:6].upper()}"
    origin = str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')
    verify_url = f"{origin}/verify?cert={quote(cert_id)}"
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
        'technologies': technologies,
        'completed_technologies': technologies,
        'units': unit_snapshot,
        'overall_score': float(programme.overall_score),
        'issued_by': user.display_name or user.username,
        'programme_completed_via': 'trainer_final_session_approval',
    }
    with transaction.atomic():
        certificate = Certificate.objects.create(
            certificate_id=cert_id,
            student=student,
            school_class=student.school_class,
            programme_name='Pixiu Technology Programme',
            technologies_snapshot=technologies,
            units_snapshot=unit_snapshot,
            overall_score=programme.overall_score,
            issued_by=user,
            snapshot=snapshot,
        )
        AuditLog.objects.create(
            actor=user,
            action=AuditAction.OTHER,
            entity_type='student_certificate',
            entity_id=str(student.pk),
            summary=f'Certificate issued for {student.student_id}.',
            changes={'certificate_id': cert_id, 'technologies': technologies},
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
        'technologies': certificate.technologies_snapshot,
        'completed_technologies': certificate.technologies_snapshot,
        'units': certificate.units_snapshot,
        'overall_score': float(certificate.overall_score),
        'issued_at': certificate.issued_at.isoformat(),
    })
    return data


def evaluate_last_session(session):
    if session.status != 'completed' or not session.curriculum_unit_id:
        raise ValueError('Complete the session before evaluating it.')
    workflow = SessionWorkflow.objects.filter(session=session).first()
    if not workflow or not workflow.is_last_session_for_unit:
        raise ValueError('This session is not marked as the final programme session.')
    students = Student.objects.filter(school_class=session.school_class, status='active').order_by('roll_number', 'student_id')
    results = []
    for student in students:
        policy = policy_for(student.school_class)
        sessions = Session.objects.filter(school_class=student.school_class, curriculum_unit=session.curriculum_unit, status='completed')
        attendance = attendance_pct(student, sessions)
        review = trainer_review_avg = StudentAssessment.objects.filter(student=student, unit_code__iexact=session.curriculum_unit.unit_code, status=AssessmentStatus.PUBLISHED, rating__isnull=False).aggregate(value=Avg('rating'))['value']
        score = float(review) * 20 if review is not None else float(attendance or 0)
        row, _ = UnitCompletion.objects.update_or_create(
            student=student,
            curriculum_unit=session.curriculum_unit,
            defaults={
                'final_session': session,
                'status': 'passed',
                'attendance_pct': attendance or 0,
                'trainer_review_avg': float(review) if review is not None else None,
                'score': score,
                'reasons': [],
                'completed_at': timezone.now(),
            },
        )
        results.append(row)
    return results
