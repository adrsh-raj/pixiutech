from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import qrcode
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


# Official credential pack: two portrait A4 pages.
# Page 1 = student score card.
# Page 2 = certificate of completion with verification QR.
CERTIFICATE_SIZE = A4

NAVY = colors.HexColor("#071A33")
BLUE = colors.HexColor("#1768FF")
GOLD = colors.HexColor("#C8A04B")
INK = colors.HexColor("#17263B")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#D9E2EE")
SOFT = colors.HexColor("#F5F8FC")
WHITE = colors.white
GOOD = colors.HexColor("#087443")


def _logo_path():
    base = Path(settings.BASE_DIR)
    candidates = [
        base / "core" / "assets" / "pixiu-logo.png",
        base / "core" / "assets" / "logo.png",
    ]
    return next((path for path in candidates if path.exists()), None)


def _fit_text(c, value, max_width, font="Helvetica-Bold", max_size=12, min_size=7):
    text = str(value or "").strip()
    size = max_size
    while size > min_size and stringWidth(text, font, size) > max_width:
        size -= 0.25
    return text, size


def _draw_logo(c, x, y, width=46 * mm, height=18 * mm):
    logo = _logo_path()
    if logo:
        c.drawImage(
            ImageReader(str(logo)),
            x,
            y,
            width=width,
            height=height,
            preserveAspectRatio=True,
            anchor="sw",
            mask="auto",
        )
        return

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(x, y + 10 * mm, "PIXIU")
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x + 37 * mm, y + 4 * mm, "TECH")
    c.setStrokeColor(BLUE)
    c.setLineWidth(2.5)
    c.line(x + 25 * mm, y + 12 * mm, x + 36 * mm, y + 23 * mm)
    c.setFillColor(GOLD)
    c.circle(x + 29 * mm, y + 15 * mm, 2.2 * mm, fill=1, stroke=0)


def _qr_buffer(url):
    buf = BytesIO()
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    qr.make_image(fill_color="#071A33", back_color="white").save(buf, format="PNG")
    buf.seek(0)
    return buf


