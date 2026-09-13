from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Avg
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import School, Student, Trainer
from learning.models import AttendanceRecord, CurriculumClassAssignment, Project, QuizAttempt, Session, StudentAssessment
from .class_ranking import _student_components


def _pct(value):
    return float(Decimal(value or 0).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _activity_dates(student):
    dates = set(AttendanceRecord.objects.filter(student=student, status__in=["present", "late"]).values_list("session__date", flat=True))
    dates.update(QuizAttempt.objects.filter(student=student, status="completed").values_list("completed_at__date", flat=True))
    dates.update(Project.objects.filter(student=student).exclude(status="draft").values_list("updated_at__date", flat=True))
    dates.update(StudentAssessment.objects.filter(student=student, status="published").values_list("assessment_date", flat=True))
    return {item for item in dates if item}


def _streak(dates, today=None):
    if not dates:
        return 0
    cursor = today or timezone.localdate()
    if cursor not in dates:
        cursor -= timedelta(days=1)
    total = 0
    while cursor in dates:
        total += 1
        cursor -= timedelta(days=1)
    return total


def _student_snapshot(student):
    attempts = list(QuizAttempt.objects.filter(student=student, status="completed").order_by("completed_at"))
    quiz_avg = _pct(sum(float(item.percentage or 0) for item in attempts) / len(attempts)) if attempts else None
    best_quiz = _pct(max((float(item.percentage or 0) for item in attempts), default=0)) if attempts else None
    projects = Project.objects.filter(student=student)
    completed_projects = projects.filter(status="completed")
    attendance_total = AttendanceRecord.objects.filter(student=student).count()
    attendance_present = AttendanceRecord.objects.filter(student=student, status__in=["present", "late"]).count()
    attendance = _pct(attendance_present / attendance_total * 100) if attendance_total else None
    reviews = StudentAssessment.objects.filter(student=student, status="published")
    units = list(CurriculumClassAssignment.objects.filter(school_class=student.school_class).select_related("curriculum_unit").order_by("curriculum_unit__unit_code"))
    session_rows = list(Session.objects.filter(school_class=student.school_class).exclude(curriculum_unit__isnull=True).only("id", "status", "curriculum_unit_id"))
    session_unit_map = {}
    for row in session_rows: session_unit_map.setdefault(str(row.curriculum_unit_id), []).append(row)
    attendance_rows = list(AttendanceRecord.objects.filter(student=student, session__school_class=student.school_class, session__curriculum_unit__isnull=False).select_related("session").only("status", "session_id", "session__curriculum_unit_id"))
    attendance_by_unit = {}
    for row in attendance_rows: attendance_by_unit.setdefault(str(row.session.curriculum_unit_id), []).append(row)
    timeline = []
    for assignment in units:
        curriculum_unit = assignment.curriculum_unit; code = curriculum_unit.unit_code
        unit_sessions = session_unit_map.get(str(curriculum_unit.id), []); unit_attendance = attendance_by_unit.get(str(curriculum_unit.id), [])
        unit_present = sum(1 for row in unit_attendance if row.status in ["present", "late"]); unit_attendance_rate = _pct(unit_present / len(unit_attendance) * 100) if unit_attendance else None
        complete = QuizAttempt.objects.filter(student=student, quiz__unit_code=code, status="completed").exists() or reviews.filter(unit_code=code).exists()
        timeline.append({"unit_code": code, "title": curriculum_unit.title, "complete": complete, "sessions_count": len(unit_sessions), "completed_sessions": sum(1 for session in unit_sessions if session.status == "completed"), "attendance_records": len(unit_attendance), "attendance_rate": unit_attendance_rate})
    completed_units = sum(1 for unit in timeline if unit["complete"]); progress = _pct(completed_units / len(timeline) * 100) if timeline else None
    improvement = _pct(float(attempts[-1].percentage or 0) - float(attempts[0].percentage or 0)) if len(attempts) >= 2 else None
    streak = _streak(_activity_dates(student)); achievements = []
    if len(attempts) >= 3 and quiz_avg is not None and quiz_avg >= 90: achievements.append({"key":"quiz-master","title":"Quiz Master","description":"90%+ average across at least three completed quizzes.","icon":"trophy"})
    if streak >= 5: achievements.append({"key":"learning-streak","title":f"{streak} Day Streak","description":"Recorded learning activity on consecutive days.","icon":"flame"})
    if attendance is not None and attendance >= 90: achievements.append({"key":"attendance-90","title":"90%+ Attendance","description":"Current recorded attendance is at least 90%.","icon":"target"})
    if completed_projects.count() >= 1: achievements.append({"key":"project-builder","title":"Project Builder","description":"At least one project has been completed in the learning system.","icon":"bot"})
    return {"attendance": attendance, "quiz_average": quiz_avg, "projects_completed": completed_projects.count(), "projects_total": projects.exclude(status="draft").count(), "learning_progress": progress, "best_quiz_score": best_quiz, "most_improved": improvement, "perfect_attendance": attendance is not None and attendance >= 100, "current_streak": streak, "unit_timeline": timeline, "achievements": achievements}


class StudentProgressView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]
    def get(self, request):
        if request.user.role != UserRole.STUDENT: return Response({"detail":"Student progress is only available to student accounts."}, status=403)
        student = getattr(request.user, "student_profile", None)
        if not student: return Response({"detail":"Student profile is not linked to this account."}, status=404)
        snapshot = _student_snapshot(student); ranking = _student_components([student]).get(student.id, {})
        class_rows = list(Student.objects.filter(school_class=student.school_class, status="active").only("id", "student_id", "name", "roll_number")); components = _student_components(class_rows)
        ordered = sorted(class_rows, key=lambda item: (-components[item.id]["score"], -components[item.id]["attendance"], item.roll_number, item.student_id)); rank = next((index for index, item in enumerate(ordered, 1) if item.id == student.id), None)
        return Response({"student":{"student_id":student.student_id,"name":student.name,"class_id":str(student.school_class_id),"class_name":student.school_class.display_name,"school_name":student.school_class.school.name},"progress":snapshot,"ranking":{"rank":rank,"total_students":len(ordered),"score":ranking.get("score")}})


