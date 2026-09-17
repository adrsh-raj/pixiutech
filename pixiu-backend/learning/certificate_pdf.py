from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import qrcode
from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


def _fit_text(c, text, max_width, font='Helvetica-Bold', max_size=11, min_size=7.5):
    value = str(text or '').strip()
    size = max_size
    while size > min_size and stringWidth(value, font, size) > max_width:
        size -= 0.25
    return value, size


def _logo_path():
    base = Path(settings.BASE_DIR)
    candidates = [
        base / 'core' / 'assets' / 'pixiu-logo.png',
        base / 'core' / 'assets' / 'logo.png',
    ]
    return next((path for path in candidates if path.exists()), None)


def _draw_logo(c, x, y, width, height):
    logo = _logo_path()
    if logo:
        c.drawImage(ImageReader(str(logo)), x, y, width=width, height=height, preserveAspectRatio=True, mask='auto')
        return

    # Vector fallback if the packaged logo asset is unavailable.
    navy = colors.HexColor('#081B36')
    blue = colors.HexColor('#1768FF')
    gold = colors.HexColor('#C8A04B')
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 20)
    c.drawString(x, y + 25, 'PIXIU')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(x + 53, y + 9, 'TECH')
    c.setStrokeColor(blue)
    c.setLineWidth(3)
    c.line(x + 37, y + 31, x + 53, y + 48)
    c.setFillColor(gold)
    c.circle(x + 42, y + 39, 3, fill=1, stroke=0)


