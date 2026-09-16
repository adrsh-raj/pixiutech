from urllib.parse import quote
import uuid

from django.conf import settings
from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from accounts.models import UserRole
from academics.models import Student, TrainerSchoolAssignment
from audit.models import AuditAction, AuditLog
from .course_completion_models import Certificate, CompletionPolicy, ProgrammeCompletion, Technology
from .models import AttendanceStatus, AssessmentStatus, Project, Quiz, QuizAttempt, Session, SessionWorkflow, StudentAssessment

PASS_MARK = 70.0
WEIGHT_PRACTICAL = 40.0
WEIGHT_QUIZ = 25.0
WEIGHT_ATTENDANCE = 20.0
WEIGHT_TRAINER_REVIEW = 15.0


def _today():
    return timezone.localdate()


def _active_assignments(user):
    today = _today()
    return TrainerSchoolAssignment.objects.filter(
        trainer__account_id=user.id,
        status='active',
        assigned_from__lte=today,
    ).filter(Q(assigned_to__isnull=True) | Q(assigned_to__gte=today))


def ensure_scope(user, student):
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.TRAINER and _active_assignments(user).filter(school_id=student.school_class.school_id).exists():
        return
    raise PermissionError('Student is outside your authorised school scope.')


def policy_for(school_class):
    return (
        CompletionPolicy.objects.filter(school_class=school_class, active=True).first()
        or CompletionPolicy.objects.filter(school_class__isnull=True, active=True).first()
        or CompletionPolicy.objects.create(school_class=None, name='Standard Pixiu completion policy')
    )


def serialize_policy(policy):
    return {
        'id': policy.id,
        'name': policy.name,
        'school_class_id': str(policy.school_class_id) if policy.school_class_id else None,
        'requires_attendance': bool(policy.requires_attendance),
        'requires_quiz': bool(policy.requires_quiz),
        'requires_practical': bool(policy.requires_practical),
        'requires_trainer_review': bool(policy.requires_trainer_review),
        'weight_practical': WEIGHT_PRACTICAL,
        'weight_quiz': WEIGHT_QUIZ,
        'weight_attendance': WEIGHT_ATTENDANCE,
        'weight_trainer_review': WEIGHT_TRAINER_REVIEW,
        'min_attendance_pct': float(policy.min_attendance_pct),
        'min_quiz_pct': float(policy.min_quiz_pct),
        'min_practical_pct': float(policy.min_practical_pct),
        'min_trainer_review_rating': float(policy.min_trainer_review_rating),
        'active': bool(policy.active),
    }


def completed_sessions(student):
    return list(
        Session.objects.filter(school_class_id=student.school_class_id, status='completed')
        .select_related('curriculum_unit', 'workflow__technology')
        .order_by('date', 'start_time', 'id')
    )


def programme_final_session(student):
    return (
        Session.objects.filter(
            school_class_id=student.school_class_id,
            status='completed',
            workflow__is_last_session_for_unit=True,
        )
        .select_related('curriculum_unit', 'workflow__technology')
        .order_by('-date', '-start_time', '-id')
        .first()
    )


def final_session_is_latest(student, final_session):
    if not final_session:
        return False
    return not Session.objects.filter(
        school_class_id=student.school_class_id,
        status='completed',
    ).filter(
        Q(date__gt=final_session.date)
        | Q(date=final_session.date, start_time__gt=final_session.start_time)
        | Q(date=final_session.date, start_time=final_session.start_time, id__gt=final_session.id)
    ).exists()


def completed_technologies(student):
    result = {}
    for session in completed_sessions(student):
        technology = getattr(getattr(session, 'workflow', None), 'technology', None)
        if technology:
            result[technology.code] = {
                'id': str(technology.id),
                'code': technology.code,
                'name': technology.name,
            }
    return list(result.values())


def _taught_unit_codes(sessions):
    return {
        str(session.curriculum_unit.unit_code).strip().upper()
        for session in sessions
        if session.curriculum_unit_id and session.curriculum_unit.unit_code
    }


