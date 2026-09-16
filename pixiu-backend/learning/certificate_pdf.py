from io import BytesIO

import qrcode
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


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
        verification_url = f'https://pixiutech.com/verify?cert={certificate.certificate_id}'

    qr_buffer = BytesIO()
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=3)
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr.make_image(fill_color='#0A1A33', back_color='white').save(qr_buffer, format='PNG')
    qr_buffer.seek(0)

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    navy = colors.HexColor('#0A1A33')
    blue = colors.HexColor('#1768FF')
    gold = colors.HexColor('#C9A227')
    muted = colors.HexColor('#64748B')
    border = colors.HexColor('#D8E0EC')

    # Double certificate border / letterhead.
    c.setStrokeColor(navy)
    c.setLineWidth(2)
    c.rect(28, 28, width - 56, height - 56)
    c.setStrokeColor(gold)
    c.setLineWidth(0.8)
    c.rect(38, 38, width - 76, height - 76)

    # Pixiu Tech letterhead mark. Kept vector-only so the PDF is self-contained.
    c.setFillColor(navy)
    c.roundRect(52, height - 112, 54, 54, 10, fill=1, stroke=0)
    c.setStrokeColor(blue)
    c.setLineWidth(3)
    c.line(69, height - 72, 69, height - 98)
    c.line(69, height - 72, 82, height - 72)
    c.line(69, height - 85, 79, height - 85)
    c.setFillColor(gold)
    c.circle(91, height - 96, 4, fill=1, stroke=0)

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 22)
    c.drawString(118, height - 79, 'PIXIU TECH')
    c.setFont('Helvetica', 9)
    c.setFillColor(muted)
    c.drawString(119, height - 94, 'SCHOOL TECHNOLOGY INFRASTRUCTURE • EXPERIENTIAL LEARNING')
    c.setStrokeColor(blue)
    c.setLineWidth(2)
    c.line(52, height - 126, width - 52, height - 126)

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 24)
    c.drawCentredString(width / 2, height - 185, 'CERTIFICATE OF COMPLETION')
    c.setFont('Helvetica', 10)
    c.setFillColor(muted)
    c.drawCentredString(width / 2, height - 203, 'Pixiu Technology Programme')

    student_name = str(payload.get('student_name') or certificate.student.name or '').strip()
    school_name = str(payload.get('school_name') or certificate.school_class.school.name or '').strip()
    class_name = str(payload.get('class_name') or certificate.school_class.display_name or '').strip()
    score = float(certificate.overall_score)
    issued_date = certificate.issued_at.strftime('%d %B %Y')

    c.setFillColor(muted)
    c.setFont('Helvetica', 10)
    c.drawCentredString(width / 2, height - 242, 'This certifies that')
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 27)
    c.drawCentredString(width / 2, height - 282, student_name.upper())
    c.setStrokeColor(gold)
    c.setLineWidth(1.4)
    c.line(150, height - 292, width - 150, height - 292)

    c.setFillColor(muted)
    c.setFont('Helvetica', 10)
    c.drawCentredString(width / 2, height - 322, 'has successfully completed the taught technology programme at')
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 16)
    c.drawCentredString(width / 2, height - 347, school_name)
    c.setFont('Helvetica', 10)
    c.setFillColor(muted)
    c.drawCentredString(width / 2, height - 365, f'Class {class_name} • Overall Score {score:.2f}%')

    c.setFillColor(colors.HexColor('#F7F9FC'))
    c.roundRect(70, height - 464, width - 140, 74, 14, fill=1, stroke=0)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(86, height - 416, 'TECHNOLOGIES COMPLETED')
    c.setFont('Helvetica', 11)
    c.setFillColor(muted)
    tech_line = '  •  '.join(technology_names) if technology_names else 'Technology programme'
    c.drawString(86, height - 438, tech_line[:95])

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(70, height - 505, 'CERTIFICATE ID')
    c.setFont('Helvetica', 10)
    c.setFillColor(muted)
    c.drawString(70, height - 522, certificate.certificate_id)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(70, height - 550, 'ISSUED')
    c.setFont('Helvetica', 10)
    c.setFillColor(muted)
    c.drawString(70, height - 567, issued_date)

    c.setFillColor(colors.white)
    c.setStrokeColor(border)
    c.setLineWidth(1)
    c.roundRect(width - 186, 72, 112, 112, 12, fill=1, stroke=1)
    c.drawImage(ImageReader(qr_buffer), width - 178, 80, width=96, height=96, preserveAspectRatio=True, mask='auto')

    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(70, 152, 'VERIFY ONLINE')
    c.setFont('Helvetica', 8)
    c.setFillColor(muted)
    c.drawString(70, 137, 'Scan the QR code or use the')
    c.drawString(70, 125, 'certificate verification page.')
    c.setFillColor(blue)
    c.setFont('Helvetica', 7)
    # Keep a compact visible verification reference without relying on clickable PDF links.
    c.drawString(70, 110, certificate.certificate_id[:60])

    c.setStrokeColor(border)
    c.setLineWidth(1)
    c.line(70, 88, width - 200, 88)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(70, 73, 'PIXIU TECH LLP')
    c.setFillColor(muted)
    c.setFont('Helvetica', 8)
    c.drawRightString(width - 200, 73, 'Digitally verifiable certificate')

    c.save()
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{certificate.certificate_id}.pdf"'
    return response
