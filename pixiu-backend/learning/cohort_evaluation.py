from collections import OrderedDict
from math import ceil

from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone

from .course_completion_models import CompletionPolicy, ProgrammeCompletion, UnitCompletion
from .models import AttendanceStatus, Project, Quiz, QuizAttempt, Session, SessionWorkflow, StudentAssessment, AssessmentStatus

PASS_MARK = 70.0
TOP_RANK_FRACTION = 0.25


def _policy(school_class):
    return (
        CompletionPolicy.objects.filter(school_class=school_class, active=True).first()
        or CompletionPolicy.objects.filter(school_class__isnull=True, active=True).first()
        or CompletionPolicy.objects.create(school_class=None, name="Standard Pixiu completion policy")
    )


def _completed_sessions(school_class):
    return list(
        Session.objects.filter(school_class=school_class, status="completed")
        .select_related("curriculum_unit", "workflow__technology", "trainer")
        .order_by("date", "start_time", "id")
    )


def _final_session(school_class):
    return (
        Session.objects.filter(
            school_class=school_class,
            status="completed",
            workflow__is_last_session_for_unit=True,
        )
        .select_related("curriculum_unit", "workflow__technology")
        .order_by("-date", "-start_time", "-id")
        .first()
    )


def _final_is_latest(final_session, sessions):
    if not final_session:
        return False
    return final_session.id == sessions[-1].id if sessions else False


def _attendance(student, sessions):
    rows = list(
        student.attendance_records.filter(session_id__in=[item.id for item in sessions]).only("session_id", "status")
    )
    by_session = {str(row.session_id): row.status for row in rows}
    missing = [item for item in sessions if str(item.id) not in by_session]
    attended = sum(
        1 for status in by_session.values()
        if status in {AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED}
    )
    return {
        "percentage": round(attended * 100 / len(sessions), 2) if sessions else 0.0,
        "attended": attended,
        "total": len(sessions),
        "marked": len(rows),
        "missing": [
            {"session_id": str(item.id), "date": str(item.date), "topic": item.topic}
            for item in missing
        ],
        "complete": not missing,
    }


def _quiz(student):
    quizzes = list(
        Quiz.objects.filter(
            status__in=["active", "closed"],
            class_assignments__school_class_id=student.school_class_id,
        ).distinct().order_by("id")
    )
    rows = []
    for quiz in quizzes:
        best = QuizAttempt.objects.filter(student=student, quiz=quiz, status="completed").aggregate(value=Max("percentage"))["value"]
        rows.append({
            "id": str(quiz.id),
            "title": quiz.title,
            "unit_code": str(quiz.unit_code or "").strip().upper(),
            "percentage": float(best) if best is not None else 0.0,
            "complete": best is not None,
        })
    scores = [row["percentage"] for row in rows if row["complete"]]
    return {
        "percentage": round(sum(scores) / len(scores), 2) if scores else 0.0,
        "assigned": len(rows),
        "completed": sum(1 for row in rows if row["complete"]),
        "missing": [row for row in rows if not row["complete"]],
        "complete": not any(not row["complete"] for row in rows),
        "rows": rows,
    }


def _assessments(student):
    practical = list(
        StudentAssessment.objects.filter(
            student=student,
            status=AssessmentStatus.PUBLISHED,
            score__isnull=False,
        ).values("unit_code", "score", "title", "feedback")
    )
    reviews = list(
        StudentAssessment.objects.filter(
            student=student,
            status=AssessmentStatus.PUBLISHED,
            rating__isnull=False,
        ).values("unit_code", "rating", "title", "feedback")
    )
    practical_values = [float(row["score"]) for row in practical]
    review_values = [float(row["rating"]) for row in reviews]
    return {
        "practical_pct": round(sum(practical_values) / len(practical_values), 2) if practical_values else 0.0,
        "trainer_review_pct": round(sum(review_values) / len(review_values) * 20, 2) if review_values else 0.0,
        "trainer_review_rating": round(sum(review_values) / len(review_values), 2) if review_values else None,
        "has_practical": bool(practical_values),
        "has_review": bool(review_values),
        "practical_rows": practical,
        "review_rows": reviews,
    }


