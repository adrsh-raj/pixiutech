import base64
import csv
import hashlib
import io
import json

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from accounts.credentials import build_student_username, generate_student_temp_pin
from accounts.models import StudentCredentialBatch, User, UserRole, UserStatus
from academics.models import Student

BATCH_SIZE = 4
PDF_ROW_LIMIT = 5000


def _fernet():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest())
    return Fernet(key)


def _encrypt_rows(rows):
    payload = json.dumps(rows, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return _fernet().encrypt(payload).decode("ascii")


def _decrypt_rows(value):
    if not value:
        return []
    return json.loads(_fernet().decrypt(value.encode("ascii")).decode("utf-8"))


def _ordered_active_students(student_ids):
    students = list(
        Student.objects.select_related("account", "school_class__school")
        .filter(status="active", id__in=student_ids)
    )
    order = {str(pk): index for index, pk in enumerate(student_ids)}
    students.sort(key=lambda student: order[str(student.id)])
    return students


def start_student_credential_batch(admin_user):
    existing = StudentCredentialBatch.objects.filter(
        created_by=admin_user,
        status__in=[StudentCredentialBatch.Status.PENDING, StudentCredentialBatch.Status.RUNNING],
    ).first()
    if existing:
        return existing

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


def _bulk_revoke_refresh_tokens(user_ids):
    user_ids = [uid for uid in user_ids if uid]
    if not user_ids:
        return
    token_ids = list(OutstandingToken.objects.filter(user_id__in=user_ids).values_list("id", flat=True))
    if not token_ids:
        return
    existing = set(BlacklistedToken.objects.filter(token_id__in=token_ids).values_list("token_id", flat=True))
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token_id=token_id) for token_id in token_ids if token_id not in existing],
        ignore_conflicts=True,
    )


def _prepare_student(student):
    school_class = student.school_class
    username = build_student_username(
        school_class.school.school_code,
        school_class.grade,
        school_class.section,
        student.roll_number,
    )
    if student.student_id != username:
        collision = Student.objects.filter(student_id=username).exclude(pk=student.pk).exists()
        if collision:
            raise ValidationError(f"Student ID collision detected for {username}.")
        student.student_id = username

    account = student.account
    if account is not None and account.role != UserRole.STUDENT:
        raise ValidationError(f"Student {student.student_id} is linked to a non-student account.")
    if account is None:
        account = User.objects.filter(username=username).first()
        if account is not None and account.role != UserRole.STUDENT:
            raise ValidationError(f"Username {username} is already used by another account role.")
        if account is None:
            account = User(username=username, role=UserRole.STUDENT)
    else:
        owner = User.objects.filter(username=username).exclude(pk=account.pk).first()
        if owner is not None:
            raise ValidationError(f"Username {username} is already used by another account.")

    pin = generate_student_temp_pin()
    account.role = UserRole.STUDENT
    account.username = username
    account.display_name = student.name
    account.email = student.email
    account.set_password(pin)
    account.must_change_password = True
    account.status = UserStatus.ACTIVE
    account.is_active = True
    return student, account, pin, username