class TrainerPerformanceView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]
    def get(self, request):
        if request.user.role not in [UserRole.TRAINER, UserRole.ADMIN]: return Response({"detail":"Trainer performance is not available for this account."}, status=403)
        trainer = getattr(request.user, "trainer_profile", None) if request.user.role == UserRole.TRAINER else Trainer.objects.filter(pk=request.query_params.get("trainer_id")).first()
        if not trainer: return Response({"detail":"Trainer profile not found."}, status=404)
        sessions = Session.objects.filter(trainer=trainer); completed_sessions = sessions.filter(status="completed").count(); attendance = AttendanceRecord.objects.filter(session__trainer=trainer); total_att = attendance.count(); present_att = attendance.filter(status__in=["present","late"]).count(); reviews = StudentAssessment.objects.filter(trainer=trainer,status="published"); student_ids = list(attendance.values_list("student_id",flat=True).distinct()); improvements=[]
        for student_id in student_ids:
            scores=list(QuizAttempt.objects.filter(student_id=student_id,status="completed").order_by("completed_at").values_list("percentage",flat=True))
            if len(scores)>=2: improvements.append(float(scores[-1] or 0)-float(scores[0] or 0))
        quiz_total=QuizAttempt.objects.filter(quiz__created_by=trainer.account,status="completed").count() if trainer.account_id else 0; project_total=Project.objects.filter(student__school_class__sessions__trainer=trainer,status="completed").distinct().count()
        return Response({"trainer":{"id":str(trainer.id),"trainer_id":trainer.trainer_id,"name":trainer.name},"metrics":{"sessions_delivered":completed_sessions,"attendance_rate":_pct(present_att/total_att*100) if total_att else None,"student_improvement":_pct(sum(improvements)/len(improvements)) if improvements else None,"reviews_completed":reviews.count(),"quiz_completion":quiz_total,"project_completion":project_total}})


class SchoolPerformanceView(APIView):
    permission_classes=[IsAuthenticated,IsActiveAccount]
    def get(self, request):
        if request.user.role==UserRole.SCHOOL: school=getattr(request.user,"school_profile",None)
        elif request.user.role==UserRole.ADMIN:
            selector=request.query_params.get("school") or request.query_params.get("school_id") or request.query_params.get("school_code")
            if not selector: return Response({"detail":"A school id or school code is required for admin school performance."},status=400)
            school=School.objects.filter(pk=selector).first() or School.objects.filter(school_code=str(selector).strip().upper()).first()
        else: return Response({"detail":"School performance is not available for this account."},status=403)
        if not school: return Response({"detail":"School profile is not linked to an active school record."},status=404)
        classes=school.classes.filter(status="active"); students=Student.objects.filter(school_class__school=school,status="active"); attendance=AttendanceRecord.objects.filter(student__school_class__school=school); total_att=attendance.count(); present_att=attendance.filter(status__in=["present","late"]).count(); quiz_avg=QuizAttempt.objects.filter(student__school_class__school=school,status="completed").aggregate(avg=Avg("percentage"))["avg"]; project_count=Project.objects.filter(student__school_class__school=school,status="completed").count(); trainer_count=Trainer.objects.filter(school_assignments__school=school,school_assignments__status="active",status="active").distinct().count(); comparison=[]
        for school_class in classes:
            class_students=Student.objects.filter(school_class=school_class,status="active"); ids=list(class_students.values_list("id",flat=True)); c_att=AttendanceRecord.objects.filter(student_id__in=ids); c_total=c_att.count(); c_present=c_att.filter(status__in=["present","late"]).count(); c_quiz=QuizAttempt.objects.filter(student_id__in=ids,status="completed").aggregate(avg=Avg("percentage"))["avg"]; comparison.append({"class_id":str(school_class.id),"name":school_class.display_name,"students":class_students.count(),"attendance":_pct(c_present/c_total*100) if c_total else None,"quiz":_pct(c_quiz) if c_quiz is not None else None})
        return Response({"school":{"id":str(school.id),"code":school.school_code,"name":school.name},"summary":{"students":students.count(),"classes":classes.count(),"attendance":_pct(present_att/total_att*100) if total_att else None,"avg_quiz":_pct(quiz_avg) if quiz_avg is not None else None,"projects":project_count,"active_trainers":trainer_count},"class_comparison":comparison})
