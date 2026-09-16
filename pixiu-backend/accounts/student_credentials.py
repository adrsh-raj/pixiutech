import csv
from io import StringIO

from django.db import transaction
from django.http import HttpResponse

from accounts.credentials import build_student_username, generate_student_temp_pin, revoke_all_refresh_tokens
from accounts.models import User, UserRole, UserStatus
from academics.models import Student


def _set_student_temp_pin(student):
    school_class = student.school_class
    generated_student_id = build_student_username(school_class.school.school_code, school_class.grade, school_class.section, student.roll_number)
    if student.student_id != generated_student_id:
        student.student_id = generated_student_id
        student.save(update_fields=["student_id", "updated_at"])

    account = student.account
    if account is not None and account.role != UserRole.STUDENT:
        raise ValueError(f"Student {student.student_id} is linked to a non-student account.")
    pin = generate_student_temp_pin()
    if account is None:
        from accounts.models import User
        account = User(username=student.student_id, role=UserRole.STUDENT)
    account.role = UserRole.STUDENT
    account.username = student.student_id
    account.display_name = student.name
    account.email = student.email
    account.set_password(pin)
    account.must_change_password = True
    account.status = UserStatus.ACTIVE
    account.is_active = True
    account.save()
    if student.account_id != account.id:
        student.account = account
        student.save(update_fields=["account", "updated_at"])
    revoke_all_refresh_tokens(account)
    return pin


def reset_student_to_temp_pin(student):
    return _set_student_temp_pin(student)


@transaction.atomic
def migrate_student_credentials():
    students = (
        Student.objects.select_related("account", "school_class__school")
        .select_for_update()
        .filter(status="active")
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
