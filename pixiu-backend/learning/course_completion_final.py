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
from audit.services import record_audit

from . import cohort_evaluation as cohort
from . import course_completion_v6 as _engine
from .course_completion_models import Certificate, ProgrammeCompletion
from .models import AssessmentStatus, Quiz, QuizAttempt, StudentAssessment

logger = logging.getLogger(__name__)
PUBLIC_VERIFY_URL = "https://pixiutech.com/verify"


def quiz_metrics(student, taught_unit_codes=None):
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
        for quiz in assigned if str(quiz.id) not in completed_quiz_ids
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
                "percentage": next((float(row["best"]) for row in completed_attempts if str(row["quiz_id"]) == str(quiz.id)), 0.0),
                "complete": str(quiz.id) in completed_quiz_ids,
            }
            for quiz in assigned
        ],
    }


def assessment_metrics(student, taught_unit_codes=None):
    practical = StudentAssessment.objects.filter(
        student=student, status=AssessmentStatus.PUBLISHED, score__isnull=False,
    ).aggregate(value=Avg("score"))["value"]
    review = StudentAssessment.objects.filter(
        student=student, status=AssessmentStatus.PUBLISHED, rating__isnull=False,
    ).aggregate(value=Avg("rating"))["value"]
    return {
        "practical_pct": round(float(practical), 2) if practical is not None else 0.0,
        "trainer_review_pct": round(float(review) * 20, 2) if review is not None else 0.0,
        "trainer_review_rating": round(float(review), 2) if review is not None else None,
    }


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
    return cohort.class_ranking_data(student)


def scorecard_data(certificate):
    return cohort.scorecard_data(certificate)


def class_evaluation_data(school_class, persist=False, evaluator=None):
    return cohort.class_evaluation_data(school_class, persist=persist, evaluator=evaluator)


def student_report_data(student):
    return cohort.student_report_data(student)


def _attach_scorecard_snapshot(certificate):
    scorecard = cohort.class_ranking_data(certificate.student)
    snapshot = dict(certificate.snapshot or {})
    snapshot["scorecard"] = scorecard
    snapshot["class_rank"] = scorecard["class_rank"]
    snapshot["class_size"] = scorecard["class_size"]
    snapshot["rank_slots"] = scorecard.get("rank_slots", 0)
    snapshot["verification_url"] = f"{PUBLIC_VERIFY_URL}?cert={quote(certificate.certificate_id)}"
    certificate.rank = scorecard["class_rank"]
    certificate.snapshot = snapshot
    certificate.save(update_fields=["rank", "snapshot"])
    return certificate


def issue_certificate(user, student):
    cohort.assert_certificate_issuable(student)

    # Let the canonical engine perform its permission/scope checks even when
    # a certificate already exists. Never rewrite an issued credential merely
    # because someone opens the issue operation again.
    existing = Certificate.objects.filter(
        student=student,
        status="issued",
    ).order_by("-issued_at").first()

    certificate = _engine_issue_certificate(user, student)
    if existing and certificate.pk == existing.pk:
        return certificate

    snapshot = dict(certificate.snapshot or {})
    snapshot["verification_url"] = f"{PUBLIC_VERIFY_URL}?cert={quote(certificate.certificate_id)}"

    # Freeze the published marks at certificate issuance time. Verification
    # must not change later if an LMS assessment row is edited.
    try:
        evaluation = cohort.evaluate_student(student)
        unit_evaluations = {
            str(row.get("unit_code") or "").strip().upper(): row
            for row in evaluation.get("units", [])
            if row.get("unit_code")
        }

        frozen_units = []
        for row in (certificate.units_snapshot or snapshot.get("units") or []):
            item = dict(row) if isinstance(row, dict) else {"title": str(row)}
            unit_code = str(item.get("unit_code") or "").strip().upper()
            unit_eval = unit_evaluations.get(unit_code, {})
            unit_score = unit_eval.get("score")
            if unit_score is not None:
                item["score"] = float(unit_score)
                item["marks"] = float(unit_score)
                item["status"] = unit_eval.get("status")
            frozen_units.append(item)

        certificate.units_snapshot = frozen_units
        snapshot["units"] = frozen_units
        snapshot["marks"] = frozen_units
        snapshot["score_breakdown"] = {
            "overall_score": float(evaluation.get("overall_score", certificate.overall_score or 0)),
            "attendance_pct": float(evaluation.get("attendance", {}).get("percentage", 0)),
            "quiz_pct": float(evaluation.get("quiz", {}).get("percentage", 0)),
            "practical_pct": float(evaluation.get("assessment", {}).get("practical_pct", 0)),
            "trainer_review_pct": float(evaluation.get("assessment", {}).get("trainer_review_pct", 0)),
            "pass_mark": PASS_MARK,
        }
    except Exception:
        logger.exception("Immutable marks snapshot failed for %s", student.student_id)

    certificate.snapshot = snapshot
    certificate.save(update_fields=["snapshot", "units_snapshot"])

    try:
        return _attach_scorecard_snapshot(certificate)
    except Exception:
        logger.exception("Scorecard snapshot generation failed for %s", student.student_id)
        return certificate


