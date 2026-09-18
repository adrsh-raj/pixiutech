from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import qrcode
from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


def _logo_path():
    base = Path(settings.BASE_DIR)
    candidates = [base / 'core' / 'assets' / 'pixiu-logo.png', base / 'core' / 'assets' / 'logo.png']
    return next((path for path in candidates if path.exists()), None)


def _fit_text(c, text, max_width, font='Helvetica-Bold', max_size=11, min_size=7):
    value = str(text or '').strip()
    size = max_size
    while size > min_size and stringWidth(value, font, size) > max_width:
        size -= 0.25
    return value, size


def _draw_logo(c, x, y, width=46 * mm, height=18 * mm):
    logo = _logo_path()
    if logo:
        c.drawImage(ImageReader(str(logo)), x, y, width=width, height=height, preserveAspectRatio=True, anchor='sw', mask='auto')
        return
    navy = colors.HexColor('#081B36')
    blue = colors.HexColor('#1768FF')
    gold = colors.HexColor('#C8A04B')
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 21)
    c.drawString(x, y + 11 * mm, 'PIXIU')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(x + 36 * mm, y + 5 * mm, 'TECH')
    c.setStrokeColor(blue)
    c.setLineWidth(2.5)
    c.line(x + 25 * mm, y + 13 * mm, x + 36 * mm, y + 24 * mm)
    c.setFillColor(gold)
    c.circle(x + 29 * mm, y + 16 * mm, 2.2 * mm, fill=1, stroke=0)