def _project(student):
    latest = Project.objects.filter(student=student).order_by("-created_at").first()
    completed = Project.objects.filter(student=student, status="completed").exists()
    return {
        "complete": completed,
        "status": latest.status if latest else None,
        "title": latest.title if latest else None,
        "score": float(latest.score) if latest and latest.score is not None else None,
    }


def _overall(attendance, quiz, assessment):
    return round(
        assessment["practical_pct"] * 0.40
        + quiz["percentage"] * 0.25
        + attendance["percentage"] * 0.20
        + assessment["trainer_review_pct"] * 0.15,
        2,
    )


def _student_units(student, sessions, policy, quiz_rows, assessment):
    grouped = OrderedDict()
    for session in sessions:
        if not session.curriculum_unit_id:
            continue
        key = str(session.curriculum_unit_id)
        grouped.setdefault(key, []).append(session)

    units = []
    for unit_id, unit_sessions in grouped.items():
        unit = unit_sessions[0].curriculum_unit
        code = str(unit.unit_code or "").strip().upper()
        attendance_rows = list(
            student.attendance_records.filter(session_id__in=[item.id for item in unit_sessions]).only("status")
        )
        attended = sum(
            1 for row in attendance_rows
            if row.status in {AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED}
        )
        attendance_pct = round(attended * 100 / len(unit_sessions), 2) if unit_sessions else 0.0
        matching_quizzes = [row for row in quiz_rows if row["unit_code"] == code]
        quiz_scores = [row["percentage"] for row in matching_quizzes if row["complete"]]
        quiz_pct = round(sum(quiz_scores) / len(quiz_scores), 2) if quiz_scores else 0.0
        practical = [row for row in assessment["practical_rows"] if str(row["unit_code"] or "").strip().upper() == code]
        review = [row for row in assessment["review_rows"] if str(row["unit_code"] or "").strip().upper() == code]
        practical_pct = round(sum(float(row["score"]) for row in practical) / len(practical), 2) if practical else 0.0
        review_avg = round(sum(float(row["rating"]) for row in review) / len(review), 2) if review else None
        review_pct = review_avg * 20 if review_avg is not None else 0.0

        reasons = []
        if policy.requires_attendance and len(attendance_rows) < len(unit_sessions):
            reasons.append("Attendance is not marked for every taught session.")
        if policy.requires_quiz and matching_quizzes and any(not row["complete"] for row in matching_quizzes):
            reasons.append("Unit quiz is pending.")
        if policy.requires_practical and not practical:
            reasons.append("Practical evaluation is pending.")
        if policy.requires_trainer_review and not review:
            reasons.append("Trainer review is pending.")

        score = round(
            practical_pct * 0.40 + quiz_pct * 0.25 + attendance_pct * 0.20 + review_pct * 0.15,
            2,
        )
        status = "pending" if reasons else ("passed" if score >= PASS_MARK else "failed")
        units.append({
            "curriculum_unit_id": unit_id,
            "technology": getattr(getattr(unit_sessions[0], "workflow", None), "technology", None).name if getattr(getattr(unit_sessions[0], "workflow", None), "technology", None) else "",
            "unit_code": code,
            "title": unit.title,
            "sessions_count": len(unit_sessions),
            "completed_sessions": sum(1 for item in unit_sessions if item.status == "completed"),
            "attendance_pct": attendance_pct,
            "quiz_pct": quiz_pct,
            "practical_pct": practical_pct,
            "trainer_review_pct": round(review_pct, 2),
            "trainer_review_rating": review_avg,
            "score": score,
            "status": status,
            "reasons": reasons,
            "final_session_id": str(unit_sessions[-1].id),
        })
    return units