def attendance_metrics(student, sessions):
    session_ids = [session.id for session in sessions]
    rows = list(student.attendance_records.filter(session_id__in=session_ids).only('session_id', 'status'))
    by_session = {str(row.session_id): row.status for row in rows}
    missing = [
        {'session_id': str(session.id), 'date': str(session.date), 'topic': session.topic}
        for session in sessions
        if str(session.id) not in by_session
    ]
    attended = sum(
        1 for status in by_session.values()
        if status in {AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED}
    )
    return {
        'percentage': round(attended * 100 / len(sessions), 2) if sessions else 0.0,
        'attended': attended,
        'total': len(sessions),
        'marked': len(by_session),
        'missing': missing,
        'complete': not missing,
    }


def quiz_metrics(student, taught_unit_codes):
    assigned = [
        quiz for quiz in Quiz.objects.filter(
            status__in=['active', 'closed'],
            class_assignments__school_class_id=student.school_class_id,
        ).distinct()
        if str(quiz.unit_code or '').strip().upper() in taught_unit_codes
    ]
    rows = []
    for quiz in assigned:
        best = QuizAttempt.objects.filter(
            student=student,
            quiz=quiz,
            status='completed',
        ).aggregate(value=Max('percentage'))['value']
        rows.append({
            'id': str(quiz.id),
            'title': quiz.title,
            'percentage': float(best) if best is not None else 0.0,
            'complete': best is not None,
        })
    return {
        'percentage': round(sum(row['percentage'] for row in rows) / len(rows), 2) if rows else 0.0,
        'assigned': len(rows),
        'completed': sum(row['complete'] for row in rows),
        'missing': [row for row in rows if not row['complete']],
        'complete': all(row['complete'] for row in rows) if rows else True,
        'rows': rows,
    }


def assessment_metrics(student, taught_unit_codes):
    practical_values = [
        float(score)
        for score, unit_code in StudentAssessment.objects.filter(
            student=student,
            status=AssessmentStatus.PUBLISHED,
            score__isnull=False,
        ).values_list('score', 'unit_code')
        if not unit_code or str(unit_code).strip().upper() in taught_unit_codes
    ]
    review_values = [
        float(rating)
        for rating, unit_code in StudentAssessment.objects.filter(
            student=student,
            status=AssessmentStatus.PUBLISHED,
            rating__isnull=False,
        ).values_list('rating', 'unit_code')
        if not unit_code or str(unit_code).strip().upper() in taught_unit_codes
    ]
    review_average = sum(review_values) / len(review_values) if review_values else None
    return {
        'practical_pct': round(sum(practical_values) / len(practical_values), 2) if practical_values else 0.0,
        'trainer_review_pct': round(review_average * 20, 2) if review_average is not None else 0.0,
        'trainer_review_rating': round(review_average, 2) if review_average is not None else None,
    }


def project_metrics(student):
    completed = Project.objects.filter(student=student, status='completed').exists()
    latest = Project.objects.filter(student=student).order_by('-created_at').first()
    return {
        'complete': completed,
        'status': latest.status if latest else None,
        'title': latest.title if latest else None,
        'score': float(latest.score) if latest and latest.score is not None else None,
    }


def score_data(student):
    sessions = completed_sessions(student)
    taught_codes = _taught_unit_codes(sessions)
    attendance = attendance_metrics(student, sessions)
    quiz = quiz_metrics(student, taught_codes)
    assessment = assessment_metrics(student, taught_codes)
    overall = round(
        assessment['practical_pct'] * WEIGHT_PRACTICAL / 100
        + quiz['percentage'] * WEIGHT_QUIZ / 100
        + attendance['percentage'] * WEIGHT_ATTENDANCE / 100
        + assessment['trainer_review_pct'] * WEIGHT_TRAINER_REVIEW / 100,
        2,
    )
    return sessions, taught_codes, attendance, quiz, assessment, overall


