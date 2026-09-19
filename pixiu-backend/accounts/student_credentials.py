import base64
import csv
import hashlib
import json
from io import BytesIO, StringIO

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from accounts.credentials import build_student_username, generate_student_temp_pin, invalidate_user_sessions
from accounts.models import BlacklistedToken, OutstandingToken, User, UserRole, UserStatus
from academics.models import Student

BATCH_SIZE = 8


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


def _set_student_temp_pin(student, *, revoke_tokens=True):
    school_class = student.school_class
    generated_student_id = build_student_username(
        school_class.school.school_code,
        school_class.grade,
        school_class.section,
        student.roll_number,
    )
    if student.student_id != generated_student_id:
        collision = Student.objects.filter(student_id=generated_student_id).exclude(pk=student.pk).exists()
        if collision:
            raise ValueError(f"Student ID collision detected for {generated_student_id}.")
        student.student_id = generated_student_id
        student.save(update_fields=["student_id", "updated_at"])

    account = student.account
    if account is not None and account.role != UserRole.STUDENT:
        raise ValueError(f"Student {student.student_id} is linked to a non-student account.")

    if account is None:
        account = User.objects.filter(username=student.student_id).first()
        if account is not None and account.role != UserRole.STUDENT:
            raise ValueError(f"Student ID {student.student_id} is already used by another account role.")
        if account is None:
            account = User(username=student.student_id, role=UserRole.STUDENT)
    else:
        username_owner = User.objects.filter(username=student.student_id).exclude(pk=account.pk).first()
        if username_owner is not None:
            raise ValueError(f"Student username {student.student_id} is already used by another account.")

    pin = generate_student_temp_pin()
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

    if revoke_tokens:
        invalidate_user_sessions(account)
    return pin


def revoke_refresh_tokens_for_users(user_ids):
    user_ids = list(user_ids)
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


def reset_student_to_temp_pin(student):
    return _set_student_temp_pin(student, revoke_tokens=True)


def create_student_credential_batch(actor):
    students = (
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
    student_ids = [str(value) for value in students]
    return StudentCredentialBatch.objects.create(
        created_by=actor,
        status=StudentCredentialBatch.Status.PENDING,
        student_ids=student_ids,
        total_count=len(student_ids),
    )


def process_student_credential_batch(batch_id, limit=BATCH_SIZE):
    limit = max(1, min(int(limit), 12))
    with transaction.atomic():
        batch = StudentCredentialBatch.objects.select_for_update().get(pk=batch_id)
        if batch.status == StudentCredentialBatch.Status.COMPLETED:
            rows = _decrypt_rows(batch.encrypted_payload)
            return batch, rows
        if batch.status == StudentCredentialBatch.Status.FAILED:
            raise ValueError(batch.error or "Credential migration failed.")

        batch.status = StudentCredentialBatch.Status.RUNNING
        batch.save(update_fields=["status", "updated_at"])

        start = batch.processed_count
        ids = batch.student_ids[start : start + limit]
        if not ids:
            batch.status = StudentCredentialBatch.Status.COMPLETED
            batch.save(update_fields=["status", "updated_at"])
            return batch, _decrypt_rows(batch.encrypted_payload)

        students = list(
            Student.objects.select_related("account", "school_class__school")
            .filter(id__in=ids, status="active")
            .order_by("school_class__school__school_code", "school_class__grade", "school_class__section", "roll_number", "id")
        )
        rows = _decrypt_rows(batch.encrypted_payload)
        user_ids = []
        for student in students:
            pin = _set_student_temp_pin(student, revoke_tokens=False)
            user_ids.append(student.account_id)
            rows.append({
                "student_id": student.student_id,
                "name": student.name,
                "school_code": student.school_class.school.school_code,
                "class": student.school_class.display_name,
                "username": student.account.username,
                "temporary_pin": pin,
            })

        revoke_refresh_tokens_for_users(user_ids)
        batch.processed_count += len(students)
        batch.encrypted_payload = _encrypt_rows(rows)
        if batch.processed_count >= batch.total_count:
            batch.processed_count = batch.total_count
            batch.status = StudentCredentialBatch.Status.COMPLETED
        batch.save(update_fields=["processed_count", "encrypted_payload", "status", "updated_at"])
        return batch, rows


def get_batch_rows(batch):
    return _decrypt_rows(batch.encrypted_payload)


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


def credential_pdf_response(rows, filename="pixiu-student-credentials.pdf"):
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    title = ParagraphStyle("pixiuTitle", parent=styles["Title"], alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=20, leading=24, spaceAfter=3)
    subtitle = ParagraphStyle("pixiuSubtitle", parent=styles["Normal"], alignment=TA_CENTER, fontSize=9, leading=12, textColor=colors.HexColor("#475569"), spaceAfter=10)
    section = ParagraphStyle("pixiuSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=colors.HexColor("#0f172a"), spaceBefore=4, spaceAfter=6)
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm, topMargin=10 * mm, bottomMargin=10 * mm, title="PIXIU Student Temporary Credentials")
    story = [Paragraph("PIXIU TECH", title), Paragraph("Student Temporary Credentials", subtitle), Spacer(1, 3 * mm)]

    grouped = {}
    for row in rows:
        grouped.setdefault((row["school_code"], row["class"]), []).append(row)

    for (school_code, class_name), group in grouped.items():
        story.append(Paragraph(f"{school_code}  ·  {class_name}", section))
        data = [["Student", "Student ID", "Username", "Temporary PIN"]]
        data.extend([[r["name"], r["student_id"], r["username"], r["temporary_pin"]] for r in group])
        table = Table(data, colWidths=[74 * mm, 46 * mm, 52 * mm, 42 * mm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("FONTNAME", (3, 1), (3, -1), "Courier-Bold"),
            ("ALIGN", (3, 1), (3, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.extend([table, Spacer(1, 7 * mm)])

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawString(10 * mm, 6 * mm, "CONFIDENTIAL · Give each student only their own temporary PIN")
        canvas.drawRightString(287 * mm, 6 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
