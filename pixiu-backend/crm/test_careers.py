from io import BytesIO
from unittest.mock import patch

from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from pypdf import PdfReader, PdfWriter

from core.clamav_client import ClamAVUnavailableError
from .models import CareerOpening, CareerOpeningStatus, CareerApplication


def valid_pdf_bytes():
    stream = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.write(stream)
    return stream.getvalue()


@override_settings(CLAMAV_ENABLED=False, CLAMAV_REQUIRED=False, CAREER_CV_MAX_BYTES=2 * 1024 * 1024)
class CareerPublicApiTests(APITestCase):
    def test_only_published_openings_are_public(self):
        CareerOpening.objects.create(title='Draft Role', description='Draft', status=CareerOpeningStatus.DRAFT)
        published = CareerOpening.objects.create(title='STEM Instructor', description='Teach STEM', status=CareerOpeningStatus.PUBLISHED)
        response = self.client.get('/api/v1/public/careers/openings')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['id'] for row in response.data], [str(published.id)])

    def test_application_requires_secure_pdf(self):
        opening = CareerOpening.objects.create(title='STEM Instructor', description='Teach STEM', status=CareerOpeningStatus.PUBLISHED)
        bad = SimpleUploadedFile('resume.exe', b'MZ' + b'0' * 100, content_type='application/octet-stream')
        response = self.client.post('/api/v1/public/careers/apply', {'opening': str(opening.id), 'name': 'Test Candidate', 'email': 'test@example.com', 'phone': '9876543210', 'cv': bad}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('cv', response.data)

    def test_application_accepts_valid_pdf(self):
        opening = CareerOpening.objects.create(title='STEM Instructor', description='Teach STEM', status=CareerOpeningStatus.PUBLISHED)
        pdf = SimpleUploadedFile('My Resume.pdf', valid_pdf_bytes(), content_type='application/pdf')
        response = self.client.post('/api/v1/public/careers/apply', {'opening': str(opening.id), 'name': 'Test Candidate', 'email': 'test@example.com', 'phone': '9876543210', 'cover_message': 'Hello', 'cv': pdf}, format='multipart')
        self.assertEqual(response.status_code, 201)
        application = CareerApplication.objects.get(email='test@example.com')
        self.assertNotEqual(application.cv_original_name, application.cv.name.split('/')[-1])
        self.assertTrue(application.cv.name.startswith('private_career_cvs/'))
        self.assertEqual(application.cv_size, len(valid_pdf_bytes()))
        self.assertNotIn('/', application.cv_original_name)
        self.assertNotIn('\\\\', application.cv_original_name)


    @override_settings(CLAMAV_ENABLED=True, CLAMAV_REQUIRED=True, CAREER_CV_MAX_BYTES=2 * 1024 * 1024)
    @patch('core.upload_security.ensure_clean_upload', side_effect=ClamAVUnavailableError('scanner down'))
    def test_application_survives_scanner_outage_with_sanitized_pdf(self, scanner):
        opening = CareerOpening.objects.create(title='STEM Instructor', description='Teach STEM', status=CareerOpeningStatus.PUBLISHED)
        pdf = SimpleUploadedFile('My Resume.pdf', valid_pdf_bytes(), content_type='application/pdf')
        response = self.client.post('/api/v1/public/careers/apply', {'opening': str(opening.id), 'name': 'Fallback Candidate', 'email': 'fallback@example.com', 'phone': '9876543210', 'cv': pdf}, format='multipart')
        self.assertEqual(response.status_code, 201)
        scanner.assert_called_once()
        application = CareerApplication.objects.get(email='fallback@example.com')
        stored = application.cv.open('rb').read()
        reader = PdfReader(BytesIO(stored), strict=True)
        self.assertEqual(len(reader.pages), 1)

    def test_application_sanitizes_plain_text_fields(self):
        opening = CareerOpening.objects.create(
            title='<strong>STEM Instructor</strong>',
            description='<script>alert(1)</script>Teach STEM',
            status=CareerOpeningStatus.PUBLISHED,
        )
        pdf = SimpleUploadedFile('resume.pdf', valid_pdf_bytes(), content_type='application/pdf')
        response = self.client.post(
            '/api/v1/public/careers/apply',
            {
                'opening': str(opening.id),
                'name': '<b>Test Candidate</b>',
                'email': 'test2@example.com',
                'phone': '9876543210',
                'cover_message': '<script>alert(1)</script>Interested in the role.',
                'cv': pdf,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 201)
        application = CareerApplication.objects.get(email='test2@example.com')
        self.assertEqual(application.name, 'Test Candidate')
        self.assertEqual(application.cover_message, 'Interested in the role.')

    def test_application_rejects_invalid_phone(self):
        opening = CareerOpening.objects.create(title='STEM Instructor', description='Teach STEM', status=CareerOpeningStatus.PUBLISHED)
        pdf = SimpleUploadedFile('resume.pdf', valid_pdf_bytes(), content_type='application/pdf')
        response = self.client.post('/api/v1/public/careers/apply', {'opening': str(opening.id), 'name': 'Test Candidate', 'email': 'test@example.com', 'phone': '1234', 'cv': pdf}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('phone', response.data)