def _certificate_page_bytes(certificate):
    payload = dict(certificate.snapshot or {})
    technologies = certificate.technologies_snapshot or payload.get("technologies") or []

    names = []
    for item in technologies:
        value = item.get("name") or item.get("technology") if isinstance(item, dict) else item
        value = str(value or "").strip()
        if value and value not in names:
            names.append(value)

    student_name = str(payload.get("student_name") or certificate.student.name or "").strip().upper()
    student_id = str(payload.get("student_id") or certificate.student.student_id or "").strip()
    school_name = str(payload.get("school_name") or certificate.school_class.school.name or "").strip()
    class_name = str(payload.get("class_name") or certificate.school_class.display_name or "").strip()
    programme = str(certificate.programme_name or "Pixiu Technology Programme").strip()
    score = float(certificate.overall_score or 0)
    issued_at = certificate.issued_at or timezone.now()
    verification_url = f"https://pixiutech.com/verify?cert={quote(certificate.certificate_id)}"

    width, height = CERTIFICATE_SIZE
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=CERTIFICATE_SIZE)
    c.setTitle(f"Pixiu Tech Certificate - {certificate.student.name}")
    c.setAuthor("Pixiu Tech LLP")

    # Background and premium border.
    c.setFillColor(WHITE)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setStrokeColor(NAVY)
    c.setLineWidth(2.4)
    c.roundRect(13 * mm, 13 * mm, width - 26 * mm, height - 26 * mm, 4 * mm, fill=0, stroke=1)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.roundRect(17 * mm, 17 * mm, width - 34 * mm, height - 34 * mm, 3 * mm, fill=0, stroke=1)

    # Header band.
    c.setFillColor(NAVY)
    c.roundRect(17 * mm, height - 57 * mm, width - 34 * mm, 37 * mm, 3 * mm, fill=1, stroke=0)
    _draw_logo(c, 26 * mm, height - 49 * mm, width=42 * mm, height=16 * mm)

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 15)
    c.drawRightString(width - 27 * mm, height - 35 * mm, "PIXIU TECH LLP")
    c.setFillColor(colors.HexColor("#BFD2EF"))
    c.setFont("Helvetica", 6.9)
    c.drawRightString(
        width - 27 * mm,
        height - 44 * mm,
        "SCHOOL TECHNOLOGY INFRASTRUCTURE  ·  EXPERIENTIAL LEARNING",
    )

    # Verification badge.
    badge_x = width - 60 * mm
    badge_y = height - 77 * mm
    c.setFillColor(SOFT)
    c.setStrokeColor(LINE)
    c.roundRect(badge_x, badge_y, 32 * mm, 12 * mm, 6 * mm, fill=1, stroke=1)
    c.setFillColor(GOOD)
    c.circle(badge_x + 5 * mm, badge_y + 6 * mm, 1.6 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 5.8)
    c.drawString(badge_x + 8 * mm, badge_y + 4.7 * mm, "OFFICIAL VERIFIED")
    c.drawRightString(width - 27 * mm, badge_y + 1.2 * mm, "DIGITAL CREDENTIAL")

    # Main title.
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawCentredString(width / 2, height - 87 * mm, "PIXIU TECHNOLOGY PROGRAMME")
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 25)
    c.drawCentredString(width / 2, height - 103 * mm, "CERTIFICATE OF COMPLETION")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, height - 117 * mm, "This certificate is proudly presented to")

    fitted_name, name_size = _fit_text(
        c, student_name, width - 62 * mm, "Times-Bold", 28, 16
    )
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", name_size)
    c.drawCentredString(width / 2, height - 137 * mm, fitted_name)

    c.setStrokeColor(GOLD)
    c.setLineWidth(1.1)
    c.line(52 * mm, height - 144 * mm, width - 52 * mm, height - 144 * mm)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawCentredString(
        width / 2,
        height - 157 * mm,
        "for successfully completing the prescribed practical and experiential",
    )
    c.drawCentredString(
        width / 2,
        height - 164 * mm,
        "learning programme in",
    )

    technology_text = "  ·  ".join(names) if names else "Technology Programme"
    technology_text, tech_size = _fit_text(
        c, technology_text.upper(), width - 58 * mm, "Helvetica-Bold", 14, 8.5
    )
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", tech_size)
    c.drawCentredString(width / 2, height - 177 * mm, technology_text)

    # Student information ribbon.
    info_y = height - 211 * mm
    c.setFillColor(SOFT)
    c.setStrokeColor(LINE)
    c.roundRect(28 * mm, info_y, width - 56 * mm, 31 * mm, 4 * mm, fill=1, stroke=1)

    info = [
        ("STUDENT ID", student_id),
        ("SCHOOL", school_name),
        ("CLASS", class_name),
        ("PROGRAMME", programme),
    ]
    col_width = (width - 66 * mm) / 4
    for index, (label, value) in enumerate(info):
        x = 33 * mm + index * col_width
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 5.7)
        c.drawString(x, info_y + 22 * mm, label)
        fitted_value, value_size = _fit_text(
            c, value, col_width - 4 * mm, "Helvetica-Bold", 7.4, 5.5
        )
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", value_size)
        c.drawString(x, info_y + 10 * mm, fitted_value)

    # Official result panel.
    result_y = height - 252 * mm
    c.setFillColor(NAVY)
    c.roundRect(28 * mm, result_y, width - 56 * mm, 31 * mm, 4 * mm, fill=1, stroke=0)

    c.setFillColor(colors.HexColor("#BFD2EF"))
    c.setFont("Helvetica-Bold", 5.8)
    c.drawString(35 * mm, result_y + 22 * mm, "OFFICIAL PROGRAMME RESULT")
    c.setFillColor(WHITE)
    c.setFont("Times-Bold", 24)
    c.drawString(35 * mm, result_y + 8 * mm, f"{score:.2f}%")

    c.setFillColor(colors.HexColor("#BFD2EF"))
    c.setFont("Helvetica", 6.8)
    c.drawString(71 * mm, result_y + 20 * mm, "Recorded in Pixiu Tech Central Registry")
    c.drawString(71 * mm, result_y + 13 * mm, f"Issued {issued_at.strftime('%d %B %Y')}")
    c.drawString(71 * mm, result_y + 6 * mm, "Certificate status: ISSUED · VERIFIED")

    # Certificate ID and verification block.
    lower_y = 43 * mm
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(28 * mm, lower_y + 38 * mm, "CERTIFICATE ID")
    cert_id, cert_size = _fit_text(
        c, certificate.certificate_id, 92 * mm, "Helvetica-Bold", 7.4, 5.2
    )
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", cert_size)
    c.drawString(28 * mm, lower_y + 31 * mm, cert_id)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.3)
    c.drawString(28 * mm, lower_y + 22 * mm, "Verify this credential online using the certificate ID or QR code.")
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 6.4)
    c.drawString(28 * mm, lower_y + 15 * mm, "pixiutech.com/verify")

    qr = _qr_buffer(verification_url)
    qr_x = width - 63 * mm
    qr_y = 32 * mm
    c.setFillColor(WHITE)
    c.setStrokeColor(LINE)
    c.roundRect(qr_x, qr_y, 35 * mm, 35 * mm, 4 * mm, fill=1, stroke=1)
    c.drawImage(
        ImageReader(qr),
        qr_x + 3.7 * mm,
        qr_y + 7 * mm,
        width=27.6 * mm,
        height=27.6 * mm,
        mask="auto",
    )
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 5.8)
    c.drawCentredString(qr_x + 17.5 * mm, qr_y + 3.1 * mm, "SCAN TO VERIFY")
    c.linkURL(verification_url, (qr_x, qr_y, qr_x + 35 * mm, qr_y + 35 * mm), relative=0)

    # Signatures.
    sig_y = 38 * mm
    c.setStrokeColor(colors.HexColor("#A6B3C3"))
    c.setLineWidth(0.7)
    c.line(28 * mm, sig_y, 78 * mm, sig_y)
    c.line(86 * mm, sig_y, 136 * mm, sig_y)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 5.8)
    c.drawCentredString(53 * mm, sig_y - 4.8 * mm, "TRAINER / FACULTY")
    c.drawCentredString(111 * mm, sig_y - 4.8 * mm, "AUTHORIZED SIGNATORY")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.2)
    c.drawCentredString(53 * mm, sig_y - 9 * mm, "Pixiu Tech Learning Programme")
    c.drawCentredString(111 * mm, sig_y - 9 * mm, "PIXIU TECH LLP")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.4)
    c.drawString(28 * mm, 21 * mm, "Digitally verifiable credential")
    c.drawRightString(width - 28 * mm, 21 * mm, "PIXIU TECH LLP")

    c.save()
    buffer.seek(0)
    return buffer.getvalue()

