import csv
import io
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

from django.contrib.auth.hashers import make_password
from django.http import HttpResponse
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from accounts.credentials import build_student_username, generate_student_temp_pin
from accounts.models import StudentCredentialBatch, User, UserRole, UserStatus
from academics.models import Student

BATCH_SIZE = 20
PDF_ROW_LIMIT = 5000


def _hash_pin(pin):
    return make_password(pin)


def _ordered_active_students(student_ids):
    students = list(
        Student.objects.select_related("account", "school_class__school")
        .filter(status="active", id__in=student_ids)
    )
    order = {str(pk): index for index, pk in enumerate(student_ids)}
    students.sort(key=lambda student: order[str(student.id)])
    return students


def start_student_credential_batch(admin_user):
    student_ids = list(
        Student.objects.filter(status="active")
        .order_by(
            "school_class__school__school_code",
            "school_class__grade",
            "school_class__section",
            "roll_number",
            "id",
        )
        .values_list("id", flat=True)
    )
    return StudentCredentialBatch.objects.create(
        created_by=admin_user,
        student_ids=[str(pk) for pk in student_ids],
        total_count=len(student_ids),
    )


def process_student_credential_batch(batch):
    if batch.status == StudentCredentialBatch.Status.COMPLETED:
        return [], True
    if batch.status == StudentCredentialBatch.Status.FAILED:
        raise ValidationError(batch.error or "Credential migration failed.")

    batch.status = StudentCredentialBatch.Status.RUNNING
    batch.save(update_fields=["status", "updated_at"])

    start = batch.processed_count
    ids = batch.student_ids[start : start + BATCH_SIZE]
    if not ids:
        batch.status = StudentCredentialBatch.Status.COMPLETED
        batch.save(update_fields=["status", "updated_at"])
        return [], True

    students = _ordered_active_students(ids)
    usernames = []
    for student in students:
        school_class = student.school_class
        student_id = build_student_username(
            school_class.school.school_code,
            school_class.grade,
            school_class.section,
            student.roll_number,
        )
        usernames.append(student_id)

    duplicate_usernames = {name for name in usernames if usernames.count(name) > 1}
    if duplicate_usernames:
        raise ValidationError(f"Student username collision detected: {sorted(duplicate_usernames)[0]}.")

    existing_accounts = {
        user.username: user
        for user in User.objects.filter(username__in=usernames)
    }
    for username in usernames:
        account = existing_accounts.get(username)
        if account is not None and account.role != UserRole.STUDENT:
            raise ValidationError(f"Username {username} is already used by another account role.")

    pins = [generate_student_temp_pin() for _ in students]
    workers = min(4, max(1, os.cpu_count() or 2))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        hashes = list(executor.map(_hash_pin, pins))

    account_updates = []
    account_creates = []
    student_updates = []
    affected_user_ids = []

    for student, username, pin_hash in zip(students, usernames, hashes):
        account = existing_accounts.get(username)
        if account is None:
            account = User(username=username, role=UserRole.STUDENT)
            account_creates.append(account)
        account.role = UserRole.STUDENT
        account.username = username
        account.display_name = student.name
        account.email = student.email
        account.password = pin_hash
        account.must_change_password = True
        account.status = UserStatus.ACTIVE
        account.is_active = True
        if account.pk:
            account_updates.append(account)
            affected_user_ids.append(account.pk)
        student.account = account
        student_updates.append(student)

    if account_creates:
        User.objects.bulk_create(account_creates)
        affected_user_ids.extend([account.pk for account in account_creates])

    if account_updates:
        User.objects.bulk_update(
            account_updates,
            ["username", "display_name", "email", "password", "must_change_password", "status", "is_active"],
        )

    if account_creates:
        Student.objects.bulk_update(student_updates, ["account"])
    else:
        Student.objects.bulk_update(student_updates, ["account"])

    if affected_user_ids:
        outstanding = list(OutstandingToken.objects.filter(user_id__in=affected_user_ids).only("id"))
        if outstanding:
            BlacklistedToken.objects.bulk_create(
                [BlacklistedToken(token=token) for token in outstanding],
                ignore_conflicts=True,
            )

    rows = []
    for student, username, pin in zip(students, usernames, pins):
        rows.append({
            "student_id": student.student_id,
            "name": student.name,
            "school_code": student.school_class.school.school_code,
            "class_name": student.school_class.display_name,
            "username": username,
            "temporary_pin": pin,
        })

    batch.processed_count = start + len(ids)
    if batch.processed_count >= batch.total_count:
        batch.status = StudentCredentialBatch.Status.COMPLETED
    batch.save(update_fields=["processed_count", "status", "updated_at"])
    return rows, batch.status == StudentCredentialBatch.Status.COMPLETED


