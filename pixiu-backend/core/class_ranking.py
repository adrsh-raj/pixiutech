from decimal import Decimal, ROUND_HALF_UP

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import Student
from academics.services import accessible_class_queryset
from learning import course_completion_final as completion


# Keep the leaderboard/ranking API on the exact same score engine as
# certificate issuance and the printed A4 scorecard.
WEIGHTS = {
    "practical": completion.WEIGHT_PRACTICAL,
    "quiz": completion.WEIGHT_QUIZ,
    "attendance": completion.WEIGHT_ATTENDANCE,
    "trainer_review": completion.WEIGHT_TRAINER_REVIEW,
}


def _percent(value):
    return float(Decimal(value or 0).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _student_components(students):
    result = {}
    for student in students:
        _sessions, _taught_codes, attendance, quiz, assessment, overall = completion.score_data(student)
        result[student.id] = {
            "practical": _percent(assessment.get("practical_pct")),
            "quiz": _percent(quiz.get("percentage")),
            "attendance": _percent(attendance.get("percentage")),
            "trainer_review": _percent(assessment.get("trainer_review_pct")),
            "score": float(overall),
        }
    return result


class ClassRankingView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def _empty_response(self):
        return Response({"class": None, "ranking": [], "student": None, "total_students": 0, "summary": {"students": 0, "attendance": None, "quiz": None, "practical": None, "trainer_review": None, "score": None}, "formula": WEIGHTS})

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

        students = list(
            Student.objects.filter(school_class=school_class, status="active")
            .only("id", "student_id", "name", "roll_number")
            .order_by("roll_number", "student_id")
        )
        components = _student_components(students)
        rows = []
        for student in students:
            component = components.get(student.id, {"practical": 0, "quiz": 0, "attendance": 0, "trainer_review": 0, "score": 0})
            rows.append({"student_id": student.student_id, "name": student.name, "roll_number": student.roll_number, **component})

        rows.sort(key=lambda row: (-row["score"], -row["attendance"], row["roll_number"] if row["roll_number"] is not None else 10**9, row["student_id"]))
        for index, row in enumerate(rows, 1):
            row["rank"] = index
            row["rank_display"] = f"{index}/{len(rows)}" if index <= 10 else "-"

        current_student_id = getattr(getattr(user, "student_profile", None), "student_id", None)
        current = next((row for row in rows if row["student_id"] == current_student_id), None)

        def average(key):
            values = [row[key] for row in rows if row[key] is not None]
            return _percent(sum(values) / len(values)) if values else None

        summary = {"students": len(rows), "attendance": average("attendance"), "quiz": average("quiz"), "practical": average("practical"), "trainer_review": average("trainer_review"), "score": average("score")}
        return Response({
            "class": {"id": str(school_class.id), "grade": school_class.grade, "section": school_class.section, "name": school_class.display_name, "school_code": school_class.school.school_code, "school_name": school_class.school.name},
            "ranking": rows,
            "student": current,
            "total_students": len(rows),
            "summary": summary,
            "formula": WEIGHTS,
        })
