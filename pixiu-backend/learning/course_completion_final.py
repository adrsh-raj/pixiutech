"""Canonical programme-completion service.

All completion views import this module.  The v6 engine remains the single
source of truth for programme/final-session/certificate state; this wrapper
normalises score inputs to the same activity records used by the leaderboard.
"""

from django.db.models import Avg, Max

from . import course_completion_v6 as _engine
from .models import AssessmentStatus, Quiz, QuizAttempt, StudentAssessment


def quiz_metrics(student, taught_unit_codes=None):
    """Calculate quiz score from the student's actual completed attempts.

    The leaderboard averages completed quiz attempts.  Course Completion uses
    the same score source so an attempted quiz cannot silently become 0% just
    because a curriculum-unit code or class-assignment link differs.

    Missing/unfinished quizzes are still reported separately from class-active
    quizzes assigned to the student's class.
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
        {
            "id": str(quiz.id),
            "title": quiz.title,
            "percentage": 0.0,
            "complete": False,
        }
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
# Functions such as score_data(), checklist(), evaluate_final_programme(),
# approve_programme(), and issue_certificate() resolve these names inside the
# engine module, so this gives the entire API one consistent scoring source.
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