def build_certificate_pdf(certificate):
    payload = dict(certificate.snapshot or {})
    technologies = certificate.technologies_snapshot or payload.get('technologies') or []
    technology_names = []
    for item in technologies:
        if isinstance(item, dict):
            name = str(item.get('name') or item.get('technology') or '').strip()
        else:
            name = str(item).strip()
        if name and name not in technology_names:
            technology_names.append(name)

    verification_url = str(payload.get('verification_url') or '').strip()
    if not verification_url:
        verification_url = f'https://pixiutech.com/verify?cert={quote(certificate.certificate_id)}'

    qr_buffer = BytesIO()
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=7,
        border=2,
    )
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr.make_image(fill_color='#081B36', back_color='white').save(qr_buffer, format='PNG')
    qr_buffer.seek(0)

    buffer = BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=(width, height))
    c.setTitle(f'Pixiu Tech Certificate - {certificate.student.name}')
    c.setAuthor('Pixiu Tech LLP')

    navy = colors.HexColor('#081B36')
    blue = colors.HexColor('#1768FF')
    gold = colors.HexColor('#C8A04B')
    ink = colors.HexColor('#142235')
    muted = colors.HexColor('#64748B')
    border = colors.HexColor('#D8E0EA')
    soft = colors.HexColor('#F5F8FC')
    white = colors.white

    c.setFillColor(white)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Formal double frame.
    c.setStrokeColor(navy)
    c.setLineWidth(4)
    c.rect(22, 22, width - 44, height - 44)
    c.setStrokeColor(gold)
    c.setLineWidth(1.2)
    c.rect(34, 34, width - 68, height - 68)

    # Minimal corner ornaments.
    for x, y, sx, sy in [(48, height - 62, 1, -1), (width - 48, height - 62, -1, -1), (48, 62, 1, 1), (width - 48, 62, -1, 1)]:
        c.setStrokeColor(gold)
        c.setLineWidth(1.2)
        c.line(x, y, x + 26 * sx, y)
        c.line(x, y, x, y + 26 * sy)
        c.setStrokeColor(blue)
        c.setLineWidth(0.7)
        c.line(x + 5 * sx, y - 5 * sy, x + 20 * sx, y - 5 * sy)
        c.line(x + 5 * sx, y - 5 * sy, x + 5 * sx, y + 20 * sy)

    # Brand header.
    _draw_logo(c, 52, height - 100, 126, 59)
    pill_x, pill_y, pill_w, pill_h = width - 232, height - 91, 160, 28
    c.setFillColor(soft)
    c.setStrokeColor(border)
    c.setLineWidth(0.8)
    c.roundRect(pill_x, pill_y, pill_w, pill_h, 14, fill=1, stroke=1)
    c.setFillColor(blue)
    c.circle(pill_x + 17, pill_y + 14, 5, fill=1, stroke=0)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 8.4)
    c.drawString(pill_x + 29, pill_y + 11, 'DIGITALLY VERIFIABLE')

    c.setStrokeColor(border)
    c.setLineWidth(1)
    c.line(52, height - 114, width - 52, height - 114)

    # Main title.
    c.setFillColor(navy)
    c.setFont('Times-Bold', 31)
    c.drawCentredString(width / 2, height - 166, 'CERTIFICATE OF COMPLETION')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 9.5)
    c.drawCentredString(width / 2, height - 187, str(certificate.programme_name or 'Pixiu Technology Programme').upper())

    # Recipient block.
    student_name = str(payload.get('student_name') or certificate.student.name or '').strip().upper()
    school_name = str(payload.get('school_name') or certificate.school_class.school.name or '').strip()
    class_name = str(payload.get('class_name') or certificate.school_class.display_name or '').strip()
    score = float(certificate.overall_score or 0)

    c.setFillColor(muted)
    c.setFont('Helvetica', 10.5)
    c.drawCentredString(width / 2, height - 222, 'This certifies that')
    c.setFillColor(navy)
    name_text, name_size = _fit_text(c, student_name, 420, 'Times-Bold', 30, 20)
    c.setFont('Times-Bold', name_size)
    c.drawCentredString(width / 2, height - 263, name_text)
    c.setStrokeColor(gold)
    c.setLineWidth(1.3)
    c.line(width / 2 - 170, height - 274, width / 2 + 170, height - 274)

    c.setFillColor(muted)
    c.setFont('Helvetica', 10.5)
    c.drawCentredString(width / 2, height - 302, 'has successfully completed the taught technology programme at')
    school_text, school_size = _fit_text(c, school_name, 430, 'Helvetica-Bold', 16, 11)
    c.setFillColor(ink)
    c.setFont('Helvetica-Bold', school_size)
    c.drawCentredString(width / 2, height - 326, school_text)
    c.setFillColor(muted)
    c.setFont('Helvetica', 9.5)
    c.drawCentredString(width / 2, height - 345, f'Class {class_name}  •  Overall Score {score:.2f}%')

    # Information cards.
    cards_y = 132
    card_h = 64
    left = 68
    right = width - 68
    usable = right - left
    widths = [0.23, 0.23, 0.15, 0.19, 0.20]
    values = [
        ('PROGRAMME', str(certificate.programme_name or 'Pixiu Technology Programme')),
        ('INSTITUTION', school_name),
        ('CLASS', f'Class {class_name}'),
        ('TECHNOLOGY', ' · '.join(technology_names) if technology_names else 'Technology programme'),
        ('OVERALL SCORE', f'{score:.2f}%'),
    ]
    cursor = left
    for index, frac in enumerate(widths):
        card_w = usable * frac
        x0 = cursor + 4
        x1 = cursor + card_w - 4
        if index == 4:
            c.setFillColor(navy)
            c.setStrokeColor(navy)
        else:
            c.setFillColor(soft)
            c.setStrokeColor(border)
        c.setLineWidth(0.8)
        c.roundRect(x0, cards_y, x1 - x0, card_h, 10, fill=1, stroke=1)

        label, value = values[index]
        c.setFillColor(colors.HexColor('#9FC0FF') if index == 4 else muted)
        c.setFont('Helvetica-Bold', 7.5)
        c.drawString(x0 + 13, cards_y + 47, label)

        if index == 4:
            c.setFillColor(white)
            c.setFont('Times-Bold', 19)
            c.drawString(x0 + 13, cards_y + 22, value)
        else:
            c.setFillColor(navy)
            fitted, fs = _fit_text(c, value, x1 - x0 - 26, 'Helvetica-Bold', 10.2, 8)
            if ' · ' in fitted and stringWidth(fitted, 'Helvetica-Bold', fs) > x1 - x0 - 26:
                parts = fitted.split(' · ')
                c.setFont('Helvetica-Bold', fs)
                c.drawString(x0 + 13, cards_y + 28, parts[0][:24])
                if len(parts) > 1:
                    c.drawString(x0 + 13, cards_y + 15, ' · '.join(parts[1:])[:24])
            else:
                c.setFont('Helvetica-Bold', fs)
                c.drawString(x0 + 13, cards_y + 22, fitted)
        cursor += card_w

    # Verification/metadata footer.
    bottom_y = 40
    c.setStrokeColor(border)
    c.setLineWidth(0.8)
    c.line(68, bottom_y + 30, width - 68, bottom_y + 30)

    seal_x, seal_y = 98, bottom_y + 46
    c.setStrokeColor(gold)
    c.setLineWidth(1.4)
    c.circle(seal_x, seal_y, 29, fill=0, stroke=1)
    c.circle(seal_x, seal_y, 23, fill=0, stroke=1)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 6.4)
    c.drawCentredString(seal_x, seal_y + 5, 'PIXIU TECH')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 5.3)
    c.drawCentredString(seal_x, seal_y - 5, 'AUTHENTIC')

    mx = 150
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(mx, bottom_y + 50, 'CERTIFICATE ID')
    c.setFillColor(muted)
    id_text, id_size = _fit_text(c, certificate.certificate_id, 300, 'Helvetica', 8.7, 7)
    c.setFont('Helvetica', id_size)
    c.drawString(mx, bottom_y + 37, id_text)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(mx, bottom_y + 20, 'ISSUED')
    c.setFillColor(muted)
    c.setFont('Helvetica', 8.7)
    c.drawString(mx, bottom_y + 7, certificate.issued_at.strftime('%d %B %Y'))

    qr_box_x = width - 150
    qr_box_y = 39
    c.setFillColor(white)
    c.setStrokeColor(border)
    c.setLineWidth(0.9)
    c.roundRect(qr_box_x, qr_box_y, 103, 86, 11, fill=1, stroke=1)
    c.drawImage(ImageReader(qr_buffer), qr_box_x + 14, qr_box_y + 5, width=75, height=75, preserveAspectRatio=True, mask='auto')

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 7.2)
    c.drawString(width - 300, bottom_y + 47, 'VERIFY ONLINE')
    c.setFillColor(muted)
    c.setFont('Helvetica', 7.5)
    c.drawString(width - 300, bottom_y + 34, 'Scan the QR code to open the')
    c.drawString(width - 300, bottom_y + 22, 'official Pixiu Tech verification record.')

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 7.7)
    c.drawString(68, 25, 'PIXIU TECH LLP')
    c.setFillColor(muted)
    c.setFont('Helvetica', 7.2)
    c.drawString(143, 25, 'School Technology Infrastructure • Experiential Learning')
    c.drawRightString(width - 68, 25, 'Digitally verifiable certificate')

    c.save()
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{certificate.certificate_id}.pdf"'
    return response
