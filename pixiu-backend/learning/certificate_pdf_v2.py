from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import qrcode
from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


CERTIFICATE_SIZE = (11 * inch, 8.5 * inch)


def _logo_path():
    base = Path(settings.BASE_DIR)
    candidates = [base / 'core' / 'assets' / 'pixiu-logo.png', base / 'core' / 'assets' / 'logo.png']
    return next((path for path in candidates if path.exists()), None)


def _fit_text(c, text, max_width, font='Helvetica-Bold', max_size=11, min_size=7.5):
    value = str(text or '').strip()
    size = max_size
    while size > min_size and stringWidth(value, font, size) > max_width:
        size -= 0.25
    return value, size


def _draw_logo(c, x, y, width=1.55 * inch, height=0.72 * inch):
    logo = _logo_path()
    if logo:
        c.drawImage(ImageReader(str(logo)), x, y, width=width, height=height, preserveAspectRatio=True, mask='auto')
        return
    navy = colors.HexColor('#081B36')
    blue = colors.HexColor('#1768FF')
    gold = colors.HexColor('#C8A04B')
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 25)
    c.drawString(x, y + 25, 'PIXIU')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(x + 66, y + 10, 'TECH')
    c.setStrokeColor(blue)
    c.setLineWidth(3)
    c.line(x + 44, y + 32, x + 65, y + 53)
    c.setFillColor(gold)
    c.circle(x + 50, y + 39, 3.2, fill=1, stroke=0)


def _qr_buffer(url):
    qr_buffer = BytesIO()
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=7, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr.make_image(fill_color='#081B36', back_color='white').save(qr_buffer, format='PNG')
    qr_buffer.seek(0)
    return qr_buffer


