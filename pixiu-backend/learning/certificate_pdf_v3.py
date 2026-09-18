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
    school_name = str(
        payload.get("school_name") or certificate.school_class.school.name or ""
    ).strip()
    class_name = str(
        payload.get("class_name") or certificate.school_class.display_name or ""
    ).strip()
    programme = str(
        certificate.programme_name or "Pixiu Technology Programme"
    ).strip()
    score = float(certificate.overall_score or 0)
    issued_at = certificate.issued_at or timezone.now()
    verification_url = str(
        payload.get("verification_url")
        or f"https://pixiutech.com/verify?cert={quote(certificate.certificate_id)}"
    )

    width, height = CERTIFICATE_SIZE
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=CERTIFICATE_SIZE)
    c.setTitle(f"Pixiu Tech Certificate - {certificate.student.name}")
    c.setAuthor("Pixiu Tech LLP")

    # Clean A4 portrait sheet with a strong institutional frame.
    c.setFillColor(WHITE)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setStrokeColor(NAVY)
    c.setLineWidth(2.2)
    c.rect(14 * mm, 14 * mm, width - 28 * mm, height - 28 * mm)

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.rect(18 * mm, 18 * mm, width - 36 * mm, height - 36 * mm)

    # Header.
    _draw_logo(c, 28 * mm, height - 48 * mm, width=43 * mm, height=17 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.7)
    c.drawString(
        28 * mm,
        height - 52 * mm,
        "School Technology Infrastructure  •  Experiential Learning",
    )

    c.setFillColor(SOFT)
    c.setStrokeColor(LINE)
    c.roundRect(
        width - 71 * mm,
        height - 45 * mm,
        49 * mm,
        16 * mm,
        8 * mm,
        fill=1,
        stroke=1,
    )
    c.setFillColor(BLUE)
    c.circle(width - 66.5 * mm, height - 37 * mm, 1.8 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 6.1)
    c.drawString(width - 62 * mm, height - 39 * mm, "OFFICIAL DIGITAL")
    c.drawString(width - 62 * mm, height - 43.5 * mm, "CREDENTIAL")

    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(28 * mm, height - 59 * mm, width - 28 * mm, height - 59 * mm)

    # Main title.
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 25)
    c.drawCentredString(width / 2, height - 91 * mm, "CERTIFICATE OF COMPLETION")

    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 8.8)
    c.drawCentredString(width / 2, height - 99 * mm, programme.upper())

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.6)
    c.drawCentredString(
        width / 2,
        height - 118 * mm,
        "This certificate is proudly presented to",
    )

    fitted_name, name_size = _fit_text(
        c,
        student_name,
        width - 75 * mm,
        "Times-Bold",
        28,
        18,
    )
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", name_size)
    c.drawCentredString(width / 2, height - 136 * mm, fitted_name)

    c.setStrokeColor(GOLD)
    c.setLineWidth(1.15)
    c.line(
        56 * mm,
        height - 143 * mm,
        width - 56 * mm,
        height - 143 * mm,
    )

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.2)
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

    tech_text = "  •  ".join(names) if names else "Technology Programme"
    fitted_tech, tech_size = _fit_text(
        c,
        tech_text.upper(),
        width - 75 * mm,
        "Helvetica-Bold",
        15,
        9,
    )
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", tech_size)
    c.drawCentredString(width / 2, height - 179 * mm, fitted_tech)

    meta, meta_size = _fit_text(
        c,
        f"{school_name}  |  Class {class_name}",
        width - 65 * mm,
        "Helvetica",
        9,
        7,
    )
    c.setFillColor(MUTED)
    c.setFont("Helvetica", meta_size)
    c.drawCentredString(width / 2, height - 190 * mm, meta)

    # Official score block.
    block_y = 84 * mm
    block_h = 29 * mm
    c.setFillColor(SOFT)
    c.setStrokeColor(LINE)
    c.roundRect(28 * mm, block_y, width - 56 * mm, block_h, 4 * mm, fill=1, stroke=1)

    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(36 * mm, block_y + 20 * mm, "OFFICIAL PROGRAMME SCORE")

    c.setFillColor(BLUE)
    c.setFont("Times-Bold", 25)
    c.drawString(36 * mm, block_y + 7 * mm, f"{score:.2f}%")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.4)
    c.drawString(80 * mm, block_y + 16 * mm, "Recorded in the Pixiu Tech LMS")
    c.drawString(80 * mm, block_y + 10 * mm, f"Issued {issued_at.strftime('%d %B %Y')}")

    c.setFillColor(GOOD)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawString(
        80 * mm,
        block_y + 4.5 * mm,
        "Official programme completion credential",
    )

    # Certificate identifier.
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(28 * mm, 69 * mm, "CERTIFICATE ID")

    cert_id, cert_size = _fit_text(
        c,
        certificate.certificate_id,
        95 * mm,
        "Helvetica",
        8.5,
        6,
    )
    c.setFillColor(MUTED)
    c.setFont("Helvetica", cert_size)
    c.drawString(28 * mm, 63 * mm, cert_id)

    # QR verification card.
    qr = _qr_buffer(verification_url)
    qr_card_x = width - 69 * mm
    qr_card_y = 33 * mm
    qr_card_w = 45 * mm
    qr_card_h = 45 * mm

    c.setFillColor(WHITE)
    c.setStrokeColor(LINE)
    c.roundRect(
        qr_card_x,
        qr_card_y,
        qr_card_w,
        qr_card_h,
        4 * mm,
        fill=1,
        stroke=1,
    )
    c.drawImage(
        ImageReader(qr),
        qr_card_x + 5 * mm,
        qr_card_y + 8 * mm,
        width=35 * mm,
        height=35 * mm,
        mask="auto",
    )
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 6.7)
    c.drawCentredString(
        qr_card_x + qr_card_w / 2,
        qr_card_y + 3.5 * mm,
        "SCAN TO VERIFY",
    )

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.8)
    c.drawString(28 * mm, 53 * mm, "Digitally verifiable credential")
    c.drawString(28 * mm, 47 * mm, "Pixiu Tech Central Registry")

    # Signature area.
    sig_y = 38 * mm
    c.setStrokeColor(colors.HexColor("#A6B3C3"))
    c.setLineWidth(0.75)
    c.line(28 * mm, sig_y, 85 * mm, sig_y)
    c.line(100 * mm, sig_y, 157 * mm, sig_y)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 6.7)
    c.drawCentredString(56.5 * mm, sig_y - 5 * mm, "TRAINER / FACULTY")
    c.drawCentredString(128.5 * mm, sig_y - 5 * mm, "AUTHORIZED SIGNATORY")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.2)
    c.drawCentredString(56.5 * mm, sig_y - 10 * mm, "Pixiu Tech Learning Programme")
    c.drawCentredString(128.5 * mm, sig_y - 10 * mm, "PIXIU TECH LLP")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.2)
    c.drawString(28 * mm, 23 * mm, "Verification: pixiutech.com/verify")
    c.drawRightString(width - 28 * mm, 23 * mm, "PIXIU TECH LLP")

    c.save()
    buffer.seek(0)
    return buffer.getvalue()


def build_certificate_pdf(certificate):
    """
    Return one official two-page A4 portrait credential pack:
    1) score card
    2) certificate with QR verification.
    """
    from . import course_completion_final as completion_service
    from .scorecard_pdf import build_scorecard_pdf

    scorecard = completion_service.scorecard_data(certificate)
    scorecard_response = build_scorecard_pdf(certificate, scorecard)
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
    return response
