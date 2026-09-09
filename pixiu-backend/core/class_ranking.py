from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Avg, Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset
from learning.models import AttendanceRecord, Project, QuizAttempt, StudentAssessment


WEIGHTS = {"quiz": 40, "project": 25, "trainer_assessment": 15, "attendance": 20}


def _percent(value):
    return float(Decimal(value or 0).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _student_components(students):
    """Build ranking inputs in bulk so class pages do not issue N+1 queries."""
    student_ids = [student.id for student in students]
    result = {
        student.id: {"quiz": 0, "project": 0, "review": 0, "attendance": 0, "score": 0}
        for student in students
    }
    if not student_ids:
        return result

    quiz_rows = QuizAttempt.objects.filter(student_id__in=student_ids, status="completed").values("student_id").annotate(avg=Avg("percentage"))
    project_rows = Project.objects.filter(student_id__in=student_ids, score__isnull=False).values("student_id").annotate(avg=Avg("score"))
    review_rows = StudentAssessment.objects.filter(student_id__in=student_ids, status="published", score__isnull=False).values("student_id").annotate(avg=Avg("score"))
    attendance_rows = AttendanceRecord.objects.filter(student_id__in=student_ids).values("student_id").annotate(total=Count("id"), present=Count("id", filter=Q(status__in=["present", "late"])))

    for row in quiz_rows:
        result[row["student_id"]]["quiz"] = _percent(row["avg"])
    for row in project_rows:
        result[row["student_id"]]["project"] = _percent(row["avg"])
    for row in review_rows:
        result[row["student_id"]]["review"] = _percent(row["avg"])
    for row in attendance_rows:
        total = row["total"] or 0
        result[row["student_id"]]["attendance"] = _percent((row["present"] / total * 100) if total else 0)

    for values in result.values():
        values["score"] = _percent(
            values["quiz"] * WEIGHTS["quiz"] / 100
            + values["project"] * WEIGHTS["project"] / 100
            + values["review"] * WEIGHTS["trainer_assessment"] / 100
            + values["attendance"] * WEIGHTS["attendance"] / 100
        )
    return result


class ClassRankingView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def _empty_response(self):
        return Response({"class": None, "ranking": [], "student": None, "total_students": 0, "summary": {"students": 0, "attendance": None, "quiz": None, "project": None, "trainer_assessment": None, "score": None}, "formula": WEIGHTS})

    def get(self, request):
        requested_class_id = request.query_params.get("class_id")
        user = request.user

        if user.role == UserRole.STUDENT:
            student = getattr(user, "student_profile", None)
            if not student:
                return Response({"detail": "Student profile is not linked to this account."}, status=404)
            school_class = student.school_class
        else:
            accessible = accessible_class_queryset(user).filter(status="active").select_related("school")
            if requested_class_id:
                school_class = accessible.filter(pk=requested_class_id).first()
                if not school_class:
                    return Response({"detail": "You do not have access to this class."}, status=403)
            else:
                school_class = accessible.order_by("school__school_code", "grade", "section", "id").first()
                if not school_class:
                    return self._empty_response()

        students = list(Student.objects.filter(school_class=school_class, status="active").only("id", "student_id", "name", "roll_number", "current_level").order_by("roll_number"))
        components = _student_components(students)

        rows = []
        for student in students:
            component = components.get(student.id, {"quiz": 0, "project": 0, "review": 0, "attendance": 0, "score": 0})
            rows.append({"student_id": student.student_id, "name": student.name, "roll_number": student.roll_number, "learning_level": student.current_level or "", **component})

        rows.sort(key=lambda row: (-row["score"], -row["attendance"], row["roll_number"], row["student_id"]))
        for index, row in enumerate(rows, start=1):
            row["rank"] = index

        current_student_id = getattr(getattr(user, "student_profile", None), "student_id", None)
        current = next((row for row in rows if row["student_id"] == current_student_id), None)

        def average(key):
            values = [row[key] for row in rows if row[key] is not None]
            return _percent(sum(values) / len(values)) if values else None

        summary = {"students": len(rows), "attendance": average("attendance"), "quiz": average("quiz"), "project": average("project"), "trainer_assessment": average("review"), "score": average("score")}

        return Response({"class": {"id": str(school_class.id), "grade": school_class.grade, "section": school_class.section, "name": school_class.display_name, "school_code": school_class.school.school_code, "school_name": school_class.school.name}, "ranking": rows, "student": current, "total_students": len(rows), "summary": summary, "formula": WEIGHTS})
