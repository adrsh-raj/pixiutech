import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image
from reportlab.pdfgen import canvas

from learning.watermarking import prepare_uploaded_file


class LearningWatermarkingTests(SimpleTestCase):
    def _pdf(self):
        buffer = io.BytesIO()
        page = canvas.Canvas(buffer, pagesize=(400, 300))
        page.drawString(40, 260, 'Pixiu Tech classroom handout')
        page.save()
        return buffer.getvalue()

    def _image(self):
        buffer = io.BytesIO()
        Image.new('RGB', (500, 300), 'white').save(buffer, format='PNG')
        return buffer.getvalue()

    def test_student_pdf_is_watermarked(self):
        uploaded = SimpleUploadedFile('lesson.pdf', self._pdf(), content_type='application/pdf')
        processed, watermarked = prepare_uploaded_file(uploaded, 'student')
        self.assertTrue(watermarked)
        self.assertTrue(processed.name.startswith('watermarked_'))
        self.assertNotEqual(processed.read(), self._pdf())

    def test_student_image_is_watermarked(self):
        raw = self._image()
        uploaded = SimpleUploadedFile('diagram.png', raw, content_type='image/png')
        processed, watermarked = prepare_uploaded_file(uploaded, 'student')
        self.assertTrue(watermarked)
        self.assertTrue(processed.name.startswith('watermarked_'))
        self.assertNotEqual(processed.read(), raw)

    def test_trainer_upload_is_not_watermarked(self):
        raw = self._pdf()
        uploaded = SimpleUploadedFile('trainer.pdf', raw, content_type='application/pdf')
        processed, watermarked = prepare_uploaded_file(uploaded, 'trainer')
        self.assertFalse(watermarked)
        self.assertIs(processed, uploaded)

    def test_unsupported_student_file_is_rejected(self):
        uploaded = SimpleUploadedFile('lesson.mp4', b'video', content_type='video/mp4')
        with self.assertRaises(ValueError):
            prepare_uploaded_file(uploaded, 'student')
