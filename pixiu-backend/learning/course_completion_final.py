"""Canonical programme-completion service.

All completion views import this module. The v6 engine remains the single
source of truth for programme/final-session/certificate state; this wrapper
normalises score inputs to the same activity records used by the leaderboard.
"""

import logging

from django.db import transaction
from django.db.models import Avg, Max
from django.utils import timezone

from accounts.models import UserRole
from audit.models import AuditAction
from audit.services import record_audit

from . import course_completion_v6 as _engine
from .models import AssessmentStatus, Quiz, QuizAttempt, StudentAssessment
from .course_completion_models import ProgrammeCompletion

logger = logging.getLogger(__name__)


def quiz_metrics(student, taught_unit_codes=None):
    """Calculate quiz score from the student's actual completed attempts.

    Course Completion uses the same completed-attempt score source as the
    leaderboard so a valid attempt cannot become 0 merely because a quiz's
    curriculum-unit code differs from the session's code.
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
    """Use the same published practical/review records as class ranking."""
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
# score_data(), checklist(), evaluate_final_programme(), and certificate flows
# therefore all consume the same activity records as the leaderboard.
_engine.quiz_metrics = quiz_metrics
_engine.assessment_metrics = assessment_metrics

from .course_completion_v6 import *  # noqa: E402,F401,F403
from .course_completion_v6 import (
    PASS_MARK,
    WEIGHT_ATTENDANCE,
    WEIGHT_PRACTICAL,
    WEIGHT_QUIZ,
    WEIGHT_TRAINER_REVIEW,
)  # noqa: E402,F401


def approve_programme(user, student):
    """Perform the trainer approval as one controlled state transition.

    The certification gate is evaluated before writing anything. The programme
    row is then updated transactionally. Audit logging is deliberately
    non-blocking so an audit persistence problem can never turn a successful
    approval into an HTTP 500.
    """
    if user.role != UserRole.TRAINER:
        raise PermissionError('Only a trainer can approve the final programme session.')
    ensure_scope(user, student)
    state = checklist(student)
    if not state['ready']:
        raise ValueError('Programme is not ready: ' + ' '.join(state['blockers']))

    with transaction.atomic():
        programme, _ = ProgrammeCompletion.objects.select_for_update().get_or_create(student=student)
        programme.status = 'trainer_requested'
        programme.overall_score = state['overall_score']
        programme.requested_by = user
        programme.requested_at = timezone.now()
        programme.completed_by = None
        programme.completed_at = None
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