def checklist(student):
    sessions, taught_codes, attendance, quiz, assessment, overall = score_data(student)
    final = programme_final_session(student)
    project = project_metrics(student)
    final_ready = bool(final and final_session_is_latest(student, final))
    blockers = []
    if not final_ready:
        blockers.append('Mark and complete the final programme session; it must be the latest completed session.')
    if attendance['missing']:
        blockers.append('Attendance is unmarked for: ' + ', '.join(item['topic'] for item in attendance['missing']) + '.')
    if quiz['missing']:
        blockers.append('Quiz pending for: ' + ', '.join(item['title'] for item in quiz['missing']) + '.')
    if not project['complete']:
        blockers.append(f"Project is not marked completed (current status: {project['status'] or 'not submitted'}).")
    if overall < PASS_MARK:
        blockers.append(f'Overall score is {overall:.2f}%; minimum required is {PASS_MARK:.0f}%.')
    return {
        'ready': not blockers,
        'final_session_ready': final_ready,
        'attendance_complete': attendance['complete'],
        'quiz_complete': quiz['complete'],
        'project_complete': project['complete'],
        'score_eligible': overall >= PASS_MARK,
        'blockers': blockers,
        'attendance': attendance,
        'quiz': quiz,
        'project': project,
        'overall_score': overall,
        'assessment': assessment,
        'final_session': {
            'id': str(final.id),
            'topic': final.topic,
            'date': str(final.date),
            'technology': getattr(getattr(final, 'workflow', None), 'technology', None).name if getattr(getattr(final, 'workflow', None), 'technology', None) else '',
        } if final else None,
        'taught_unit_codes': sorted(taught_codes),
    }


def summary(student):
    sessions, taught_codes, attendance, quiz, assessment, overall = score_data(student)
    state = checklist(student)
    programme = ProgrammeCompletion.objects.filter(student=student).first()
    certificate = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    technologies = completed_technologies(student)
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': student.school_class.school.name,
        'school_code': student.school_class.school.school_code,
        'class_name': student.school_class.display_name,
        'status': programme.status if programme else 'in_progress',
        'overall_score': overall,
        'pass_mark': PASS_MARK,
        'score_breakdown': {
            'attendance_pct': attendance['percentage'],
            'quiz_pct': quiz['percentage'],
            'practical_pct': assessment['practical_pct'],
            'trainer_review_pct': assessment['trainer_review_pct'],
            'overall_score': overall,
            'pass_mark': PASS_MARK,
            'eligible': overall >= PASS_MARK,
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
                    1 for session in sessions
                    if getattr(getattr(session, 'workflow', None), 'technology', None)
                    and session.workflow.technology.code == tech['code']
                ),
            }
            for tech in technologies
        ],
        'programme_final_session': state['final_session'],
        'final_session_ready': state['final_session_ready'],
        'trainer_approval_ready': bool(
            state['ready'] and not certificate and (programme is None or programme.status == 'in_progress')
        ),
        'can_issue_certificate': bool(
            state['ready'] and not certificate and programme and programme.status == 'trainer_requested'
        ),
        'certificate_id': certificate.certificate_id if certificate else None,
        'checklist': state,
        'policy': serialize_policy(policy_for(student.school_class)),
        'project': state['project'],
        'quizzes': state['quiz'],
    }


def evaluate_final_programme(session):
    workflow = SessionWorkflow.objects.filter(session=session).select_related('technology').first()
    if not workflow or not workflow.is_last_session_for_unit:
        raise ValueError('This session is not marked as the final programme session.')
    if session.status != 'completed':
        raise ValueError('Complete the final programme session before evaluating it.')
    students = Student.objects.filter(
        school_class_id=session.school_class_id,
        status='active',
    ).select_related('school_class__school').order_by('roll_number', 'student_id')
    results = []
    for student in students:
        state = checklist(student)
        non_score_blockers = [blocker for blocker in state['blockers'] if 'Overall score is ' not in blocker]
        if state['ready']:
            status = 'ready'
            reason = f"Ready for trainer approval at {state['overall_score']:.2f}%."
        elif non_score_blockers:
            status = 'pending'
            reason = '; '.join(state['blockers'])
        else:
            status = 'below_pass_mark'
            reason = '; '.join(state['blockers'])
        results.append({
            'student_id': student.student_id,
            'student_name': student.name,
            'overall_score': state['overall_score'],
            'state': status,
            'ready_for_certificate': state['ready'],
            'reason': reason,
            'blockers': state['blockers'],
            'attendance': state['attendance'],
            'quiz': state['quiz'],
            'project': state['project'],
            'final_session_ready': state['final_session_ready'],
        })
    ready = sum(row['state'] == 'ready' for row in results)
    pending = sum(row['state'] == 'pending' for row in results)
    below = sum(row['state'] == 'below_pass_mark' for row in results)
    return {
        'session_id': str(session.id),
        'evaluated_students': len(results),
        'ready': ready,
        'passed': ready,
        'eligible': ready,
        'pending': pending,
        'below_pass_mark': below,
        'failed_or_pending': pending + below,
        'pass_mark': PASS_MARK,
        'results': results,
    }


