from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import SchoolClass, Student, Trainer
from learning.models import AttendanceRecord, CurriculumClassAssignment, Project, QuizAttempt, Session, StudentAssessment


def _pct(value):
    return float(Decimal(value or 0).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _student_activity_dates(student):
    dates = set()
    dates.update(AttendanceRecord.objects.filter(student=student, status__in=["present", "late"]).values_list("session__date", flat=True))
    dates.update(QuizAttempt.objects.filter(student=student, status="completed").values_list("completed_at__date", flat=True))
    dates.update(Project.objects.filter(student=student).exclude(status="draft").values_list("updated_at__date", flat=True))
    dates.update(StudentAssessment.objects.filter(student=student, status="published").values_list("assessment_date", flat=True))
    return {d for d in dates if d}


def _current_streak(dates, today=None):
    if not dates:
        return 0
    today = today or timezone.localdate()
    cursor = today if today in dates else today - timedelta(days=1)
    streak = 0
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _student_snapshot(student):
    completed_quizzes = list(QuizAttempt.objects.filter(student=student, status="completed").order_by("-completed_at"))
    quiz_avg = _pct(sum(float(q.percentage or 0) for q in completed_quizzes) / len(completed_quizzes)) if completed_quizzes else None
    projects = Project.objects.filter(student=student)
    scored_projects = projects.filter(score__isnull=False)
    completed_projects = projects.filter(status="completed")
    reviews = StudentAssessment.objects.filter(student=student, status="published")
    review_avg = _pct(reviews.aggregate(avg=Avg("score"))["avg"]) if reviews.exists() else None
    attendance_total = AttendanceRecord.objects.filter(student=student).count()
    attendance_present = AttendanceRecord.objects.filter(student=student, status__in=["present", "late"]).count()
    attendance = _pct(attendance_present / attendance_total * 100) if attendance_total else None
    class_assignments = CurriculumClassAssignment.objects.filter(school_class=student.school_class).select_related("curriculum_unit")
    units = list(class_assignments.values("curriculum_unit__unit_code", "curriculum_unit__title", "curriculum_unit__level", "curriculum_unit__grade"))
    unit_progress = []
    for unit in units:
        code = unit["curriculum_unit__unit_code"]
        active_for_unit = (
            QuizAttempt.objects.filter(student=student, quiz__unit_code=code, status="completed").exists()
            or Project.objects.filter(student=student, title__icontains=code).filter(status="completed").exists()
            or reviews.filter(unit_code=code).exists()
        )
        unit_progress.append({
            "unit_code": code,
            "title": unit["curriculum_unit__title"],
            "level": unit["curriculum_unit__level"],
            "complete": active_for_unit,
        })
    completed_units = sum(1 for unit in unit_progress if unit["complete"])
    progress = _pct(completed_units / len(unit_progress) * 100) if unit_progress else None
    latest_level = reviews.exclude(level="").values_list("level", flat=True).first() or student.current_level or None
    dates = _student_activity_dates(student)
    streak = _current_streak(dates)
    best_quiz = max((float(q.percentage or 0) for q in completed_quizzes), default=None)
    improvement = None
    if len(completed_quizzes) >= 2:
        newest = float(completed_quizzes[0].percentage or 0)
        oldest = float(completed_quizzes[-1].percentage or 0)
        improvement = _pct(newest - oldest)

    achievements = []
    if len(completed_quizzes) >= 3 and quiz_avg is not None and quiz_avg >= 90:
        achievements.append({"key": "quiz-master", "title": "Quiz Master", "description": "Maintained a 90%+ average across completed quizzes.", "icon": "trophy"})
    if streak >= 5:
        achievements.append({"key": "learning-streak", "title": f"{streak} Day Streak", "description": "Completed learning activity on consecutive days.", "icon": "flame"})
    if attendance is not None and attendance >= 90:
        achievements.append({"key": "attendance-90", "title": "90%+ Attendance", "description": "Attendance is currently at or above 90%.", "icon": "target"})
    if completed_projects.count() >= 1:
        achievements.append({"key": "project-builder", "title": "Project Builder", "description": "Completed at least one recorded project.", "icon": "bot"})

    return {
        "level": latest_level,
        "attendance": attendance,
        "quiz_average": quiz_avg,
        "projects_completed": completed_projects.count(),
        "projects_total": projects.exclude(status="draft").count(),
        "learning_progress": progress,
        "best_quiz_score": _pct(best_quiz) if best_quiz is not None else None,
        "most_improved": improvement,
        "perfect_attendance": attendance is not None and attendance >= 100,
        "current_streak": streak,
        "unit_timeline": unit_progress,
        "achievements": achievements,
    }


class StudentProgressView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response({"detail": "Student progress is only available to student accounts."}, status=403)
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"detail": "Student profile is not linked to this account."}, status=404)
        snapshot = _student_snapshot(student)
        return Response({"student": {"student_id": student.student_id, "name": student.name, "class_id": str(student.school_class_id), "class_name": student.school_class.display_name, "school_name": student.school_class.school.name}, "progress": snapshot})


