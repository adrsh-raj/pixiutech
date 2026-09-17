from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import qrcode
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

CERTIFICATE_SIZE = landscape(A4)

NAVY = colors.HexColor('#071A33')
BLUE = colors.HexColor('#1768FF')
GOLD = colors.HexColor('#C8A04B')
INK = colors.HexColor('#17263B')
MUTED = colors.HexColor('#64748B')
LINE = colors.HexColor('#D9E2EE')
SOFT = colors.HexColor('#F5F8FC')
WHITE = colors.white
GREEN = colors.HexColor('#087443')


def _logo_path():
    base = Path(settings.BASE_DIR)
    candidates = [
        base / 'core' / 'assets' / 'pixiu-logo.png',
        base / 'core' / 'assets' / 'logo.png',
    ]
    return next((path for path in candidates if path.exists()), None)


def _fit_text(c, value, max_width, font='Helvetica-Bold', max_size=12, min_size=7):
    text = str(value or '').strip()
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
            anchor='sw',
            mask='auto',
        )
        return
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 22)
    c.drawString(x, y + 10 * mm, 'PIXIU')
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(x + 37 * mm, y + 4 * mm, 'TECH')
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
    qr.make_image(fill_color='#071A33', back_color='white').save(buf, format='PNG')
    buf.seek(0)
    return buf


