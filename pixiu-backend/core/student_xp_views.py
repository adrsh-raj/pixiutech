import json
from datetime import timezone as datetime_timezone
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import School, Student
from academics.services import accessible_student_queryset
from learning.models import Project

LEDGER_PROJECT_TITLE = "__pixiu_xp_ledger__"
MAX_DAILY_XP = 500


def _parse_ledger(raw_description):
    default_ledger = {
        "version": 2,
        "events": [],
        "lastActiveDate": timezone.now().strftime("%Y-%m-%d"),
        "streakDays": 1,
        "salt": "pixiu_cloud_backup",
    }
    if not raw_description:
        return default_ledger
    try:
        parsed = json.loads(raw_description)
        if isinstance(parsed, dict) and isinstance(parsed.get("events"), list):
            return parsed
    except Exception:
        pass
    return default_ledger


class StudentXpView(APIView):
    """
    Cloud-Backed Synchronization for Student Hardware & AI XP.
    Guarantees zero progress loss if localStorage is cleared or device changes.
    """
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        user = request.user
        target_student = None

        if user.role == UserRole.STUDENT:
            target_student = getattr(user, "student_profile", None)
            if not target_student:
                return Response({"detail": "Student profile is not linked to this account."}, status=404)
        elif user.role in [UserRole.ADMIN, UserRole.TRAINER, UserRole.SCHOOL]:
            req_student_id = request.query_params.get("student_id")
            if req_student_id:
                target_student = accessible_student_queryset(user).filter(student_id=req_student_id).first()
            if not target_student:
                return Response({"detail": "Student not found or outside authorized scope."}, status=404)
        else:
            return Response({"detail": "Unauthorized role for XP ledger."}, status=403)

        # Retrieve cloud backup ledger from Project model
        ledger_project = Project.objects.filter(
            student=target_student,
            title=LEDGER_PROJECT_TITLE,
        ).first()

        ledger = _parse_ledger(ledger_project.description if ledger_project else None)

        # Retrieve verified creations saved as projects
        creations = list(
            Project.objects.filter(student=target_student)
            .exclude(title=LEDGER_PROJECT_TITLE)
            .values("id", "title", "description", "status", "score", "created_at")
            .order_by("-created_at")
        )

        return Response({
            "student": {
                "student_id": target_student.student_id,
                "name": target_student.name,
                "school_id": str(target_student.school_class.school_id),
                "school_name": target_student.school_class.school.name,
                "class_id": str(target_student.school_class_id),
                "class_name": target_student.school_class.display_name,
            },
            "ledger": ledger,
            "creations": creations,
            "has_cloud_backup": ledger_project is not None,
            "last_synced_at": ledger_project.updated_at.isoformat() if ledger_project else None,
        })

    @transaction.atomic
    def post(self, request):
        user = request.user
        if user.role != UserRole.STUDENT:
            return Response({"detail": "Only students can push simulation XP events."}, status=403)

        student = getattr(user, "student_profile", None)
        if not student:
            return Response({"detail": "Student profile is not linked to this account."}, status=404)

        payload = request.data or {}
        incoming_events = payload.get("events", [])
        if not isinstance(incoming_events, list):
            return Response({"detail": "events must be an array."}, status=400)

        # Find or create cloud ledger project with row lock to serialize concurrent updates
        ledger_project = (
            Project.objects.select_for_update()
            .filter(student=student, title=LEDGER_PROJECT_TITLE)
            .first()
        )
        if ledger_project is None:
            ledger_project, _ = Project.objects.get_or_create(
                student=student,
                title=LEDGER_PROJECT_TITLE,
                defaults={
                    "status": "completed",
                    "score": 0,
                    "description": json.dumps({
                        "version": 2,
                        "events": [],
                        "lastActiveDate": timezone.now().strftime("%Y-%m-%d"),
                        "streakDays": 1,
                        "salt": "pixiu_cloud_backup",
                    }),
                },
            )
            ledger_project = (
                Project.objects.select_for_update()
                .filter(pk=ledger_project.pk)
                .first()
            )

        existing_ledger = _parse_ledger(ledger_project.description)
        event_map = {
            e["id"]: e
            for e in existing_ledger.get("events", [])
            if isinstance(e, dict) and "id" in e
        }

        # Merge new incoming events idempotently
        for evt in incoming_events:
            if not isinstance(evt, dict):
                continue
            evt_id = str(evt.get("id", "")).strip()
            if not evt_id or evt_id in event_map:
                continue

            try:
                base_xp = int(evt.get("xp", 0))
            except (ValueError, TypeError):
                continue

            # Anti-tamper sanity check: cap individual events at 200 XP
            clamped_xp = max(0, min(base_xp, 200))
            category = str(evt.get("category", "tinkering"))[:30]
            title = str(evt.get("title", "Hardware Experiment"))[:150]
            now_ms = int(timezone.now().timestamp() * 1000)
            try:
                raw_ts = int(evt.get("timestamp") or now_ms)
            except (ValueError, TypeError):
                raw_ts = now_ms
            # Anti-tamper: reject arbitrary past back-dating or future dates
            if raw_ts < now_ms - (24 * 3600 * 1000) or raw_ts > now_ms + (600 * 1000):
                timestamp = now_ms
            else:
                timestamp = raw_ts
            signature = str(evt.get("signature", ""))[:64]
            metadata = evt.get("metadata") if isinstance(evt.get("metadata"), dict) else {}

            event_map[evt_id] = {
                "id": evt_id,
                "category": category,
                "title": title,
                "xp": clamped_xp,
                "timestamp": timestamp,
                "signature": signature,
                "metadata": metadata,
            }

        merged_events = list(event_map.values())
        merged_events.sort(key=lambda x: x.get("timestamp", 0))

        # Enforce daily 500 XP cap across merged events
        daily_totals = {}
        total_xp = 0
        today_str = timezone.now().strftime("%Y-%m-%d")

        for evt in merged_events:
            ts = evt.get("timestamp", 0) / 1000.0
            day_key = timezone.datetime.fromtimestamp(ts, tz=datetime_timezone.utc).strftime("%Y-%m-%d")
            current_day_total = daily_totals.get(day_key, 0)
            available_cap = max(0, MAX_DAILY_XP - current_day_total)
            allowed = min(evt.get("xp", 0), available_cap)
            if allowed > 0:
                daily_totals[day_key] = current_day_total + allowed
                total_xp += allowed

        # Server-side streak calculation prevents arbitrary client streak spoofing
        prev_date = str(existing_ledger.get("lastActiveDate") or "")
        prev_streak = int(existing_ledger.get("streakDays", 1) or 1)
        if prev_date == today_str:
            streak_days = prev_streak
        else:
            try:
                prev_dt = timezone.datetime.strptime(prev_date, "%Y-%m-%d").date()
                curr_dt = timezone.datetime.strptime(today_str, "%Y-%m-%d").date()
                if (curr_dt - prev_dt).days == 1:
                    streak_days = prev_streak + 1
                else:
                    streak_days = 1
            except Exception:
                streak_days = 1
        streak_days = max(1, min(streak_days, 1000))

        updated_ledger = {
            "version": 2,
            "events": merged_events,
            "lastActiveDate": today_str,
            "streakDays": streak_days,
            "salt": payload.get("salt") or existing_ledger.get("salt") or "pixiu_cloud_backup",
        }

        ledger_project.description = json.dumps(updated_ledger)
        ledger_project.score = min(total_xp, 100000)
        ledger_project.status = "completed"
        ledger_project.save()

        # Handle custom circuit creation persistence as separate Project entry
        new_creation = payload.get("newCreation")
        if isinstance(new_creation, dict) and new_creation.get("name"):
            name = str(new_creation.get("name")).strip()[:200]
            if name and name != "Untitled Circuit":
                Project.objects.update_or_create(
                    student=student,
                    title=f"[CyberLab] {name}",
                    defaults={
                        "description": str(new_creation.get("summary", "Custom verified circuit built in Pixiu CyberLab"))[:1000],
                        "status": "completed",
                        "score": 100,
                    },
                )

        return Response({
            "status": "success",
            "message": "XP ledger successfully synchronized with cloud database.",
            "total_xp": total_xp,
            "ledger": updated_ledger,
            "event_count": len(merged_events),
        })