def build_certificate_pdf(certificate):
    payload = dict(certificate.snapshot or {})
    technologies = certificate.technologies_snapshot or payload.get('technologies') or []
    technology_names = []
    for item in technologies:
        value = item.get('name') or item.get('technology') if isinstance(item, dict) else item
        value = str(value or '').strip()
        if value and value not in technology_names:
            technology_names.append(value)

    verification_url = str(payload.get('verification_url') or f'https://pixiutech.com/verify?cert={quote(certificate.certificate_id)}')
    width, height = CERTIFICATE_SIZE
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=CERTIFICATE_SIZE)
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

    # Certificate-size formal frame.
    c.setStrokeColor(navy)
    c.setLineWidth(3.2)
    c.rect(18, 18, width - 36, height - 36)
    c.setStrokeColor(gold)
    c.setLineWidth(1.1)
    c.rect(29, 29, width - 58, height - 58)

    # Header.
    _draw_logo(c, 52, height - 82, 125, 58)
    c.setFillColor(soft)
    c.setStrokeColor(border)
    c.roundRect(width - 220, height - 74, 160, 27, 14, fill=1, stroke=1)
    c.setFillColor(blue)
    c.circle(width - 203, height - 60.5, 4.5, fill=1, stroke=0)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(width - 192, height - 64, 'OFFICIAL DIGITAL CREDENTIAL')
    c.setStrokeColor(border)
    c.setLineWidth(1)
    c.line(52, height - 99, width - 52, height - 99)

    # Main title.
    c.setFillColor(navy)
    c.setFont('Times-Bold', 28)
    c.drawCentredString(width / 2, height - 145, 'CERTIFICATE OF COMPLETION')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 9)
    c.drawCentredString(width / 2, height - 164, str(certificate.programme_name or 'Pixiu Technology Programme').upper())

    student_name = str(payload.get('student_name') or certificate.student.name or '').strip().upper()
    school_name = str(payload.get('school_name') or certificate.school_class.school.name or '').strip()
    class_name = str(payload.get('class_name') or certificate.school_class.display_name or '').strip()
    score = float(certificate.overall_score or 0)

    c.setFillColor(muted)
    c.setFont('Helvetica', 10)
    c.drawCentredString(width / 2, height - 196, 'This certificate is proudly presented to')
    fitted_name, name_size = _fit_text(c, student_name, 480, 'Times-Bold', 28, 20)
    c.setFillColor(navy)
    c.setFont('Times-Bold', name_size)
    c.drawCentredString(width / 2, height - 236, fitted_name)
    c.setStrokeColor(gold)
    c.setLineWidth(1.3)
    c.line(width / 2 - 175, height - 248, width / 2 + 175, height - 248)

    c.setFillColor(muted)
    c.setFont('Helvetica', 10)
    c.drawCentredString(width / 2, height - 276, 'for successfully completing the prescribed practical and experiential learning programme in')
    tech_text = '  •  '.join(technology_names) if technology_names else 'Technology Programme'
    fitted_tech, tech_size = _fit_text(c, tech_text.upper(), 430, 'Helvetica-Bold', 17, 11)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', tech_size)
    c.drawCentredString(width / 2, height - 301, fitted_tech)
    c.setFillColor(muted)
    c.setFont('Helvetica', 9.5)
    c.drawCentredString(width / 2, height - 320, f'{school_name}  |  Class {class_name}  |  Overall Programme Score {score:.2f}%')

    # Score + authenticity area.
    score_box_x, score_box_y = 70, height - 408
    c.setFillColor(soft)
    c.setStrokeColor(border)
    c.roundRect(score_box_x, score_box_y, 260, 62, 12, fill=1, stroke=1)
    c.setFillColor(muted)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(score_box_x + 18, score_box_y + 43, 'PROGRAMME SCORE')
    c.setFillColor(navy)
    c.setFont('Times-Bold', 25)
    c.drawString(score_box_x + 18, score_box_y + 15, f'{score:.2f}%')
    c.setFillColor(muted)
    c.setFont('Helvetica', 8)
    c.drawString(score_box_x + 122, score_box_y + 28, 'Official programme')
    c.drawString(score_box_x + 122, score_box_y + 17, 'score recorded in LMS')
    c.setFillColor(blue)
    c.roundRect(score_box_x, score_box_y - 5, 260, 5, 2.5, fill=1, stroke=0)

    seal_x, seal_y = width / 2 + 15, score_box_y + 32
    c.setStrokeColor(gold)
    c.setLineWidth(1.4)
    c.circle(seal_x, seal_y, 28, fill=0, stroke=1)
    c.circle(seal_x, seal_y, 22, fill=0, stroke=1)
    c.setFillColor(gold)
    c.setFont('Helvetica-Bold', 6.2)
    c.drawCentredString(seal_x, seal_y + 5, 'PIXIU TECH')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 5.2)
    c.drawCentredString(seal_x, seal_y - 5, 'AUTHENTIC')

    # Metadata footer.
    left = 70
    base_y = 72
    c.setStrokeColor(border)
    c.setLineWidth(0.9)
    c.line(left, base_y + 54, width - 190, base_y + 54)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(left, base_y + 37, 'CERTIFICATE ID')
    c.setFillColor(muted)
    cid, cid_size = _fit_text(c, certificate.certificate_id, 330, 'Helvetica', 9, 7)
    c.setFont('Helvetica', cid_size)
    c.drawString(left, base_y + 24, cid)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(left, base_y + 8, 'ISSUED')
    c.setFillColor(muted)
    c.setFont('Helvetica', 9)
    c.drawString(left, base_y - 5, certificate.issued_at.strftime('%d %B %Y'))

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(width - 300, base_y + 37, 'VERIFY ONLINE')
    c.setFillColor(muted)
    c.setFont('Helvetica', 7.4)
    c.drawString(width - 300, base_y + 24, 'Scan the QR code to verify this credential')
    c.drawString(width - 300, base_y + 13, 'against the Pixiu Tech Central Registry.')

    qr_buf = _qr_buffer(verification_url)
    qr_x, qr_y = width - 145, 54
    c.setFillColor(white)
    c.setStrokeColor(border)
    c.setLineWidth(0.9)
    c.roundRect(qr_x - 8, qr_y - 6, 102, 102, 11, fill=1, stroke=1)
    c.drawImage(ImageReader(qr_buf), qr_x, qr_y, width=86, height=86, preserveAspectRatio=True, mask='auto')
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 7)
    c.drawCentredString(qr_x + 43, qr_y - 16, 'SCAN TO VERIFY')

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 7.8)
    c.drawString(52, 37, 'PIXIU TECH LLP')
    c.setFillColor(muted)
    c.setFont('Helvetica', 7)
    c.drawString(118, 37, 'School Technology Infrastructure  •  Experiential Learning')
    c.drawRightString(width - 52, 37, 'Digitally verifiable certificate')

    c.save()
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{certificate.certificate_id}.pdf"'
    return response
