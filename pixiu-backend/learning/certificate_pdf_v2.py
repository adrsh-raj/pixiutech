from io import BytesIO
from urllib.parse import quote

import qrcode
from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


# Physical print format: A4 landscape (297 × 210 mm).
CERTIFICATE_SIZE = landscape(A4)


def _fit_text(c, value, max_width, font="Helvetica-Bold", max_size=12, min_size=7):
    text = str(value or "").strip()
    size = max_size
    while size > min_size and stringWidth(text, font, size) > max_width:
        size -= 0.25
    return text, size


def _draw_wordmark(c, x, y, scale=1.0):
    navy = colors.HexColor("#081B36")
    blue = colors.HexColor("#1768FF")
    gold = colors.HexColor("#C8A04B")
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 24 * scale)
    c.drawString(x, y, "PIXIU")
    c.setStrokeColor(blue)
    c.setLineWidth(2.6 * scale)
    c.line(x + 58 * scale, y + 3 * scale, x + 78 * scale, y + 23 * scale)
    c.setFillColor(gold)
    c.circle(x + 62 * scale, y + 9 * scale, 3.1 * scale, fill=1, stroke=0)
    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 8 * scale)
    c.drawString(x + 66 * scale, y - 9 * scale, "TECH")


def _qr_buffer(url):
    buf = BytesIO()
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=7, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr.make_image(fill_color="#081B36", back_color="white").save(buf, format="PNG")
    buf.seek(0)
    return buf