def build_certificate_pdf(certificate):
    payload = dict(certificate.snapshot or {})
    technologies = certificate.technologies_snapshot or payload.get('technologies') or []
    names = []
    for item in technologies:
        value = item.get('name') or item.get('technology') if isinstance(item, dict) else item
        value = str(value or '').strip()
        if value and value not in names:
            names.append(value)

    student_name = str(payload.get('student_name') or certificate.student.name or '').strip().upper()
    school_name = str(payload.get('school_name') or certificate.school_class.school.name or '').strip()
    class_name = str(payload.get('class_name') or certificate.school_class.display_name or '').strip()
    programme = str(certificate.programme_name or 'Pixiu Technology Programme').strip()
    score = float(certificate.overall_score or 0)
    issued_at = certificate.issued_at or timezone.now()
    verification_url = str(
        payload.get('verification_url')
        or f'https://pixiutech.com/verify?cert={quote(certificate.certificate_id)}'
    )

    width, height = CERTIFICATE_SIZE
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=CERTIFICATE_SIZE)
    c.setTitle(f'Pixiu Tech Certificate - {certificate.student.name}')
    c.setAuthor('Pixiu Tech LLP')

    # Paper background and refined border.
    c.setFillColor(WHITE)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(NAVY)
    c.setLineWidth(2.2)
    c.rect(13 * mm, 13 * mm, width - 26 * mm, height - 26 * mm)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.rect(17 * mm, 17 * mm, width - 34 * mm, height - 34 * mm)

    # Subtle navy header and a thin blue accent.
    c.setFillColor(NAVY)
    c.rect(19 * mm, height - 48 * mm, width - 38 * mm, 24 * mm, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(19 * mm, height - 26 * mm, width - 38 * mm, 2.3 * mm, fill=1, stroke=0)

    _draw_logo(c, 28 * mm, height - 44 * mm, 44 * mm, 17 * mm)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 8)
    c.drawRightString(width - 30 * mm, height - 34 * mm, 'PIXIU TECH LLP')
    c.setFillColor(colors.HexColor('#BFD0E6'))
    c.setFont('Helvetica', 6.8)
    c.drawRightString(width - 30 * mm, height - 41 * mm, 'School Technology Infrastructure  |  Experiential Learning')

    # Credential title.
    c.setFillColor(NAVY)
    c.setFont('Times-Bold', 27)
    c.drawCentredString(width / 2, height - 70 * mm, 'CERTIFICATE OF COMPLETION')
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 8.4)
    c.drawCentredString(width / 2, height - 78 * mm, programme.upper())

    # Recipient statement.
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 9.5)
    c.drawCentredString(width / 2, height - 94 * mm, 'This certificate is proudly presented to')
    fitted_name, name_size = _fit_text(c, student_name, 165 * mm, 'Times-Bold', 28, 19)
    c.setFillColor(NAVY)
    c.setFont('Times-Bold', name_size)
    c.drawCentredString(width / 2, height - 108 * mm, fitted_name)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.15)
    c.line(width / 2 - 49 * mm, height - 112 * mm, width / 2 + 49 * mm, height - 112 * mm)

    c.setFillColor(MUTED)
    c.setFont('Helvetica', 9.5)
    c.drawCentredString(
        width / 2,
        height - 124 * mm,
        'for successfully completing the prescribed practical and experiential learning programme in',
    )

    tech_text = '  |  '.join(names) if names else 'Technology Programme'
    fitted_tech, tech_size = _fit_text(c, tech_text.upper(), 150 * mm, 'Helvetica-Bold', 15, 10)
    c.setFillColor(INK)
    c.setFont('Helvetica-Bold', tech_size)
    c.drawCentredString(width / 2, height - 136 * mm, fitted_tech)

    meta = f'{school_name}  |  Class {class_name}  |  Overall Programme Score {score:.2f}%'
    fitted_meta, meta_size = _fit_text(c, meta, 185 * mm, 'Helvetica', 9.4, 7.5)
    c.setFillColor(MUTED)
    c.setFont('Helvetica', meta_size)
    c.drawCentredString(width / 2, height - 147 * mm, fitted_meta)

    # Lower information band.
    band_y = 57 * mm
    band_h = 36 * mm
    c.setFillColor(SOFT)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.9)
    c.roundRect(27 * mm, band_y, width - 54 * mm, band_h, 4 * mm, fill=1, stroke=1)

    # Score card.
    score_x = 34 * mm
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 7.1)
    c.drawString(score_x, band_y + 26 * mm, 'OFFICIAL PROGRAMME SCORE')
    c.setFillColor(BLUE)
    c.setFont('Times-Bold', 21)
    c.drawString(score_x, band_y + 10 * mm, f'{score:.2f}%')
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 6.9)
    c.drawString(score_x + 31 * mm, band_y + 17 * mm, 'Recorded in the')
    c.drawString(score_x + 31 * mm, band_y + 9 * mm, 'Pixiu Tech LMS')

    # Authenticity seal.
    seal_x, seal_y = width / 2, band_y + 18 * mm
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.1)
    c.circle(seal_x, seal_y, 14 * mm, fill=0, stroke=1)
    c.circle(seal_x, seal_y, 11 * mm, fill=0, stroke=1)
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 6.2)
    c.drawCentredString(seal_x, seal_y + 1.7 * mm, 'PIXIU TECH')
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 5.3)
    c.drawCentredString(seal_x, seal_y - 3.6 * mm, 'AUTHENTIC')

    # Verification block.
    qr = _qr_buffer(verification_url)
    qr_box_x = width - 61 * mm
    qr_box_y = 30 * mm
    c.setFillColor(WHITE)
    c.setStrokeColor(LINE)
    c.roundRect(qr_box_x, qr_box_y, 38 * mm, 38 * mm, 3 * mm, fill=1, stroke=1)
    c.drawImage(ImageReader(qr), qr_box_x + 3.4 * mm, qr_box_y + 3.4 * mm, width=31 * mm, height=31 * mm, mask='auto')
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 6.8)
    c.drawCentredString(qr_box_x + 19 * mm, qr_box_y - 4 * mm, 'SCAN TO VERIFY')

    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 7.1)
    c.drawString(width - 111 * mm, band_y + 26 * mm, 'CERTIFICATE ID')
    cert_id, cert_size = _fit_text(c, certificate.certificate_id, 47 * mm, 'Helvetica', 7.8, 6)
    c.setFillColor(MUTED)
    c.setFont('Helvetica', cert_size)
    c.drawString(width - 111 * mm, band_y + 20 * mm, cert_id)
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 7.1)
    c.drawString(width - 111 * mm, band_y + 12 * mm, 'ISSUED')
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 7.8)
    c.drawString(width - 111 * mm, band_y + 6 * mm, issued_at.strftime('%d %B %Y'))

    # Footer signature area.
    footer_y = 25 * mm
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(30 * mm, footer_y + 6 * mm, 83 * mm, footer_y + 6 * mm)
    c.line(width - 83 * mm, footer_y + 6 * mm, width - 30 * mm, footer_y + 6 * mm)
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 6.7)
    c.drawCentredString(56.5 * mm, footer_y + 2 * mm, 'TRAINER / FACULTY')
    c.drawCentredString(width - 56.5 * mm, footer_y + 2 * mm, 'AUTHORIZED SIGNATORY')

    c.setFillColor(MUTED)
    c.setFont('Helvetica', 6.5)
    c.drawString(30 * mm, 12.5 * mm, 'Digitally verifiable credential  |  Pixiu Tech Central Registry')
    c.drawRightString(width - 30 * mm, 12.5 * mm, 'PIXIU TECH LLP')

    c.save()
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{certificate.certificate_id}.pdf"'
    return response