def _filtered_rows(rows, school_code="", class_name=""):
    school_code = str(school_code or "").strip()
    class_name = str(class_name or "").strip()
    return [
        row for row in rows
        if (not school_code or row.get("school_code") == school_code)
        and (not class_name or row.get("class_name") == class_name)
    ]


def _validate_rows(rows):
    if not isinstance(rows, list) or len(rows) > PDF_ROW_LIMIT:
        raise ValidationError("Invalid credential row set.")
    required = {"student_id", "name", "school_code", "class_name", "username", "temporary_pin"}
    clean = []
    for row in rows:
        if not isinstance(row, dict) or set(row.keys()) != required:
            raise ValidationError("Invalid credential data.")
        pin = str(row["temporary_pin"])
        if len(pin) != 8 or not pin.isdigit():
            raise ValidationError("Invalid temporary PIN format.")
        clean.append({key: str(row[key]) for key in required})
    return clean


def credential_csv_response(rows, filename="pixiu-student-temporary-pins.csv"):
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["student_id", "name", "school_code", "class_name", "username", "temporary_pin"],
    )
    writer.writeheader()
    writer.writerows(rows)
    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def credential_pdf_response(rows, school_code="", class_name=""):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    clean_rows = _filtered_rows(_validate_rows(rows), school_code, class_name)
    if not clean_rows:
        raise ValidationError("No students match the selected filters.")

    schools = sorted({row["school_code"] for row in clean_rows})
    classes = sorted({row["class_name"] for row in clean_rows})
    title_suffix = school_code or (schools[0] if len(schools) == 1 else "All Schools")
    if class_name:
        title_suffix += f" · {class_name}"

    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    title = ParagraphStyle("PixiuTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_LEFT, textColor=colors.HexColor("#0F172A"), spaceAfter=4)
    subtitle = ParagraphStyle("PixiuSubtitle", parent=styles["Normal"], fontSize=9, leading=12, textColor=colors.HexColor("#64748B"), spaceAfter=8)
    section = ParagraphStyle("PixiuSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=colors.HexColor("#1D4ED8"), spaceBefore=7, spaceAfter=5)
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=14 * mm, leftMargin=14 * mm, topMargin=14 * mm, bottomMargin=14 * mm, title="Pixiu Tech Student Temporary Credentials", author="Pixiu Tech")
    story = [Paragraph("PIXIU TECH", title), Paragraph(f"Student Temporary Credentials · {title_suffix}", subtitle), Spacer(1, 2 * mm)]

    grouped = {}
    for row in clean_rows:
        key = (row["school_code"], row["class_name"])
        grouped.setdefault(key, []).append(row)

    for (school, cls), group in grouped.items():
        story.append(Paragraph(f"{school} · {cls}", section))
        data = [["#", "Student", "Student ID", "Username", "Temporary PIN"]]
        for index, row in enumerate(group, 1):
            data.append([str(index), row["name"], row["student_id"], row["username"], row["temporary_pin"]])
        table = Table(data, colWidths=[9 * mm, 45 * mm, 32 * mm, 40 * mm, 35 * mm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("FONTNAME", (4, 1), (4, -1), "Courier-Bold"),
            ("FONTSIZE", (0, 1), (-1, -1), 7.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([table, Spacer(1, 5 * mm)])

    story.append(Paragraph("CONFIDENTIAL · Temporary PINs are for controlled distribution to the named students only.", subtitle))
    doc.build(story)
    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    safe_school = (school_code or "all-schools").replace(" ", "-")
    safe_class = (class_name or "all-classes").replace(" ", "-")
    response["Content-Disposition"] = f'attachment; filename="pixiu-student-credentials-{safe_school}-{safe_class}.pdf"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