def build_certificate_pdf(certificate, include_scorecard=True):
    """
    Build the official credential.

    Authenticated portal requests may include the scorecard as a second page.
    Public certificate links intentionally return only the certificate page;
    marks and top-25 ranking belong on the public verification website.
    """
    if not include_scorecard:
        output = BytesIO(_certificate_page_bytes(certificate))
        response = HttpResponse(output.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="{certificate.certificate_id}.pdf"'
        )
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "no-store"
        return response

    from .scorecard_pdf import build_scorecard_pdf

    snapshot = dict(certificate.snapshot or {})
    stored_scorecard = snapshot.get("scorecard")

    if isinstance(stored_scorecard, dict):
        scorecard = dict(stored_scorecard)
    else:
        scorecard = {
            "class_size": snapshot.get("class_size") or 0,
            "class_rank": certificate.rank,
            "rank_display": "-",
            "rank_slots": snapshot.get("rank_slots") or 0,
            "attendance_pct": snapshot.get("attendance_pct") or 0,
            "quiz_pct": snapshot.get("quiz_pct") or 0,
            "practical_pct": snapshot.get("practical_pct") or 0,
            "trainer_review_pct": snapshot.get("trainer_review_pct") or 0,
            "top_ranking": [],
        }

    # The public ranking stays on the verification website, not in the PDF.
    scorecard["top_ranking"] = []
    scorecard["top25_ranking"] = []
    scorecard["top10_ranking"] = []
    scorecard["rank_display"] = "-"

    scorecard_response = build_scorecard_pdf(
        certificate,
        scorecard,
        include_ranking=False,
    )
    scorecard_bytes = bytes(scorecard_response.content)
    certificate_page_bytes = _certificate_page_bytes(certificate)

    writer = PdfWriter()
    for source in (scorecard_bytes, certificate_page_bytes):
        reader = PdfReader(BytesIO(source))
        for page in reader.pages:
            writer.add_page(page)

    output = BytesIO()
    writer.write(output)
    output.seek(0)

    response = HttpResponse(output.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = (
        f'inline; filename="{certificate.certificate_id}.pdf"'
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "no-store"
    return response

