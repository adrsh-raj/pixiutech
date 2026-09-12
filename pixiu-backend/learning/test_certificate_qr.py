from django.core.files.storage import default_storage
from django.test import TestCase

from .certificate_qr import generate_verification_qr


class CertificateQrTests(TestCase):
    def test_server_side_qr_is_written_to_storage(self):
        filename = "certificates/qr/TEST-CERT-QR.png"
        url = generate_verification_qr(
            verification_url="https://pixiutech.com/verify?cert=TEST-CERT-QR",
            certificate_id="TEST-CERT-QR",
        )
        self.assertTrue(url)
        self.assertTrue(default_storage.exists(filename))
        with default_storage.open(filename, "rb") as image_file:
            self.assertEqual(image_file.read(8), b"\x89PNG\r\n\x1a\n")
        default_storage.delete(filename)
