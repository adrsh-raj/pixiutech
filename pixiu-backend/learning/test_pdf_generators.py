from types import SimpleNamespace

from django.test import SimpleTestCase
from django.utils import timezone
from reportlab.lib.pagesizes import A4, landscape

from .certificate_pdf import CERTIFICATE_SIZE, build_certificate_pdf
from .scorecard_pdf import build_scorecard_pdf


class PdfGeneratorTests(SimpleTestCase):
    def setUp(self):
        school = SimpleNamespace(name='XYZ Academy', school_code='XYZ')
        school_class = SimpleNamespace(display_name='6A', school=school)
        student = SimpleNamespace(name='AKASH K', student_id='XYZ6A 01')
        self.certificate = SimpleNamespace(
            certificate_id='PX-XYZ-XYZ6A 01-2026-54D0DD',
            certificate_ref='PX-XYZ-XYZ6A 01-2026-54D0DD',
            student=student,
            school_class=school_class,
            programme_name='Pixiu Technology Programme',
            technologies_snapshot=[{'name': 'Robotics'}],
            units_snapshot=[{'technology': 'Robotics', 'unit_code': 'R1', 'title': 'Sensors'}],
            overall_score=79.72,
            issued_at=timezone.now(),
            snapshot={
                'student_name': 'AKASH K',
                'school_name': 'XYZ Academy',
                'class_name': '6A',
                'verification_url': 'https://pixiutech.com/verify?cert=PX-XYZ-XYZ6A%2001-2026-54D0DD',
            },
        )

    def test_certificate_is_a4_landscape(self):
        self.assertEqual(CERTIFICATE_SIZE, landscape(A4))
        response = build_certificate_pdf(self.certificate)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_scorecard_generates_a4_pdf(self):
        scorecard = {
            'class_size': 35,
            'class_rank': 1,
            'rank_display': '1/35',
            'attendance_pct': 92.0,
            'quiz_pct': 88.0,
            'practical_pct': 84.0,
            'trainer_review_pct': 90.0,
            'top10_ranking': [
                {'rank': i, 'rank_display': f'{i}/35', 'student_id': f'S{i:02d}', 'student_name': f'Student {i}', 'overall_score': 95 - i}
                for i in range(1, 11)
            ],
        }
        response = build_scorecard_pdf(self.certificate, scorecard)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))