class SchoolLeaderboardView(APIView):
    """
    School-wide & Class-wide Leaderboard aggregating student creations and XP.
    """
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        user = request.user
        student = getattr(user, "student_profile", None) if user.role == UserRole.STUDENT else None

        # Aggregate XP by school from the ledger projects
        ledger_projects = Project.objects.filter(
            title=LEDGER_PROJECT_TITLE,
            status="completed",
            student__status="active",
        ).select_related("student__school_class__school")

        school_aggregates = {}
        for lp in ledger_projects:
            sch = lp.student.school_class.school
            if sch.id not in school_aggregates:
                school_aggregates[sch.id] = {
                    "school_id": str(sch.id),
                    "school_code": sch.school_code,
                    "school_name": sch.name,
                    "total_xp": 0,
                    "active_students": 0,
                    "creations_count": 0,
                }
            school_aggregates[sch.id]["total_xp"] += int(lp.score or 0)
            school_aggregates[sch.id]["active_students"] += 1

        # Count custom creations per school
        creation_projects = Project.objects.filter(
            title__startswith="[CyberLab]",
            student__status="active",
        ).values("student__school_class__school_id").annotate(total=Count("id"))

        for cp in creation_projects:
            sch_id = cp["student__school_class__school_id"]
            if sch_id in school_aggregates:
                school_aggregates[sch_id]["creations_count"] = cp["total"]

        # Sort schools by total XP
        schools_ranked = sorted(
            school_aggregates.values(),
            key=lambda x: (-x["total_xp"], -x["creations_count"], x["school_name"]),
        )

        for index, item in enumerate(schools_ranked, start=1):
            item["rank"] = index

        # If student request, compute rank in their class and full class leaderboard
        class_rank = None
        class_total_students = 0
        class_name = None
        class_leaderboard = []
        if student and getattr(student, "school_class", None):
            school_class = student.school_class
            class_name = school_class.display_name or f"Class {school_class.grade}-{school_class.section}"

            class_students_qs = list(
                Student.objects.filter(school_class=school_class, status="active")
                .only("id", "student_id", "name", "roll_number")
                .order_by("roll_number", "student_id")
            )
            class_total_students = len(class_students_qs)

            class_ledgers = list(
                Project.objects.filter(
                    title=LEDGER_PROJECT_TITLE,
                    student__school_class=school_class,
                ).values("student_id", "score")
            )
            class_students_map = {item["student_id"]: int(item.get("score") or 0) for item in class_ledgers}

            class_rows = []
            for s in class_students_qs:
                score = class_students_map.get(s.id, 0)
                class_rows.append({
                    "student_id": s.student_id,
                    "name": s.name,
                    "roll_number": s.roll_number,
                    "total_xp": score,
                    "is_current_user": s.id == student.id,
                })

            class_rows.sort(
                key=lambda row: (-row["total_xp"], row["roll_number"] if row["roll_number"] is not None else 999, row["student_id"])
            )
            for index, row in enumerate(class_rows, start=1):
                row["rank"] = index
                if row["is_current_user"]:
                    class_rank = index

            class_leaderboard = class_rows

        return Response({
            "leaderboard": schools_ranked[:20],
            "total_schools": len(schools_ranked),
            "student_class_rank": class_rank,
            "student_class_total": class_total_students,
            "student_class_name": class_name,
            "class_leaderboard": class_leaderboard,
        })
