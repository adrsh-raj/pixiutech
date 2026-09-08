from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Avg
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import SchoolClass, Student
from learning.models import AttendanceRecord, Project, QuizAttempt, StudentAssessment


def _percent(value):
    return float(Decimal(value or 0).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _student_components(students):
    result = {}
    for student in students:
        sid = student.id
        quiz = QuizAttempt.objects.filter(student=student, status="completed").aggregate(avg=Avg("percentage"))["avg"] or 0
        project = Project.objects.filter(student=student, score__isnull=False).aggregate(avg=Avg("score"))["avg"] or 0
        review = StudentAssessment.objects.filter(student=student, status="published", score__isnull=False).aggregate(avg=Avg("score"))["avg"] or 0
        attendance_qs = AttendanceRecord.objects.filter(student=student)
        attendance_total = attendance_qs.count()
        attendance_present = attendance_qs.filter(status__in=["present", "late"]).count()
        attendance = (attendance_present / attendance_total * 100) if attendance_total else 0
        composite = (float(quiz) * 0.40) + (float(project) * 0.25) + (float(review) * 0.15) + (float(attendance) * 0.20)
        result[sid] = {
            "quiz": _percent(quiz),
            "project": _percent(project),
            "review": _percent(review),
            "attendance": _percent(attendance),
            "score": _percent(composite),
        }
    return result


class ClassRankingView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        requested_class_id = request.query_params.get("class_id")
        user = request.user

        if user.role == UserRole.STUDENT:
            student = getattr(user, "student_profile", None)
            if not student:
                return Response({"detail": "Student profile is not linked to this account."}, status=404)
            school_class = student.school_class
        else:
            if not requested_class_id:
                return Response({"detail": "class_id is required for non-student accounts."}, status=400)
            school_class = SchoolClass.objects.select_related("school").filter(pk=requested_class_id).first()
            if not school_class:
                return Response({"detail": "Class not found."}, status=404)

            if user.role == UserRole.TRAINER:
                allowed = school_class.school.trainer_assignments.filter(
                    trainer__account_id=user.id, status="active"
                ).exists()
                if not allowed:
                    return Response({"detail": "You do not have access to this class."}, status=403)
            elif user.role == UserRole.SCHOOL:
                if school_class.school.account_id != user.id:
                    return Response({"detail": "You do not have access to this class."}, status=403)
            elif user.role != UserRole.ADMIN:
                return Response({"detail": "This ranking is not available for your account."}, status=403)

        students = list(
            Student.objects.filter(school_class=school_class, status="active")
            .only("id", "student_id", "name", "roll_number")
            .order_by("roll_number")
        )
        components = _student_components(students)

        rows = []
        for student in students:
            component = components.get(student.id, {"quiz": 0, "project": 0, "review": 0, "attendance": 0, "score": 0})
            rows.append({
                "student_id": student.student_id,
                "name": student.name,
                "roll_number": student.roll_number,
                **component,
            })

        rows.sort(key=lambda row: (-row["score"], -row["attendance"], row["roll_number"], row["student_id"]))
        for index, row in enumerate(rows, start=1):
            row["rank"] = index

        current_student_id = getattr(getattr(user, "student_profile", None), "student_id", None)
        current = next((row for row in rows if row["student_id"] == current_student_id), None)

        return Response({
            "class": {
                "id": str(school_class.id),
                "grade": school_class.grade,
                "section": school_class.section,
                "name": school_class.display_name,
                "school_code": school_class.school.school_code,
                "school_name": school_class.school.name,
            },
            "ranking": rows,
            "student": current,
            "total_students": len(rows),
            "formula": {
                "quiz": 40,
                "project": 25,
                "trainer_assessment": 15,
                "attendance": 20,
            },
        })