def process_student_credential_batch(batch):
    with transaction.atomic():
        batch = StudentCredentialBatch.objects.select_for_update().get(pk=batch.pk)
        if batch.status == StudentCredentialBatch.Status.COMPLETED:
            return [], True, batch
        if batch.status == StudentCredentialBatch.Status.FAILED:
            raise ValidationError(batch.error or "Credential migration failed.")

        start = batch.processed_count
        ids = batch.student_ids[start : start + BATCH_SIZE]
        if not ids:
            batch.status = StudentCredentialBatch.Status.COMPLETED
            batch.save(update_fields=["status", "updated_at"])
            return [], True, batch

        batch.status = StudentCredentialBatch.Status.RUNNING
        batch.save(update_fields=["status", "updated_at"])
        students = _ordered_active_students(ids)
        prepared = [_prepare_student(student) for student in students]

        affected_user_ids = []
        for student, account, _, _ in prepared:
            account.save()
            student.account_id = account.pk
            student.save(update_fields=["student_id", "account", "updated_at"])
            affected_user_ids.append(account.pk)

        _bulk_revoke_refresh_tokens(affected_user_ids)

        rows = _decrypt_rows(batch.encrypted_payload)
        rows.extend([
            {
                "student_id": student.student_id,
                "name": student.name,
                "school_code": student.school_class.school.school_code,
                "class_name": student.school_class.display_name,
                "username": username,
                "temporary_pin": pin,
            }
            for student, _, pin, username in prepared
        ])
        batch.processed_count = min(batch.total_count, start + len(students))
        batch.encrypted_payload = _encrypt_rows(rows)
        if batch.processed_count >= batch.total_count:
            batch.processed_count = batch.total_count
            batch.status = StudentCredentialBatch.Status.COMPLETED
        batch.save(update_fields=["processed_count", "encrypted_payload", "status", "updated_at"])
        return [], batch.status == StudentCredentialBatch.Status.COMPLETED, batch


def get_batch_rows(batch):
    return _decrypt_rows(batch.encrypted_payload)


def get_batch_filters(batch):
    rows = get_batch_rows(batch)
    return sorted({row["school_code"] for row in rows}), sorted({row["class_name"] for row in rows})


def _filtered_rows(rows, school_code="", class_name=""):
    school_code = str(school_code or "").strip()
    class_name = str(class_name or "").strip()
    return [row for row in rows if (not school_code or row.get("school_code") == school_code) and (not class_name or row.get("class_name") == class_name)]


def credential_csv_response(rows, filename="pixiu-student-temporary-pins.csv"):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["student_id", "name", "school_code", "class_name", "username", "temporary_pin"])
    writer.writeheader()
    writer.writerows(rows)
    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def credential_pdf_response(rows, school_code="", class_name=""):
    clean_rows = _filtered_rows(rows, school_code, class_name)
    if not clean_rows or len(clean_rows) > PDF_ROW_LIMIT:
        raise ValidationError("No students match the selected filters or export is too large.")

    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    title = ParagraphStyle("PixiuTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_LEFT, textColor=colors.HexColor("#0F172A"), spaceAfter=4)
    subtitle = ParagraphStyle("PixiuSubtitle", parent=styles["Normal"], fontSize=9, leading=12, textColor=colors.HexColor("#64748B"), spaceAfter=8)
    section = ParagraphStyle("PixiuSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=colors.HexColor("#1D4ED8"), spaceBefore=7, spaceAfter=5)
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=12 * mm, leftMargin=12 * mm, topMargin=13 * mm, bottomMargin=13 * mm, title="Pixiu Tech Student Temporary Credentials", author="Pixiu Tech")
    story = [Paragraph("PIXIU TECH", title), Paragraph("Student Temporary Credentials", subtitle)]

    grouped = {}
    for row in clean_rows:
        grouped.setdefault((row["school_code"], row["class_name"]), []).append(row)

    for (school, cls), group in grouped.items():
        story.append(Paragraph(f"{school} · {cls}", section))
        data = [["#", "Student", "Student ID", "Username", "Temporary PIN"]]
        data.extend([[str(i), r["name"], r["student_id"], r["username"], r["temporary_pin"]] for i, r in enumerate(group, 1)])
        table = Table(data, colWidths=[9 * mm, 44 * mm, 33 * mm, 40 * mm, 36 * mm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (4, 1), (4, -1), "Courier-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (4, 1), (4, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([table, Spacer(1, 5 * mm)])

    story.append(Paragraph("CONFIDENTIAL · Give each student only their own temporary PIN.", subtitle))
    doc.build(story)
    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    safe_school = (school_code or "all-schools").replace(" ", "-")
    safe_class = (class_name or "all-classes").replace(" ", "-")
    response["Content-Disposition"] = f'attachment; filename="pixiu-student-credentials-{safe_school}-{safe_class}.pdf"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