def evaluate_student(student, sessions=None, policy=None):
    sessions = sessions if sessions is not None else _completed_sessions(student.school_class)
    policy = policy or _policy(student.school_class)
    attendance = _attendance(student, sessions)
    quiz = _quiz(student)
    assessment = _assessments(student)
    project = _project(student)
    final = _final_session(student.school_class)
    final_ready = _final_is_latest(final, sessions)
    score = _overall(attendance, quiz, assessment)

    blockers = []
    if not final_ready:
        blockers.append("The final completed session is not correctly marked as the programme last session.")
    if policy.requires_attendance and attendance["missing"]:
        blockers.append("Attendance is unmarked for one or more completed sessions.")
    if policy.requires_quiz and quiz["missing"]:
        blockers.append("One or more assigned quizzes are still incomplete.")
    if not project["complete"]:
        blockers.append("The required laboratory project is not marked completed.")
    if policy.requires_practical and not assessment["has_practical"]:
        blockers.append("Practical evaluation is pending.")
    if policy.requires_trainer_review and not assessment["has_review"]:
        blockers.append("Trainer review is pending.")

    units = _student_units(student, sessions, policy, quiz["rows"], assessment)
    evaluated_units = [row for row in units if row["status"] != "pending"]
    fully_evaluated = not blockers
    passed = fully_evaluated and score >= PASS_MARK
    state = "passed" if passed else ("not_passed" if fully_evaluated else "pending")
    return {
        "student_id": student.student_id,
        "student_name": student.name,
        "student_pk": str(student.id),
        "roll_number": student.roll_number,
        "overall_score": score,
        "state": state,
        "fully_evaluated": fully_evaluated,
        "passed": passed,
        "not_passed": fully_evaluated and not passed,
        "blockers": blockers,
        "attendance": attendance,
        "quiz": quiz,
        "assessment": assessment,
        "project": project,
        "final_session_ready": final_ready,
        "final_session": {
            "id": str(final.id),
            "date": str(final.date),
            "topic": final.topic,
            "technology": getattr(getattr(final, "workflow", None), "technology", None).name if getattr(getattr(final, "workflow", None), "technology", None) else "",
            "trainer_name": getattr(getattr(final, "trainer", None), "name", "") or "",
            "trainer_id": getattr(getattr(final, "trainer", None), "trainer_id", "") or "",
        } if final else None,
        "units": units,
        "evaluated_units": len(evaluated_units),
        "required_units": len(units),
        "level_status": "Passed" if passed else ("Not Passed" if fully_evaluated else "Evaluation Pending"),
    }


def _persist_unit_rows(student, result):
    for unit in result["units"]:
        UnitCompletion.objects.update_or_create(
            student=student,
            curriculum_unit_id=unit["curriculum_unit_id"],
            defaults={
                "final_session_id": unit["final_session_id"],
                "status": unit["status"],
                "attendance_pct": unit["attendance_pct"],
                "quiz_pct": unit["quiz_pct"],
                "practical_pct": unit["practical_pct"],
                "trainer_review_avg": unit["trainer_review_rating"],
                "score": unit["score"],
                "reasons": unit["reasons"],
                "completed_at": timezone.now() if unit["status"] in {"passed", "failed"} else None,
            },
        )


def _persist_programme(student, result, evaluator=None):
    programme, _ = ProgrammeCompletion.objects.get_or_create(student=student)
    programme.overall_score = result["overall_score"]
    if result["passed"]:
        programme.status = "trainer_requested"
        programme.requested_by = evaluator
        programme.requested_at = timezone.now()
        programme.completed_by = None
        programme.completed_at = None
    else:
        programme.status = "in_progress"
        programme.requested_by = None
        programme.requested_at = None
        programme.completed_by = None
        programme.completed_at = None
    programme.save()
    return programme


