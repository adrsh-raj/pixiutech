"""Canonical programme-completion service.

All completion views import this module. The v6 engine remains the single
source of truth for programme/final-session/certificate state; this wrapper
keeps certificate, scorecard, ranking, and cohort evaluation on the same
server-side score calculation.
"""

import logging
from urllib.parse import quote

from django.db import transaction
from django.db.models import Avg, Max
from django.utils import timezone

from accounts.models import UserRole
from academics.models import Student
from audit.models import AuditAction

from . import cohort_evaluation as cohort
from . import course_completion_v6 as _engine
from .course_completion_models import Certificate, ProgrammeCompletion
from .models import AssessmentStatus, Quiz, QuizAttempt, StudentAssessment

logger = logging.getLogger(__name__)
PUBLIC_VERIFY_URL = "https://pixiutech.com/verify"


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
        "complete": bool(completed_quiz_ids) if not assigned else not missing,
        "rows": [
            {
                "id": str(quiz.id),
                "title": quiz.title,
                "percentage": next(
                    (float(row["best"]) for row in completed_attempts if str(row["quiz_id"]) == str(quiz.id)),
                    0.0,
                ),
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


# Keep the v6 engine's internal score_data()/checklist() aligned with the
# canonical records used by the leaderboard and cohort evaluation.
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


def class_ranking_data(student):
    """Return cohort-wide top-25% ranking from the canonical score engine."""
    return cohort.class_ranking_data(student)


def scorecard_data(certificate):
    """Return the frozen A4 scorecard data for an issued certificate."""
    return cohort.scorecard_data(certificate)


def class_evaluation_data(school_class, persist=False, evaluator=None):
    """Evaluate or inspect every active student in a class."""
    return cohort.class_evaluation_data(school_class, persist=persist, evaluator=evaluator)


def student_report_data(student):
    """Return server-authoritative progress data for print/report views."""
    return cohort.student_report_data(student)


def _attach_scorecard_snapshot(certificate):
    scorecard = cohort.class_ranking_data(certificate.student)
    snapshot = dict(certificate.snapshot or {})
    snapshot["scorecard"] = scorecard
    snapshot["class_rank"] = scorecard["class_rank"]
    snapshot["class_size"] = scorecard["class_size"]
    snapshot["verification_url"] = f"{PUBLIC_VERIFY_URL}?cert={quote(certificate.certificate_id)}"
    certificate.rank = scorecard["class_rank"]
    certificate.snapshot = snapshot
    certificate.save(update_fields=["rank", "snapshot"])
    return certificate


def issue_certificate(user, student):
    """Issue only after every active student in the class is fully evaluated."""
    cohort.assert_certificate_issuable(student)
    certificate = _engine_issue_certificate(user, student)
    snapshot = dict(certificate.snapshot or {})
    snapshot["verification_url"] = f"{PUBLIC_VERIFY_URL}?cert={quote(certificate.certificate_id)}"
    certificate.snapshot = snapshot
    certificate.save(update_fields=["snapshot"])
    try:
        return _attach_scorecard_snapshot(certificate)
    except Exception:
        logger.exception("Scorecard snapshot generation failed for %s", student.student_id)
        return certificate


def _certificate_unit_rows(certificate):
    """Return deduplicated unit rows with the recorded practical score."""
    source = certificate.units_snapshot or []
    if not source:
        source = (certificate.snapshot or {}).get("units") or []

    cutoff = getattr(certificate.issued_at, "date", lambda: timezone.localdate())()
    score_rows = list(
        StudentAssessment.objects.filter(
            student=certificate.student,
            status=AssessmentStatus.PUBLISHED,
            score__isnull=False,
            assessment_date__lte=cutoff,
        ).values("unit_code").annotate(score=Avg("score"))
    )
    score_map = {
        str(row["unit_code"]).strip().upper(): float(row["score"])
        for row in score_rows
        if row.get("unit_code") and row.get("score") is not None
    }

    grouped = {}
    for row in source:
        if not isinstance(row, dict):
            continue
        technology = str(row.get("technology") or row.get("technology_name") or "").strip()
        unit_code = str(row.get("unit_code") or row.get("code") or "").strip()
        title = str(row.get("title") or row.get("topic") or "Technology Unit").strip()
        key = (technology.lower(), unit_code.upper(), title.lower())
        item = grouped.setdefault(
            key,
            {"technology": technology, "unit_code": unit_code, "title": title, "sessions": 0, "score": None},
        )
        item["sessions"] += int(row.get("sessions") or 1)
        if row.get("score") is not None:
            try:
                item["score"] = float(row["score"])
            except (TypeError, ValueError):
                pass
        if item["score"] is None and unit_code:
            item["score"] = score_map.get(unit_code.upper())

    return sorted(grouped.values(), key=lambda row: (row["technology"].lower(), row["unit_code"].upper(), row["title"].lower()))


def certificate_payload(certificate):
    """Expose public certificate data without private class-ranking rows."""
    data = _engine_certificate_payload(certificate)
    units = _certificate_unit_rows(certificate)
    data["units"] = units
    data["completion_count"] = len(units)
    data["required_completion_count"] = len(units)
    for key in ("scorecard", "class_rank", "class_size"):
        data.pop(key, None)
    rank = certificate.rank
    class_size = None
    if isinstance(certificate.snapshot, dict):
        class_size = certificate.snapshot.get("class_size")
    data["rank_display"] = f"{rank}/{class_size}" if rank and class_size and int(rank) <= 10 else "-"
    data["verification_url"] = f"{PUBLIC_VERIFY_URL}?cert={quote(certificate.certificate_id)}"
    return data


def approve_programme(user, student):
    """Perform trainer approval as one controlled state transition."""
    if user.role != UserRole.TRAINER:
        raise PermissionError("Only a trainer can approve the final programme session.")
    ensure_scope(user, student)
    state = checklist(student)
    if not state["ready"]:
        raise ValueError("Programme is not ready: " + " ".join(state["blockers"]))

    with transaction.atomic():
        programme, created = ProgrammeCompletion.objects.select_for_update().get_or_create(student=student)
        programme.status = "trainer_requested"
        programme.overall_score = state["overall_score"]
        programme.requested_by = user
        programme.requested_at = timezone.now()
        programme.completed_by = None
        programme.completed_at = None
        if created:
            programme.save()
        else:
            programme.save(update_fields=[
                "status", "overall_score", "requested_by", "requested_at",
                "completed_by", "completed_at", "updated_at",
            ])

    try:
        record_audit(
            actor=user,
            action=AuditAction.APPROVE,
            entity_type="programme_completion",
            entity_id=str(student.pk),
            summary=f"Final programme approved for {student.student_id}.",
            changes={
                "overall_score": state["overall_score"],
                "technologies": completed_technologies(student),
                "final_session_id": state["final_session"]["id"] if state["final_session"] else None,
            },
        )
    except Exception:
        logger.exception("Programme approval succeeded but audit logging failed for %s", student.student_id)

    return programme