def _qr_image(url):
    qr_buffer = BytesIO()
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=7, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr.make_image(fill_color='#081B36', back_color='white').save(qr_buffer, format='PNG')
    qr_buffer.seek(0)
    return qr_buffer


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_scorecard_pdf(certificate, scorecard, include_ranking=True):
    scorecard = dict(scorecard or {})
    student = certificate.student
    school_class = certificate.school_class
    school = school_class.school

    width, height = A4
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f'Pixiu Tech Score Card - {student.name}')
    c.setAuthor('Pixiu Tech LLP')

    navy = colors.HexColor('#081B36')
    blue = colors.HexColor('#1768FF')
    ink = colors.HexColor('#18263A')
    muted = colors.HexColor('#64748B')
    line = colors.HexColor('#DCE4EF')
    soft = colors.HexColor('#F5F8FC')
    white = colors.white
    good = colors.HexColor('#047857')
    fail = colors.HexColor('#B91C1C')

    # Header.
    c.setFillColor(navy)
    c.rect(0, height - 42 * mm, width, 42 * mm, fill=1, stroke=0)
    _draw_logo(c, 18 * mm, height - 34 * mm, width=43 * mm, height=18 * mm)
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 24)
    c.drawRightString(width - 18 * mm, height - 20 * mm, 'STUDENT SCORE CARD')
    c.setFont('Helvetica', 9.5)
    c.drawRightString(width - 18 * mm, height - 28 * mm, 'PIXIU TECHNOLOGY PROGRAMME')
    c.setFillColor(blue)
    c.rect(0, height - 42 * mm, width, 2.2 * mm, fill=1, stroke=0)

    # Student identity.
    box_y = height - 68 * mm
    c.setFillColor(soft)
    c.setStrokeColor(line)
    c.roundRect(18 * mm, box_y, width - 36 * mm, 22 * mm, 5 * mm, fill=1, stroke=1)
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 15)
    c.drawString(26 * mm, box_y + 14 * mm, str(student.name or '').upper())
    c.setFillColor(muted)
    c.setFont('Helvetica', 8.8)
    c.drawString(26 * mm, box_y + 7 * mm, f"{school.name}  |  Class {school_class.display_name}  |  Programme: {certificate.programme_name}")
    c.setFillColor(muted)
    c.setFont('Helvetica-Bold', 7)
    c.drawRightString(width - 26 * mm, box_y + 14 * mm, 'CERTIFICATE ID')
    cert_id, cert_size = _fit_text(c, certificate.certificate_id, 65 * mm, 'Helvetica-Bold', 8.5, 6.5)
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', cert_size)
    c.drawRightString(width - 26 * mm, box_y + 8 * mm, cert_id)

    # KPI row. Public credential packs deliberately omit class-ranking
    # details; the public verification website is the place where the
    # student's top-25% status may be displayed.
    kpi_y = height - 102 * mm
    box_w = (width - 36 * mm - 10 * mm) / 3
    rank_display = str(scorecard.get('rank_display') or '-')
    kpis = [
        ('OVERALL SCORE', f"{_safe_float(certificate.overall_score):.2f}%"),
        ('CLASS SIZE', f"{int(scorecard.get('class_size') or 0)} Students"),
        ('CLASS RANK' if include_ranking else 'CREDENTIAL', rank_display if include_ranking else 'VERIFIED'),
    ]
    for idx, (label, value) in enumerate(kpis):
        x = 18 * mm + idx * (box_w + 5 * mm)
        c.setFillColor(white)
        c.setStrokeColor(line)
        c.roundRect(x, kpi_y, box_w, 24 * mm, 5 * mm, fill=1, stroke=1)
        c.setFillColor(muted)
        c.setFont('Helvetica-Bold', 7.5)
        c.drawString(x + 5 * mm, kpi_y + 17 * mm, label)
        c.setFillColor(navy if idx != 2 else blue)
        c.setFont('Helvetica-Bold', 20 if idx != 2 else 19)
        c.drawString(x + 5 * mm, kpi_y + 7 * mm, value)

    if include_ranking:
        c.setFillColor(muted)
        c.setFont('Helvetica', 7)
        rank_slots = int(scorecard.get('rank_slots') or 0)
        c.drawRightString(width - 18 * mm, kpi_y - 6 * mm, f'Ranking: top 25% of the class, up to {rank_slots} passed students.')

    # Assessment summary.
    summary_top = height - 121 * mm
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 12)
    c.drawString(18 * mm, summary_top, 'ASSESSMENT SUMMARY')
    summary_rows = [
        ('Programme Score', f"{_safe_float(certificate.overall_score):.2f}%", 'Officially recorded overall programme result'),
        ('Attendance', f"{_safe_float(scorecard.get('attendance_pct')):.2f}%", 'Recorded attendance across completed sessions'),
        ('Practical Evaluation', f"{_safe_float(scorecard.get('practical_pct')):.2f}%", 'Published practical assessment records'),
        ('Quiz / Knowledge', f"{_safe_float(scorecard.get('quiz_pct')):.2f}%", 'Completed quiz attempt results'),
        ('Trainer Review', f"{_safe_float(scorecard.get('trainer_review_pct')):.2f}%", 'Published trainer review records'),
    ]
    row_y = summary_top - 8 * mm
    row_h = 10.5 * mm
    for idx, (label, value, desc) in enumerate(summary_rows):
        y = row_y - idx * (row_h + 1.2 * mm)
        c.setFillColor(soft if idx % 2 == 0 else white)
        c.setStrokeColor(line)
        c.roundRect(18 * mm, y - row_h + 2 * mm, width - 36 * mm, row_h, 2.5 * mm, fill=1, stroke=1)
        c.setFillColor(navy)
        c.setFont('Helvetica-Bold', 8.3)
        c.drawString(24 * mm, y - 4.2 * mm, label)
        c.setFillColor(blue if idx == 0 else ink)
        c.setFont('Helvetica-Bold', 8.3)
        c.drawString(67 * mm, y - 4.2 * mm, value)
        c.setFillColor(muted)
        c.setFont('Helvetica', 7.5)
        c.drawString(84 * mm, y - 4.2 * mm, desc)

    # Class ranking is intentionally optional. Public certificate PDFs do
    # not expose classmates' names/scores; the public verification page
    # shows only the verified student's top-25% status.
    if include_ranking:
        # Dynamic top-25% ranking. Ranking data is supplied by the server-side
        # cohort evaluator and already contains only students who passed.
        ranking = scorecard.get('top_ranking') or scorecard.get('top25_ranking') or scorecard.get('top10_ranking') or []
        table_top = row_y - len(summary_rows) * (row_h + 1.2 * mm) - 9 * mm
        c.setFillColor(navy)
        c.setFont('Helvetica-Bold', 12)
        c.drawString(18 * mm, table_top, f"TOP {len(ranking)} CLASS RANKING")
        c.setFillColor(muted)
        c.setFont('Helvetica', 7.5)
        c.drawRightString(width - 18 * mm, table_top, f"Top 25% of {int(scorecard.get('class_size') or 0)} students • Passed students only")

        table_y = table_top - 8 * mm
        col_x = [18 * mm, 38 * mm, 66 * mm, 132 * mm, 172 * mm]
        col_w = [20 * mm, 28 * mm, 66 * mm, 40 * mm, width - 18 * mm - 172 * mm]
        headers = ['#', 'RANK', 'STUDENT', 'SCORE', 'RESULT']
        header_h = 8 * mm
        c.setFillColor(navy)
        c.rect(18 * mm, table_y - header_h, width - 36 * mm, header_h, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 7)
        for idx, label in enumerate(headers):
            c.drawCentredString(col_x[idx] + col_w[idx] / 2, table_y - 5.4 * mm, label)

        row_h_rank = 7.2 * mm
        for idx, row in enumerate(ranking):
            y = table_y - header_h - (idx + 1) * row_h_rank
            c.setFillColor(soft if idx % 2 == 0 else white)
            c.setStrokeColor(line)
            c.rect(18 * mm, y, width - 36 * mm, row_h_rank, fill=1, stroke=1)
            values = [
                str(idx + 1),
                str(row.get('rank_display') or f"{idx + 1}/{scorecard.get('class_size') or 0}"),
                str(row.get('student_name') or '—'),
                f"{_safe_float(row.get('overall_score')):.2f}%",
                'PASSED',
            ]
            c.setFillColor(navy)
            c.setFont('Helvetica-Bold', 7)
            c.drawCentredString(col_x[0] + col_w[0] / 2, y + 2.6 * mm, values[0])
            c.setFillColor(blue)
            c.drawCentredString(col_x[1] + col_w[1] / 2, y + 2.6 * mm, values[1])
            c.setFillColor(ink)
            fitted_name, fs = _fit_text(c, values[2], col_w[2] - 7 * mm, 'Helvetica-Bold', 7, 5.8)
            c.setFont('Helvetica-Bold', fs)
            c.drawString(col_x[2] + 3 * mm, y + 2.6 * mm, fitted_name)
            c.setFillColor(navy)
            c.setFont('Helvetica-Bold', 7)
            c.drawCentredString(col_x[3] + col_w[3] / 2, y + 2.6 * mm, values[3])
            c.setFillColor(good)
            c.drawCentredString(col_x[4] + col_w[4] / 2, y + 2.6 * mm, values[4])

        # If there are no passed students, make this explicit rather than showing
        # an empty table that can be mistaken for missing data.
        if not ranking:
            y = table_y - header_h - row_h_rank
            c.setFillColor(soft)
            c.setStrokeColor(line)
            c.rect(18 * mm, y, width - 36 * mm, row_h_rank, fill=1, stroke=1)
            c.setFillColor(muted)
            c.setFont('Helvetica-Bold', 7.2)
            c.drawCentredString(width / 2, y + 2.6 * mm, 'No passed students are available for ranking.')


    # Footer / verification.
    footer_y = 20 * mm
    c.setFillColor(soft)
    c.setStrokeColor(line)
    c.roundRect(18 * mm, footer_y, width - 36 * mm, 18 * mm, 4 * mm, fill=1, stroke=1)
    if include_ranking:
        c.setFillColor(navy)
        c.setFont('Helvetica-Bold', 7.2)
        c.drawString(24 * mm, footer_y + 11.2 * mm, 'RANK DISPLAY RULE')
        c.setFillColor(muted)
        c.setFont('Helvetica', 6.9)
        c.drawString(24 * mm, footer_y + 6 * mm, 'Only passed students in the top 25% are ranked. Rank is shown as 1/35, 2/35, etc.; passed students outside the ranked set show "-".')
    else:
        c.setFillColor(navy)
        c.setFont('Helvetica-Bold', 7.2)
        c.drawString(24 * mm, footer_y + 11.2 * mm, 'CREDENTIAL VERIFICATION')
        c.setFillColor(muted)
        c.setFont('Helvetica', 6.9)
        c.drawString(24 * mm, footer_y + 6 * mm, 'Certificate verification and public ranking information are available at pixiutech.com/verify.')
    c.setFillColor(blue)
    c.setFont('Helvetica-Bold', 7.1)
    c.drawString(24 * mm, footer_y + 2 * mm, 'Verification: pixiutech.com/verify')

    verify_url = str(certificate.snapshot.get('verification_url') or f"https://pixiutech.com/verify?cert={quote(certificate.certificate_id)}")
    qr_buf = _qr_image(verify_url)
    c.setFillColor(white)
    c.setStrokeColor(line)
    c.roundRect(width - 48 * mm, footer_y - 1 * mm, 28 * mm, 26 * mm, 3 * mm, fill=1, stroke=1)
    c.drawImage(ImageReader(qr_buf), width - 46 * mm, footer_y + 1.5 * mm, width=23 * mm, height=23 * mm, mask='auto')

    c.setFillColor(muted)
    c.setFont('Helvetica', 6.8)
    c.drawString(18 * mm, 11 * mm, f"Issued through Pixiu Tech Central Registry  |  {certificate.issued_at.strftime('%d %B %Y')}")
    c.drawRightString(width - 18 * mm, 11 * mm, 'Generated from institutional LMS records')

    c.save()
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{certificate.certificate_id}-scorecard.pdf"'
    return response