def build_certificate_pdf(certificate):
    payload = dict(certificate.snapshot or {})
    technologies = certificate.technologies_snapshot or payload.get("technologies") or []
    names = []
    for item in technologies:
        value = item.get("name") or item.get("technology") if isinstance(item, dict) else item
        value = str(value or "").strip()
        if value and value not in names:
            names.append(value)

    verification_url = str(
        payload.get("verification_url")
        or f"https://pixiutech.com/verify?cert={quote(certificate.certificate_id)}"
    )
    width, height = CERTIFICATE_SIZE
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=CERTIFICATE_SIZE)
    c.setTitle(f"Pixiu Tech Certificate - {certificate.student.name}")
    c.setAuthor("Pixiu Tech LLP")

    navy = colors.HexColor("#081B36")
    blue = colors.HexColor("#1768FF")
    gold = colors.HexColor("#C8A04B")
    ink = colors.HexColor("#142235")
    muted = colors.HexColor("#64748B")
    border = colors.HexColor("#D9E2EE")
    soft = colors.HexColor("#F6F8FC")

    c.setFillColor(colors.white)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Premium A4 frame with generous print-safe margins.
    c.setStrokeColor(navy)
    c.setLineWidth(3)
    c.rect(22, 22, width - 44, height - 44)
    c.setStrokeColor(gold)
    c.setLineWidth(1)
    c.rect(32, 32, width - 64, height - 64)

    # Brand header.
    _draw_wordmark(c, 55, height - 70, 1.0)
    c.setFillColor(muted)
    c.setFont("Helvetica", 8)
    c.drawString(55, height - 91, "School Technology Infrastructure  •  Experiential Learning")

    c.setFillColor(soft)
    c.setStrokeColor(border)
    c.roundRect(width - 237, height - 87, 182, 31, 15.5, fill=1, stroke=1)
    c.setFillColor(blue)
    c.circle(width - 219, height - 71.5, 4.5, fill=1, stroke=0)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(width - 208, height - 75, "OFFICIAL DIGITAL CREDENTIAL")
    c.setStrokeColor(border)
    c.line(55, height - 105, width - 55, height - 105)

    # Formal title area.
    c.setFillColor(navy)
    c.setFont("Times-Bold", 28)
    c.drawCentredString(width / 2, height - 145, "CERTIFICATE OF COMPLETION")
    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width / 2, height - 163, str(certificate.programme_name or "PIXIU TECHNOLOGY PROGRAMME").upper())

    student_name, name_size = _fit_text(
        c,
        str(payload.get("student_name") or certificate.student.name).upper(),
        500,
        "Times-Bold",
        30,
        20,
    )
    school_name = str(payload.get("school_name") or certificate.school_class.school.name or "")
    class_name = str(payload.get("class_name") or certificate.school_class.display_name or "")
    score = float(certificate.overall_score or 0)

    c.setFillColor(muted)
    c.setFont("Helvetica", 10.5)
    c.drawCentredString(width / 2, height - 196, "This certificate is proudly presented to")
    c.setFillColor(navy)
    c.setFont("Times-Bold", name_size)
    c.drawCentredString(width / 2, height - 235, student_name)
    c.setStrokeColor(gold)
    c.setLineWidth(1.3)
    c.line(width / 2 - 180, height - 248, width / 2 + 180, height - 248)

    c.setFillColor(muted)
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, height - 273, "for successfully completing the prescribed practical and experiential learning programme in")
    tech, tech_size = _fit_text(c, "  •  ".join(names).upper() if names else "TECHNOLOGY PROGRAMME", 510, "Helvetica-Bold", 17, 10)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", tech_size)
    c.drawCentredString(width / 2, height - 298, tech)
    c.setFillColor(muted)
    c.setFont("Helvetica", 9.5)
    c.drawCentredString(width / 2, height - 318, f"{school_name}  |  Class {class_name}  |  Overall Programme Score {score:.2f}%")

    # Score panel.
    panel_x, panel_y = 72, height - 405
    c.setFillColor(soft)
    c.setStrokeColor(border)
    c.roundRect(panel_x, panel_y, 300, 62, 12, fill=1, stroke=1)
    c.setFillColor(muted)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(panel_x + 18, panel_y + 43, "PROGRAMME SCORE")
    c.setFillColor(navy)
    c.setFont("Times-Bold", 25)
    c.drawString(panel_x + 18, panel_y + 15, f"{score:.2f}%")
    c.setFillColor(muted)
    c.setFont("Helvetica", 8)
    c.drawString(panel_x + 135, panel_y + 29, "Official programme score")
    c.drawString(panel_x + 135, panel_y + 18, "recorded in the Pixiu Tech LMS")
    c.setFillColor(blue)
    c.roundRect(panel_x, panel_y - 5, 300, 5, 2.5, fill=1, stroke=0)

    # Authenticity seal.
    seal_x, seal_y = width / 2 + 20, panel_y + 31
    c.setStrokeColor(gold)
    c.setLineWidth(1.4)
    c.circle(seal_x, seal_y, 30, fill=0, stroke=1)
    c.setLineWidth(0.8)
    c.circle(seal_x, seal_y, 24, fill=0, stroke=1)
    c.setFillColor(gold)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawCentredString(seal_x, seal_y + 6, "PIXIU TECH")
    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 5.7)
    c.drawCentredString(seal_x, seal_y - 5, "AUTHENTIC")
    c.setFillColor(muted)
    c.setFont("Helvetica", 6.2)
    c.drawCentredString(seal_x, seal_y - 14, "DIGITALLY VERIFIED")

    # Bottom credential metadata and QR.
    base_y = 69
    c.setStrokeColor(border)
    c.setLineWidth(0.9)
    c.line(55, base_y + 53, width - 195, base_y + 53)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(55, base_y + 36, "CERTIFICATE ID")
    cid, cid_size = _fit_text(c, certificate.certificate_id, 345, "Helvetica", 8.8, 6.4)
    c.setFillColor(muted)
    c.setFont("Helvetica", cid_size)
    c.drawString(55, base_y + 23, cid)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(55, base_y + 7, "ISSUED")
    c.setFillColor(muted)
    c.setFont("Helvetica", 8.8)
    c.drawString(55, base_y - 6, certificate.issued_at.strftime("%d %B %Y"))

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(width - 310, base_y + 36, "VERIFY ONLINE")
    c.setFillColor(muted)
    c.setFont("Helvetica", 7.2)
    c.drawString(width - 310, base_y + 23, "Scan to verify this credential")
    c.drawString(width - 310, base_y + 12, "against the Pixiu Tech Central Registry.")

    qr = _qr_buffer(verification_url)
    qr_x, qr_y = width - 150, 48
    c.setFillColor(colors.white)
    c.setStrokeColor(border)
    c.roundRect(qr_x - 7, qr_y - 5, 99, 98, 10, fill=1, stroke=1)
    c.drawImage(ImageReader(qr), qr_x, qr_y, width=85, height=85, mask="auto")
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawCentredString(qr_x + 42.5, qr_y - 15, "SCAN TO VERIFY")

    # Signature lines make this suitable for physical issue packs.
    sig_y = 62
    c.setStrokeColor(colors.HexColor("#9AA8BA"))
    c.line(width / 2 - 230, sig_y, width / 2 - 70, sig_y)
    c.line(width / 2 - 45, sig_y, width / 2 + 115, sig_y)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(width / 2 - 150, sig_y - 12, "TRAINER / FACULTY")
    c.drawCentredString(width / 2 + 35, sig_y - 12, "AUTHORIZED SIGNATORY")
    c.setFillColor(muted)
    c.setFont("Helvetica", 6.7)
    c.drawCentredString(width / 2 - 150, sig_y - 23, "Pixiu Tech Learning Programme")
    c.drawCentredString(width / 2 + 35, sig_y - 23, "PIXIU TECH LLP")

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawString(55, 34, "PIXIU TECH LLP")
    c.setFillColor(muted)
    c.setFont("Helvetica", 6.7)
    c.drawString(113, 34, "School Technology Infrastructure  •  Experiential Learning")
    c.drawRightString(width - 55, 34, "Digitally verifiable certificate")

    c.save()
    buf.seek(0)
    response = HttpResponse(buf.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{certificate.certificate_id}.pdf"'
    return response