def approve_programme(user, student):
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only a trainer can approve the final programme session.')
    ensure_scope(user, student)
    state = checklist(student)
    if not state['ready']:
        raise ValueError('Programme is not ready: ' + ' '.join(state['blockers']))
    programme, _ = ProgrammeCompletion.objects.get_or_create(student=student)
    programme.status = 'trainer_requested'
    programme.overall_score = state['overall_score']
    programme.requested_by = user
    programme.requested_at = timezone.now()
    programme.completed_by = None
    programme.completed_at = None
    programme.save(update_fields=['status', 'overall_score', 'requested_by', 'requested_at', 'completed_by', 'completed_at', 'updated_at'])
    AuditLog.objects.create(actor=user, action=AuditAction.OTHER, entity_type='programme_completion', entity_id=str(student.pk), summary=f'Final programme approved for {student.student_id}.', changes={'overall_score': state['overall_score'], 'technologies': completed_technologies(student), 'final_session_id': state['final_session']['id'] if state['final_session'] else None})
    return programme


def issue_certificate(user, student):
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only the authorised trainer can issue the final certificate.')
    ensure_scope(user, student)
    programme = ProgrammeCompletion.objects.filter(student=student, status='trainer_requested').first()
    if not programme:
        raise ValueError('Approve the final programme before issuing the certificate.')
    state = checklist(student)
    if not state['ready']:
        raise ValueError('Certificate cannot be issued: ' + ' '.join(state['blockers']))
    existing = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
    if existing:
        return existing
    technologies = completed_technologies(student)
    units_snapshot = []
    for session in completed_sessions(student):
        technology = getattr(getattr(session, 'workflow', None), 'technology', None)
        units_snapshot.append({
            'technology': technology.name if technology else '',
            'unit_code': session.curriculum_unit.unit_code if session.curriculum_unit else '',
            'title': session.curriculum_unit.title if session.curriculum_unit else session.topic,
            'session_date': str(session.date),
            'topic': session.topic,
        })
    certificate_id = f"PX-{student.school_class.school.school_code}-{student.student_id}-{_today().year}-{uuid.uuid4().hex[:6].upper()}"
    origin = str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')
    verification_url = f'{origin}/verify?cert={quote(certificate_id)}'
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
        'overall_score': state['overall_score'],
        'pass_mark': PASS_MARK,
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
            overall_score=state['overall_score'],
            issued_by=user,
            snapshot=snapshot,
        )
        programme.completed_by = user
        programme.completed_at = timezone.now()
        programme.overall_score = state['overall_score']
        programme.save(update_fields=['completed_by', 'completed_at', 'overall_score', 'updated_at'])
        AuditLog.objects.create(actor=user, action=AuditAction.OTHER, entity_type='student_certificate', entity_id=str(student.pk), summary=f'Certificate issued for {student.student_id}.', changes={'certificate_id': certificate_id, 'overall_score': state['overall_score'], 'technologies': technologies})
    return certificate


def certificate_payload(certificate):
    data = dict(certificate.snapshot or {})
    origin = str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')
    verification_url = str(data.get('verification_url') or f'{origin}/verify?cert={quote(certificate.certificate_id)}')
    data.update({
        'certificate_id': certificate.certificate_id,
        'certificate_ref': certificate.certificate_id,
        'verification_token': str(certificate.verification_token),
        'verification_url': verification_url,
        'verified': certificate.status == 'issued',
        'issued': certificate.status == 'issued',
        'status': 'verified' if certificate.status == 'issued' else 'revoked',
        'technologies': certificate.technologies_snapshot,
        'completed_technologies': certificate.technologies_snapshot,
        'units': certificate.units_snapshot,
        'overall_score': float(certificate.overall_score),
        'pass_mark': PASS_MARK,
        'issued_at': certificate.issued_at.isoformat(),
    })
    return data
