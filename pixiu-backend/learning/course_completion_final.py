"""Canonical programme-completion service.

All completion views import this module. The v6 engine remains the single
source of truth for programme/final-session/certificate state; this wrapper
normalises score inputs and keeps certificate ranking/scorecards tied to the
same server-side score calculation.
"""

import logging

from django.db import transaction
from django.db.models import Avg, Max
from django.utils import timezone

from accounts.models import UserRole
from academics.models import Student
from audit.models import AuditAction

from . import course_completion_v6 as _engine
from .models import AssessmentStatus, Quiz, QuizAttempt, StudentAssessment
from .course_completion_models import Certificate, ProgrammeCompletion

logger = logging.getLogger(__name__)


def quiz_metrics(student, taught_unit_codes=None):
    """Calculate quiz score from actual completed attempts.

    Course Completion uses the best completed attempt per quiz, matching the
    score source used by the certificate and scorecard.
    """
    completed_attempts = list(
        QuizAttempt.objects.filter(student=student, status="completed")
        .values("quiz_id")
        .annotate(best=Max("percentage"))
    )
    completed_scores = [float(row["best"]) for row in completed_attempts if row["best"] is not None]

    assigned = list(
        Quiz.objects.filter(
            status__in=["active", "closed"],
            class_assignments__school_class_id=student.school_class_id,
        ).distinct().order_by("id")
    )
    completed_quiz_ids = {str(row["quiz_id"]) for row in completed_attempts}
    missing = [
        {"id": str(quiz.id), "title": quiz.title, "percentage": 0.0, "complete": False}
        for quiz in assigned
        if str(quiz.id) not in completed_quiz_ids
    ]

    return {
        "percentage": round(sum(completed_scores) / len(completed_scores), 2) if completed_scores else 0.0,
        "assigned": len(assigned),
        "completed": len(completed_quiz_ids),
        "missing": missing,
        "complete": bool(completed_scores) if not assigned else not missing,
        "rows": [
            {
                "id": str(quiz.id),
                "title": quiz.title,
                "percentage": next((float(row["best"]) for row in completed_attempts if str(row["quiz_id"]) == str(quiz.id)), 0.0),
                "complete": str(quiz.id) in completed_quiz_ids,
            }
            for quiz in assigned
        ],
    }


def assessment_metrics(student, taught_unit_codes=None):
    """Use the published practical/review records as the score source."""
    practical = StudentAssessment.objects.filter(
        student=student,
        status=AssessmentStatus.PUBLISHED,
        score__isnull=False,
    ).aggregate(value=Avg("score"))["value"]
    review = StudentAssessment.objects.filter(
        student=student,
        status=AssessmentStatus.PUBLISHED,
        rating__isnull=False,
    ).aggregate(value=Avg("rating"))["value"]
    return {
        "practical_pct": round(float(practical), 2) if practical is not None else 0.0,
        "trainer_review_pct": round(float(review) * 20, 2) if review is not None else 0.0,
        "trainer_review_rating": round(float(review), 2) if review is not None else None,
    }


# Patch the engine's global helpers before re-exporting its public functions.
_engine.quiz_metrics = quiz_metrics
_engine.assessment_metrics = assessment_metrics

from .course_completion_v6 import *  # noqa: E402,F401,F403
from .course_completion_v6 import (
    PASS_MARK,
    WEIGHT_ATTENDANCE,
    WEIGHT_PRACTICAL,
    WEIGHT_QUIZ,
    WEIGHT_TRAINER_REVIEW,
    certificate_payload as _engine_certificate_payload,
    issue_certificate as _engine_issue_certificate,
)  # noqa: E402,F401


def _student_score_row(student):
    _sessions, _taught_codes, attendance, quiz, assessment, overall = score_data(student)
    return {
        'student_id': student.student_id,
        'student_name': student.name,
        'roll_number': student.roll_number,
        'attendance_pct': float(attendance.get('percentage', 0.0)),
        'quiz_pct': float(quiz.get('percentage', 0.0)),
        'practical_pct': float(assessment.get('practical_pct', 0.0)),
        'trainer_review_pct': float(assessment.get('trainer_review_pct', 0.0)),
        'overall_score': float(overall),
    }


def class_ranking_data(student):
    """Build the deterministic class ranking from the certificate score engine."""
    students = list(
        Student.objects.filter(
            school_class_id=student.school_class_id,
            status='active',
        ).select_related('school_class__school').only(
            'id', 'student_id', 'name', 'roll_number', 'school_class',
        )
    )
    rows = [_student_score_row(peer) for peer in students]
    rows.sort(
        key=lambda row: (
            -row['overall_score'],
            -row['attendance_pct'],
            row['roll_number'] if row['roll_number'] is not None else 10**9,
            str(row['student_id']),
        )
    )
    class_size = len(rows)
    for index, row in enumerate(rows, start=1):
        row['rank'] = index
        row['rank_display'] = f'{index}/{class_size}' if index <= 10 else '-'

    current = next((row for row in rows if str(row['student_id']) == str(student.student_id)), None)
    top10 = [
        {
            'rank': row['rank'],
            'rank_display': row['rank_display'],
            'student_id': row['student_id'],
            'student_name': row['student_name'],
            'overall_score': row['overall_score'],
        }
        for row in rows[:10]
    ]
    return {
        'class_size': class_size,
        'class_rank': current['rank'] if current else None,
        'rank_display': current['rank_display'] if current else '-',
        'top10_ranking': top10,
        'attendance_pct': current['attendance_pct'] if current else 0.0,
        'quiz_pct': current['quiz_pct'] if current else 0.0,
        'practical_pct': current['practical_pct'] if current else 0.0,
        'trainer_review_pct': current['trainer_review_pct'] if current else 0.0,
    }


