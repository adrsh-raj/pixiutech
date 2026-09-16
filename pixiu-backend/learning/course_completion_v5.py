import uuid
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Max, Q
from django.utils import timezone

from accounts.models import UserRole
from academics.models import Student, TrainerSchoolAssignment
from audit.models import AuditAction, AuditLog
from .course_completion_models import Certificate, CompletionPolicy, ProgrammeCompletion, SessionWorkflow, Technology, UnitCompletion
from .models import AttendanceStatus, AssessmentStatus, CurriculumClassAssignment, QuizAttempt, Session, StudentAssessment


def _date_today():
    return timezone.localdate()


def _active_assignment_filter(user):
    today = _date_today()
    return TrainerSchoolAssignment.objects.filter(
        trainer__account_id=user.id,
        status='active',
        assigned_from__lte=today,
    ).filter(Q(assigned_to__isnull=True) | Q(assigned_to__gte=today))


def ensure_scope(user, student):
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.TRAINER and _active_assignment_filter(user).filter(school_id=student.school_class.school_id).exists():
        return
    raise PermissionError('Student is outside your authorised school scope.')


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
    for field in ('requires_attendance', 'requires_quiz', 'requires_practical', 'requires_trainer_review', 'active'):
        if field in data:
            setattr(policy, field, str(data[field]).lower() in ('1', 'true', 'yes', 'on') if not isinstance(data[field], bool) else data[field])
    ranges = {'min_attendance_pct': (0, 100), 'min_quiz_pct': (0, 100), 'min_practical_pct': (0, 100), 'min_trainer_review_rating': (0, 5)}
    for field, (lo, hi) in ranges.items():
        if field in data:
            value = float(data[field])
            if not lo <= value <= hi:
                raise ValueError(f'{field} must be between {lo} and {hi}.')
            setattr(policy, field, value)
    policy.save()
    return policy


def programme_final_session(student):
    return (
        Session.objects.filter(school_class_id=student.school_class_id, status='completed', workflow__is_last_session_for_unit=True)
        .select_related('curriculum_unit', 'workflow__technology')
        .order_by('-date', '-start_time', '-id')
        .first()
    )


def completed_sessions(student):
    return list(
        Session.objects.filter(school_class_id=student.school_class_id, status='completed')
        .select_related('curriculum_unit', 'workflow__technology')
        .order_by('date', 'start_time', 'id')
    )


def completed_technologies(student):
    result = {}
    for session in completed_sessions(student):
        technology = getattr(getattr(session, 'workflow', None), 'technology', None)
        if technology:
            result[technology.code] = {'id': str(technology.id), 'code': technology.code, 'name': technology.name}
    return list(result.values())


def student_score(student):
    scores = []
    quiz = QuizAttempt.objects.filter(student=student, status='completed').aggregate(value=Max('percentage'))['value']
    if quiz is not None:
        scores.append(float(quiz))
    assessment = StudentAssessment.objects.filter(student=student, status=AssessmentStatus.PUBLISHED, score__isnull=False).aggregate(value=Avg('score'))['value']
    if assessment is not None:
        scores.append(float(assessment))
    sessions = completed_sessions(student)
    total = len(sessions)
    if total:
        present = student.attendance_records.filter(session_id__in=[s.id for s in sessions], status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED]).count()
        scores.append(round(present * 100 / total, 2))
    return round(sum(scores) / len(scores), 2) if scores else 0


def summary(student):
    final_session = programme_final_session(student)
    programme = ProgrammeCompletion.objects.filter(student=student).first()
    certificate = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    technologies = completed_technologies(student)
    sessions = completed_sessions(student)
    units = []
    for assignment in CurriculumClassAssignment.objects.filter(school_class_id=student.school_class_id, curriculum_unit__status='published').select_related('curriculum_unit', 'curriculum_unit__completion_profile__technology').order_by('curriculum_unit__unit_code'):
        completion = UnitCompletion.objects.filter(student=student, curriculum_unit=assignment.curriculum_unit).first()
        technology = getattr(getattr(assignment.curriculum_unit, 'completion_profile', None), 'technology', None)
        units.append({
            'id': str(assignment.curriculum_unit.id),
            'unit_code': assignment.curriculum_unit.unit_code,
            'title': assignment.curriculum_unit.title,
            'technology': {'id': str(technology.id), 'code': technology.code, 'name': technology.name} if technology else None,
            'sessions': sum(1 for session in sessions if session.curriculum_unit_id == assignment.curriculum_unit_id),
            'status': completion.status if completion else 'pending',
            'score': float(completion.score) if completion else 0,
            'attendance_pct': float(completion.attendance_pct) if completion else 0,
            'quiz_pct': float(completion.quiz_pct) if completion and completion.quiz_pct is not None else None,
            'practical_pct': float(completion.practical_pct) if completion and completion.practical_pct is not None else None,
            'trainer_review_avg': float(completion.trainer_review_avg) if completion and completion.trainer_review_avg is not None else None,
            'reasons': completion.reasons if completion else [],
            'last_session': bool(completion and completion.final_session_id),
        })
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'status': programme.status if programme else 'in_progress',
        'overall_score': float(programme.overall_score) if programme else student_score(student),
        'required_units': len(units),
        'completed_units': sum(row['status'] == 'passed' for row in units),
        'units': units,
        'technologies': technologies,
        'sessions_by_technology': [
            {'technology': item['name'], 'code': item['code'], 'sessions': sum(1 for s in sessions if getattr(getattr(s, 'workflow', None), 'technology', None) and s.workflow.technology.code == item['code'])}
            for item in technologies
        ],
        'programme_final_session': {
            'id': str(final_session.id),
            'topic': final_session.topic,
            'date': str(final_session.date),
            'technology': getattr(getattr(final_session, 'workflow', None), 'technology', None).name if getattr(getattr(final_session, 'workflow', None), 'technology', None) else '',
        } if final_session else None,
        'final_session_ready': bool(final_session),
        'trainer_approval_ready': bool(final_session and not certificate and (programme is None or programme.status == 'in_progress')),
        'can_issue_certificate': bool(programme and programme.status == 'trainer_requested' and not certificate),
        'certificate_id': certificate.certificate_id if certificate else None,
        'policy': serialize_policy(policy_for(student.school_class)),
    }