def _certificate_unit_rows(certificate):
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
        for row in score_rows if row.get("unit_code") and row.get("score") is not None
    }
    grouped = {}
    for row in source:
        if not isinstance(row, dict):
            continue
        technology = str(row.get("technology") or row.get("technology_name") or "").strip()
        unit_code = str(row.get("unit_code") or row.get("code") or "").strip()
        title = str(row.get("title") or row.get("topic") or "Technology Unit").strip()
        key = (technology.lower(), unit_code.upper(), title.lower())
        item = grouped.setdefault(key, {"technology": technology, "unit_code": unit_code, "title": title, "sessions": 0, "score": None})
        item["sessions"] += int(row.get("sessions") or 1)
        if row.get("score") is not None:
            try:
                item["score"] = float(row["score"])
            except (TypeError, ValueError):
                pass
        if row.get("marks") is not None and item["score"] is None:
            try:
                item["score"] = float(row["marks"])
            except (TypeError, ValueError):
                pass
        if item["score"] is None and unit_code:
            item["score"] = score_map.get(unit_code.upper())
    return sorted(grouped.values(), key=lambda row: (row["technology"].lower(), row["unit_code"].upper(), row["title"].lower()))


def certificate_payload(certificate):
    data = _engine_certificate_payload(certificate)
    units = _certificate_unit_rows(certificate)
    data["units"] = units
    data["marks"] = units
    data["completion_count"] = len(units)
    data["required_completion_count"] = len(units)

    # Public verification exposes the verified student's published rank
    # metadata only. The authenticated LMS retains the full leaderboard.
    stored_scorecard = data.get("scorecard") if isinstance(data.get("scorecard"), dict) else {}
    class_size = stored_scorecard.get("class_size") or data.get("class_size")
    rank_slots = stored_scorecard.get("rank_slots") or data.get("rank_slots")
    rank = certificate.rank

    try:
        class_size = int(class_size) if class_size is not None else None
    except (TypeError, ValueError):
        class_size = None

    if rank_slots is None and class_size:
        rank_slots = cohort.ceil(class_size * cohort.TOP_RANK_FRACTION)

    try:
        rank_slots = int(rank_slots) if rank_slots is not None else None
    except (TypeError, ValueError):
        rank_slots = None

    try:
        rank = int(rank) if rank is not None else None
    except (TypeError, ValueError):
        rank = None

    is_top25 = bool(rank and rank_slots and rank <= rank_slots)
    data["class_rank"] = rank if is_top25 else None
    data["class_size"] = class_size
    data["rank_slots"] = rank_slots or 0
    data["is_top25"] = is_top25
    data["rank_display"] = f"{rank}/{class_size}" if is_top25 and class_size else "-"
    data["ranking_scope"] = "top_25_percent"
    data["ranking_public"] = True

    snapshot_breakdown = data.get("score_breakdown")
    if not isinstance(snapshot_breakdown, dict) or not snapshot_breakdown:
        snapshot_breakdown = stored_scorecard

    data["score_breakdown"] = {
        "overall_score": float(snapshot_breakdown.get("overall_score", certificate.overall_score or 0)),
        "attendance_pct": float(snapshot_breakdown.get("attendance_pct", 0)),
        "quiz_pct": float(snapshot_breakdown.get("quiz_pct", 0)),
        "practical_pct": float(snapshot_breakdown.get("practical_pct", 0)),
        "trainer_review_pct": float(snapshot_breakdown.get("trainer_review_pct", 0)),
        "pass_mark": float(snapshot_breakdown.get("pass_mark", PASS_MARK)),
    }

    # Do not expose the full top-ranking list on a public certificate page.
    data.pop("scorecard", None)
    data.pop("top_ranking", None)
    data.pop("top25_ranking", None)

    data["verification_url"] = f"{PUBLIC_VERIFY_URL}?cert={quote(certificate.certificate_id)}"
    return data


def approve_programme(user, student):
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
                "status", "overall_score", "requested_by", "requested_at", "completed_by", "completed_at", "updated_at",
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