def class_evaluation_data(school_class, persist=False, evaluator=None):
    sessions = _completed_sessions(school_class)
    policy = _policy(school_class)
    students = list(
        school_class.students.filter(status="active").select_related("school_class__school").order_by("roll_number", "student_id")
    )
    results = [evaluate_student(student, sessions=sessions, policy=policy) for student in students]

    if persist:
        with transaction.atomic():
            for student, result in zip(students, results):
                _persist_unit_rows(student, result)
                _persist_programme(student, result, evaluator=evaluator)

    class_size = len(results)
    passed_rows = sorted(
        [row for row in results if row["passed"]],
        key=lambda row: (-row["overall_score"], -row["attendance"]["percentage"], row["roll_number"] if row["roll_number"] is not None else 10**9, str(row["student_id"])),
    )
    rank_slots = ceil(class_size * TOP_RANK_FRACTION) if class_size else 0
    ranking = []
    for index, row in enumerate(passed_rows, start=1):
        row["rank"] = index
        row["rank_display"] = f"{index}/{class_size}" if index <= rank_slots else "-"
        if index <= rank_slots:
            ranking.append({
                "rank": index,
                "rank_display": row["rank_display"],
                "student_id": row["student_id"],
                "student_name": row["student_name"],
                "overall_score": row["overall_score"],
            })

    by_student = {str(row["student_id"]): row for row in results}
    for index, row in enumerate(passed_rows, start=1):
        by_student[str(row["student_id"])]["rank"] = index
        by_student[str(row["student_id"])]["rank_display"] = f"{index}/{class_size}" if index <= rank_slots else "-"
    for row in results:
        row.setdefault("rank", None)
        row.setdefault("rank_display", "-")

    pending = [row for row in results if not row["fully_evaluated"]]
    not_passed = [row for row in results if row["not_passed"]]
    passed = [row for row in results if row["passed"]]
    programme_rows = ProgrammeCompletion.objects.filter(student__school_class=school_class, student__status="active")
    evaluated_programmes = programme_rows.count() if persist else None

    return {
        "class_id": str(school_class.id),
        "school_name": school_class.school.name,
        "class_name": school_class.display_name,
        "class_size": class_size,
        "rank_slots": rank_slots,
        "final_session": {
            "id": str(sessions[-1].id) if sessions else None,
            "date": str(sessions[-1].date) if sessions else None,
            "topic": sessions[-1].topic if sessions else None,
            "is_last_session": bool(sessions and _final_is_latest(_final_session(school_class), sessions)),
        },
        "evaluated_students": len(results) - len(pending),
        "pending_count": len(pending),
        "passed_count": len(passed),
        "not_passed_count": len(not_passed),
        "all_evaluated": not pending,
        "certificate_generation_allowed": not pending and class_size > 0,
        "message": "All active students are evaluated; passed students may receive certificates." if not pending else "Certificates are locked until every active student is fully evaluated.",
        "top25_ranking": ranking,
        "students": results,
        "pending_students": [
            {"student_id": row["student_id"], "student_name": row["student_name"], "blockers": row["blockers"]}
            for row in pending
        ],
        "not_passed_students": [
            {"student_id": row["student_id"], "student_name": row["student_name"], "overall_score": row["overall_score"]}
            for row in not_passed
        ],
        "evaluated_programmes": evaluated_programmes,
        "pass_mark": PASS_MARK,
    }


def class_ranking_data(student):
    data = class_evaluation_data(student.school_class, persist=False)
    current = next((row for row in data["students"] if str(row["student_id"]) == str(student.student_id)), None)
    return {
        "class_size": data["class_size"],
        "class_rank": current.get("rank") if current else None,
        "rank_display": current.get("rank_display", "-") if current else "-",
        "rank_slots": data["rank_slots"],
        "top_ranking": data["top25_ranking"],
        "top10_ranking": data["top25_ranking"],
        "attendance_pct": current["attendance"]["percentage"] if current else 0.0,
        "quiz_pct": current["quiz"]["percentage"] if current else 0.0,
        "practical_pct": current["assessment"]["practical_pct"] if current else 0.0,
        "trainer_review_pct": current["assessment"]["trainer_review_pct"] if current else 0.0,
    }