class TrainerPerformanceView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        if request.user.role not in [UserRole.TRAINER, UserRole.ADMIN]:
            return Response({"detail": "Trainer performance is not available for this account."}, status=403)
        trainer = getattr(request.user, "trainer_profile", None) if request.user.role == UserRole.TRAINER else None
        trainer_id = request.query_params.get("trainer_id") if request.user.role == UserRole.ADMIN else getattr(trainer, "id", None)
        if not trainer_id:
            return Response({"detail": "trainer_id is required."}, status=400)
        trainer = Trainer.objects.filter(pk=trainer_id).first()
        if not trainer:
            return Response({"detail": "Trainer not found."}, status=404)
        sessions = Session.objects.filter(trainer=trainer)
        session_count = sessions.filter(status="completed").count()
        attendance = AttendanceRecord.objects.filter(session__trainer=trainer)
        attendance_total = attendance.count()
        attendance_present = attendance.filter(status__in=["present", "late"]).count()
        attendance_rate = _pct(attendance_present / attendance_total * 100) if attendance_total else None
        reviews = StudentAssessment.objects.filter(trainer=trainer, status="published")
        student_ids = list(attendance.values_list("student_id", flat=True).distinct())
        improvement_values = []
        for student_id in student_ids:
            quiz_scores = list(QuizAttempt.objects.filter(student_id=student_id, status="completed").order_by("completed_at").values_list("percentage", flat=True))
            if len(quiz_scores) >= 2:
                improvement_values.append(float(quiz_scores[-1] or 0) - float(quiz_scores[0] or 0))
        return Response({
            "trainer": {"id": str(trainer.id), "trainer_id": trainer.trainer_id, "name": trainer.name},
            "metrics": {
                "sessions_delivered": session_count,
                "attendance_rate": attendance_rate,
                "student_improvement": _pct(sum(improvement_values) / len(improvement_values)) if improvement_values else None,
                "reviews_completed": reviews.count(),
                "quiz_completion": QuizAttempt.objects.filter(quiz__created_by=trainer.account, status="completed").count() if trainer.account_id else 0,
                "project_completion": Project.objects.filter(student__school_class__sessions__trainer=trainer, status="completed").distinct().count(),
            },
        })


class SchoolPerformanceView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        if request.user.role != UserRole.SCHOOL:
            return Response({"detail": "School performance is only available to school accounts."}, status=403)
        school = getattr(request.user, "school_profile", None)
        if not school:
            return Response({"detail": "School profile is not linked to this account."}, status=404)
        classes = school.classes.filter(status="active")
        students = Student.objects.filter(school_class__school=school, status="active")
        attendance = AttendanceRecord.objects.filter(student__school_class__school=school)
        attendance_total = attendance.count()
        attendance_present = attendance.filter(status__in=["present", "late"]).count()
        attendance_rate = _pct(attendance_present / attendance_total * 100) if attendance_total else None
        quiz_avg = QuizAttempt.objects.filter(student__school_class__school=school, status="completed").aggregate(avg=Avg("percentage"))["avg"]
        project_count = Project.objects.filter(student__school_class__school=school, status="completed").count()
        active_trainer_count = Trainer.objects.filter(school_assignments__school=school, school_assignments__status="active", status="active").distinct().count()
        comparisons = []
        for school_class in classes:
            rows = Student.objects.filter(school_class=school_class, status="active")
            student_ids = list(rows.values_list("id", flat=True))
            c_att = AttendanceRecord.objects.filter(student_id__in=student_ids)
            c_att_total = c_att.count()
            c_att_present = c_att.filter(status__in=["present", "late"]).count()
            c_quiz = QuizAttempt.objects.filter(student_id__in=student_ids, status="completed").aggregate(avg=Avg("percentage"))["avg"]
            score = _pct(c_att_present / c_att_total * 100) if c_att_total else (_pct(c_quiz) if c_quiz is not None else None)
            comparisons.append({"class_id": str(school_class.id), "name": school_class.display_name, "attendance": _pct(c_att_present / c_att_total * 100) if c_att_total else None, "quiz": _pct(c_quiz) if c_quiz is not None else None, "score": score, "students": rows.count()})
        return Response({
            "school": {"id": str(school.id), "code": school.school_code, "name": school.name},
            "summary": {"students": students.count(), "classes": classes.count(), "attendance": attendance_rate, "avg_quiz": _pct(quiz_avg) if quiz_avg is not None else None, "projects": project_count, "active_trainers": active_trainer_count},
            "class_comparison": comparisons,
        })