def approve_programme(user, student):
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only a trainer can approve the final programme session.')
    ensure_scope(user, student)
    final_session = programme_final_session(student)
    if not final_session:
        raise ValueError('No completed final programme session is marked for this class.')
    later = Session.objects.filter(school_class_id=student.school_class_id, status='completed').filter(
        Q(date__gt=final_session.date) | Q(date=final_session.date, start_time__gt=final_session.start_time) | Q(date=final_session.date, start_time=final_session.start_time, id__gt=final_session.id)
    ).exists()
    if later:
        raise ValueError('The marked final programme session must be the latest completed class session.')
    programme, _ = ProgrammeCompletion.objects.get_or_create(student=student)
    programme.status = 'trainer_requested'
    programme.overall_score = student_score(student)
    programme.requested_by = user
    programme.requested_at = timezone.now()
    programme.completed_by = None
    programme.completed_at = None
    programme.save(update_fields=['status', 'overall_score', 'requested_by', 'requested_at', 'completed_by', 'completed_at', 'updated_at'])
    AuditLog.objects.create(actor=user, action=AuditAction.OTHER, entity_type='programme_completion', entity_id=str(student.pk), summary=f'Final programme session approved for {student.student_id}.', changes={'final_session_id': str(final_session.id), 'technologies': completed_technologies(student)})
    return programme


def issue_certificate(user, student):
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only a trainer can issue the certificate.')
    ensure_scope(user, student)
    programme = ProgrammeCompletion.objects.filter(student=student, status='trainer_requested').first()
    if programme is None:
        raise ValueError('Approve the final programme session before issuing the certificate.')
    existing = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    if existing:
        return existing
    technologies = completed_technologies(student)
    sessions = completed_sessions(student)
    units_snapshot = [
        {
            'technology': getattr(getattr(session, 'workflow', None), 'technology', None).name if getattr(getattr(session, 'workflow', None), 'technology', None) else '',
            'unit_code': session.curriculum_unit.unit_code if session.curriculum_unit else '',
            'title': session.curriculum_unit.title if session.curriculum_unit else session.topic,
            'session_date': str(session.date),
            'topic': session.topic,
        }
        for session in sessions
    ]
    certificate_id = f"PX-{student.school_class.school.school_code}-{student.student_id}-{_date_today().year}-{uuid.uuid4().hex[:6].upper()}"
    origin = str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')
    verification_url = f"{origin}/verify?cert={quote(certificate_id)}"
    snapshot = {
        'certificate_id': certificate_id,
        'certificate_ref': certificate_id,
        'verification_url': verification_url,
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
        'units': units_snapshot,
        'overall_score': float(programme.overall_score),
        'programme_completion_type': 'single_final_session',
        'issued_by': user.display_name or user.username,
    }
    with transaction.atomic():
        certificate = Certificate.objects.create(
            certificate_id=certificate_id,
            student=student,
            school_class=student.school_class,
            programme_name='Pixiu Technology Programme',
            technologies_snapshot=technologies,
            units_snapshot=units_snapshot,
            overall_score=programme.overall_score,
            issued_by=user,
            snapshot=snapshot,
        )
        AuditLog.objects.create(actor=user, action=AuditAction.OTHER, entity_type='student_certificate', entity_id=str(student.pk), summary=f'Certificate issued for {student.student_id}.', changes={'certificate_id': certificate_id, 'technologies': technologies})
    return certificate


def certificate_payload(certificate):
    data = dict(certificate.snapshot or {})
    data.update({'certificate_id': certificate.certificate_id, 'certificate_ref': certificate.certificate_id, 'verification_token': str(certificate.verification_token), 'verified': certificate.status == 'issued', 'issued': certificate.status == 'issued', 'status': 'verified' if certificate.status == 'issued' else 'revoked', 'technologies': certificate.technologies_snapshot, 'completed_technologies': certificate.technologies_snapshot, 'units': certificate.units_snapshot, 'overall_score': float(certificate.overall_score), 'issued_at': certificate.issued_at.isoformat()})
    return data
