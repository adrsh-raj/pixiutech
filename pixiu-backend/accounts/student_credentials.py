import csv
from io import StringIO

from django.db import transaction
from django.http import HttpResponse

from accounts.credentials import generate_student_temp_pin, revoke_all_refresh_tokens
from accounts.models import UserRole, UserStatus
from academics.models import Student


def _set_student_temp_pin(student):
    if not student.account_id:
        raise ValueError("Student does not have a linked login account.")
    account = student.account
    if account.role != UserRole.STUDENT:
        raise ValueError("Linked account is not a student account.")
    pin = generate_student_temp_pin()
    account.set_password(pin)
    account.must_change_password = True
    account.status = UserStatus.ACTIVE if student.status == "active" else UserStatus.INACTIVE
    account.is_active = student.status == "active"
    account.save(update_fields=["password", "must_change_password", "status", "is_active"])
    revoke_all_refresh_tokens(account)
    return pin


def reset_student_to_temp_pin(student):
    return _set_student_temp_pin(student)


@transaction.atomic
def migrate_student_credentials():
    students = (
        Student.objects.select_related("account", "school_class__school")
        .select_for_update()
        .filter(status="active", account__isnull=False, account__role=UserRole.STUDENT)
        .order_by("school_class__school__school_code", "school_class__grade", "school_class__section", "roll_number", "id")
    )
    rows = []
    for student in students:
        pin = _set_student_temp_pin(student)
        rows.append({
            "student_id": student.student_id,
            "name": student.name,
            "school_code": student.school_class.school.school_code,
            "class": student.school_class.display_name,
            "username": student.account.username,
            "temporary_pin": pin,
        })
    return rows


def credential_csv_response(rows, filename="pixiu-student-temporary-pins.csv"):
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["student_id", "name", "school_code", "class", "username", "temporary_pin"])
    writer.writeheader()
    writer.writerows(rows)
    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