def student_report_data(student):
    result = evaluate_student(student)
    programme = (
        ProgrammeCompletion.objects.filter(student=student)
        .only("status", "overall_score", "completed_at", "updated_at")
        .first()
    )

    # Progress reports are live, but they must remain consistent with a
    # completed programme when some legacy records no longer carry a
    # curriculum_unit link or a directly recomputable assessment row.
    unit_rows = list(result.get("units") or [])
    persisted_units = list(
        UnitCompletion.objects.filter(student=student)
        .select_related(
            "curriculum_unit",
            "curriculum_unit__completion_profile__technology",
            "final_session__workflow__technology",
            "final_session__trainer",
        )
        .order_by("curriculum_unit__unit_code")
    )

    if not unit_rows and persisted_units:
        unit_ids = [row.curriculum_unit_id for row in persisted_units]
        session_counts = {
            str(row["curriculum_unit_id"]): row["total"]
            for row in (
                Session.objects.filter(
                    school_class_id=student.school_class_id,
                    status="completed",
                    curriculum_unit_id__in=unit_ids,
                )
                .values("curriculum_unit_id")
                .annotate(total=Count("id"))
            )
        }
        unit_rows = []
        for row in persisted_units:
            final_session = getattr(row, "final_session", None)
            workflow = getattr(final_session, "workflow", None)
            technology = getattr(getattr(workflow, "technology", None), "name", "") or ""
            if not technology:
                technology = getattr(
                    getattr(getattr(row.curriculum_unit, "completion_profile", None), "technology", None),
                    "name",
                    "",
                ) or ""
            unit_rows.append({
                "curriculum_unit_id": str(row.curriculum_unit_id),
                "technology": technology,
                "unit_code": str(row.curriculum_unit.unit_code or "").strip().upper(),
                "title": row.curriculum_unit.title,
                "sessions_count": session_counts.get(str(row.curriculum_unit_id), 0),
                "completed_sessions": session_counts.get(str(row.curriculum_unit_id), 0),
                "attendance_pct": float(row.attendance_pct or 0),
                "quiz_pct": float(row.quiz_pct or 0),
                "practical_pct": float(row.practical_pct or 0),
                "trainer_review_pct": float(row.trainer_review_avg or 0) * 20,
                "trainer_review_rating": float(row.trainer_review_avg) if row.trainer_review_avg is not None else None,
                "score": float(row.score or 0),
                "status": row.status,
                "reasons": list(row.reasons or []),
                "final_session_id": str(row.final_session_id) if row.final_session_id else None,
            })

    trainer_name = str(
        (result.get("final_session") or {}).get("trainer_name") or ""
    ).strip()
    trainer_id = str(
        (result.get("final_session") or {}).get("trainer_id") or ""
    ).strip()
    if not trainer_name and persisted_units:
        trainer_names = [
            str(getattr(getattr(row, "final_session", None), "trainer", None).name or "").strip()
            for row in persisted_units
            if getattr(getattr(row, "final_session", None), "trainer", None)
        ]
        trainer_name = next((value for value in trainer_names if value), "")
        trainer_id = next(
            (
                str(getattr(getattr(getattr(row, "final_session", None), "trainer", None), "trainer_id", "") or "").strip()
                for row in persisted_units
                if getattr(getattr(row, "final_session", None), "trainer", None)
                and getattr(getattr(row, "final_session", None), "trainer", None).trainer_id
            ),
            "",
        )

    if not trainer_name:
        assignment = (
            student.school_class.school.trainer_assignments
            .filter(status="active", assigned_from__lte=timezone.localdate())
            .filter(Q(assigned_to__isnull=True) | Q(assigned_to__gte=timezone.localdate()))
            .select_related("trainer")
            .order_by("-assigned_from", "trainer__trainer_id")
            .first()
        )
        if assignment:
            trainer_name = str(getattr(assignment.trainer, "name", "") or "").strip()
            trainer_id = str(getattr(assignment.trainer, "trainer_id", "") or "").strip()

    technologies = []
    for unit in unit_rows:
        value = str(unit.get("technology") or "").strip()
        if value and value not in technologies:
            technologies.append(value)
    if not technologies:
        technologies = [
            item["name"]
            for item in completed_technologies(student)
            if isinstance(item, dict) and item.get("name")
        ]
    if not technologies:
        final_technology = str((result.get("final_session") or {}).get("technology") or "").strip()
        if final_technology:
            technologies.append(final_technology)

    live_score = float(result.get("overall_score") or 0)
    has_live_evaluation = bool(
        result.get("quiz", {}).get("assigned")
        or result.get("assessment", {}).get("has_practical")
        or result.get("assessment", {}).get("has_review")
        or any(
            unit.get("status") != "pending" and unit.get("score") is not None
            for unit in result.get("units", [])
        )
    )
    persisted_score = float(programme.overall_score or 0) if programme else 0.0
    overall_score = live_score if has_live_evaluation else persisted_score

    live_unit_count = len(unit_rows)
    evaluated_unit_count = sum(
        1 for unit in unit_rows if str(unit.get("status") or "").lower() != "pending"
    )

    return {
        "student_id": result["student_id"],
        "student_name": result["student_name"],
        "school_name": student.school_class.school.name,
        "school_code": student.school_class.school.school_code,
        "class_name": student.school_class.display_name,
        "overall_score": overall_score,
        "evaluation_state": result["state"] if has_live_evaluation else (
            "passed"
            if persisted_score >= PASS_MARK and programme and (
                programme.completed_at
                or programme.status in {"trainer_requested", "admin_completed"}
            )
            else "pending"
        ),
        "evaluated_units": evaluated_unit_count,
        "required_units": live_unit_count,
        "units": unit_rows,
        "attendance": result["attendance"],
        "quiz": result["quiz"],
        "assessment": result["assessment"],
        "project": result["project"],
        "final_session": result.get("final_session"),
        "blockers": result["blockers"],
        "pass_mark": PASS_MARK,
        "trainer_name": trainer_name,
        "trainer_id": trainer_id,
        "technologies": technologies,
        "report_updated_at": timezone.now().isoformat(),
        "programme_completion_status": programme.status if programme else "in_progress",
        "programme_completed_at": programme.completed_at.isoformat() if programme and programme.completed_at else None,
    }


def assert_certificate_issuable(student):
    data = class_evaluation_data(student.school_class, persist=False)
    if not data["all_evaluated"]:
        names = ", ".join(row["student_name"] for row in data["pending_students"][:8])
        suffix = "" if len(data["pending_students"]) <= 8 else f" and {len(data['pending_students']) - 8} more"
        raise ValueError(
            "Certificate generation is locked. Every active student in this class must be fully evaluated first. Pending: " + names + suffix
        )
    current = next((row for row in data["students"] if str(row["student_id"]) == str(student.student_id)), None)
    if not current or not current["passed"]:
        raise ValueError(
            f"{student.name} is not eligible for a certificate. Evaluation result: {current['state'] if current else 'not evaluated'}; score: {current['overall_score'] if current else 0:.2f}%"
        )
    programme_count = ProgrammeCompletion.objects.filter(student__school_class=student.school_class, student__status="active").count()
    if programme_count != data["class_size"]:
        raise ValueError("The entire class has not been evaluated yet. Re-evaluate the whole class before issuing certificates.")
    return data