def scorecard_data(certificate):
    """Return the frozen A4 scorecard data for an issued certificate."""
    stored = dict(certificate.snapshot or {})
    stored_scorecard = stored.get('scorecard') if isinstance(stored.get('scorecard'), dict) else None
    if stored_scorecard:
        data = dict(stored_scorecard)
        data.setdefault('class_size', 0)
        data.setdefault('class_rank', certificate.rank)
        rank = data.get('class_rank')
        class_size = int(data.get('class_size') or 0)
        data['rank_display'] = f'{rank}/{class_size}' if rank and class_size and int(rank) <= 10 else '-'
        return data
    return class_ranking_data(certificate.student)


def _attach_scorecard_snapshot(certificate):
    scorecard = class_ranking_data(certificate.student)
    snapshot = dict(certificate.snapshot or {})
    snapshot['scorecard'] = scorecard
    snapshot['class_rank'] = scorecard['class_rank']
    snapshot['class_size'] = scorecard['class_size']
    certificate.rank = scorecard['class_rank']
    certificate.snapshot = snapshot
    certificate.save(update_fields=['rank', 'snapshot'])
    return certificate


def _certificate_unit_rows(certificate):
    """Return deduplicated unit rows with the recorded practical score.

    Older certificates stored one row per session and omitted unit scores.
    This normalises those snapshots at read time so the public verification
    page and certificate PDF show one row per taught unit with a real session
    count and, when published, its unit assessment score.
    """
    source = certificate.units_snapshot or []
    if not source:
        source = (certificate.snapshot or {}).get('units') or []

    cutoff = getattr(certificate.issued_at, 'date', lambda: timezone.localdate())()
    score_rows = list(
        StudentAssessment.objects.filter(
            student=certificate.student,
            status=AssessmentStatus.PUBLISHED,
            score__isnull=False,
            assessment_date__lte=cutoff,
        ).values('unit_code').annotate(score=Avg('score'))
    )
    score_map = {
        str(row['unit_code']).strip().upper(): float(row['score'])
        for row in score_rows
        if row.get('unit_code') and row.get('score') is not None
    }

    grouped = {}
    for row in source:
        if not isinstance(row, dict):
            continue
        technology = str(row.get('technology') or row.get('technology_name') or '').strip()
        unit_code = str(row.get('unit_code') or row.get('code') or '').strip()
        title = str(row.get('title') or row.get('topic') or 'Technology Unit').strip()
        key = (technology.lower(), unit_code.upper(), title.lower())
        item = grouped.setdefault(
            key,
            {
                'technology': technology,
                'unit_code': unit_code,
                'title': title,
                'sessions': 0,
                'score': None,
            },
        )
        item['sessions'] += int(row.get('sessions') or 1)
        if row.get('score') is not None:
            try:
                item['score'] = float(row['score'])
            except (TypeError, ValueError):
                pass
        if item['score'] is None and unit_code:
            item['score'] = score_map.get(unit_code.upper())

    return sorted(grouped.values(), key=lambda row: (row['technology'].lower(), row['unit_code'].upper(), row['title'].lower()))


def issue_certificate(user, student):
    """Issue the certificate through the canonical engine and freeze ranking."""
    certificate = _engine_issue_certificate(user, student)
    try:
        return _attach_scorecard_snapshot(certificate)
    except Exception:
        logger.exception('Scorecard snapshot generation failed for %s', student.student_id)
        return certificate


def certificate_payload(certificate):
    """Expose public certificate data without private class-ranking rows."""
    data = _engine_certificate_payload(certificate)
    units = _certificate_unit_rows(certificate)
    data['units'] = units
    data['completion_count'] = len(units)
    data['required_completion_count'] = len(units)
    for key in ('scorecard', 'class_rank', 'class_size'):
        data.pop(key, None)
    rank = certificate.rank
    class_size = None
    if isinstance(certificate.snapshot, dict):
        class_size = certificate.snapshot.get('class_size')
    data['rank_display'] = f'{rank}/{class_size}' if rank and class_size and int(rank) <= 10 else '-'
    return data


def approve_programme(user, student):
    """Perform trainer approval as one controlled state transition."""
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only a trainer can approve the final programme session.')
    ensure_scope(user, student)
    state = checklist(student)
    if not state['ready']:
        raise ValueError('Programme is not ready: ' + ' '.join(state['blockers']))

    with transaction.atomic():
        programme, created = ProgrammeCompletion.objects.select_for_update().get_or_create(student=student)
        programme.status = 'trainer_requested'
        programme.overall_score = state['overall_score']
        programme.requested_by = user
        programme.requested_at = timezone.now()
        programme.completed_by = None
        programme.completed_at = None
        if created:
            programme.save()
        else:
            programme.save(update_fields=[
                'status', 'overall_score', 'requested_by', 'requested_at',
                'completed_by', 'completed_at', 'updated_at',
            ])

    try:
        record_audit(
            actor=user,
            action=AuditAction.APPROVE,
            entity_type='programme_completion',
            entity_id=str(student.pk),
            summary=f'Final programme approved for {student.student_id}.',
            changes={
                'overall_score': state['overall_score'],
                'technologies': completed_technologies(student),
                'final_session_id': state['final_session']['id'] if state['final_session'] else None,
            },
        )
    except Exception:
        logger.exception('Programme approval succeeded but audit logging failed for %s', student.student_id)

    return programme
