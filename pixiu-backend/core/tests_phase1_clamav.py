import os
from unittest import skipUnless, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings

from core.clamav_client import (
    ClamAVMalwareDetectedError,
    ClamAVUnavailableError,
    ensure_clean_upload,
    scan_uploaded_file,
)
from core.upload_security import SecureUploadError, validate_uploaded_file


class _SocketResponse:
    def __init__(self, response):
        self.response = response
        self.sent = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def settimeout(self, value):
        self.timeout = value

    def sendall(self, data):
        self.sent.append(data)

    def recv(self, size):
        response, self.response = self.response, b""
        return response


class ClamAVProtocolTests(SimpleTestCase):
    @override_settings(
        CLAMAV_ENABLED=True,
        CLAMAV_REQUIRED=True,
        CLAMAV_HOST="127.0.0.1",
        CLAMAV_PORT=3310,
        CLAMAV_TIMEOUT_SECONDS=5,
        CLAMAV_CHUNK_SIZE=8,
    )
    @patch("core.clamav_client.socket.create_connection")
    def test_streams_upload_using_instream_and_accepts_clean_verdict(self, create_connection):
        upload = SimpleTestUploadedFile(b"clean-pdf")
        fake_socket = _SocketResponse(b"stream: OK\0")
        create_connection.return_value = fake_socket

        scan_uploaded_file(upload)

        self.assertEqual(fake_socket.sent[0], b"zINSTREAM\0")
        self.assertEqual(fake_socket.sent[-1], b"\x00\x00\x00\x00")
        self.assertEqual(upload.tell(), 0)

    @override_settings(CLAMAV_ENABLED=True, CLAMAV_REQUIRED=True)
    @patch("core.clamav_client.scan_uploaded_file", side_effect=ClamAVMalwareDetectedError("stream: Test FOUND"))
    def test_malware_verdict_is_rejected(self, scan_mock):
        upload = SimpleTestUploadedFile(b"%PDF-1.7\n")
        with self.assertRaises(ClamAVMalwareDetectedError):
            ensure_clean_upload(upload)
        scan_mock.assert_called_once()

    @override_settings(CLAMAV_ENABLED=True, CLAMAV_REQUIRED=True)
    @patch("core.clamav_client.scan_uploaded_file", side_effect=ClamAVUnavailableError("down"))
    def test_required_scanner_fails_closed(self, scan_mock):
        upload = SimpleTestUploadedFile(b"%PDF-1.7\n")
        with self.assertRaises(ClamAVUnavailableError):
            ensure_clean_upload(upload)
        scan_mock.assert_called_once()

    @override_settings(CLAMAV_ENABLED=True, CLAMAV_REQUIRED=False)
    @patch("core.clamav_client.scan_uploaded_file", side_effect=ClamAVUnavailableError("down"))
    def test_optional_scanner_can_fail_open_only_when_explicitly_configured(self, scan_mock):
        upload = SimpleTestUploadedFile(b"%PDF-1.7\n")
        ensure_clean_upload(upload)
        scan_mock.assert_called_once()

    @override_settings(CLAMAV_ENABLED=True, CLAMAV_REQUIRED=True)
    @patch("core.upload_security.ensure_clean_upload", side_effect=ClamAVUnavailableError("down"))
    def test_central_validator_returns_safe_error_when_scanner_is_unavailable(self, scan_mock):
        upload = SimpleUploadedFile("lesson.pdf", b"%PDF-1.7\n", content_type="application/pdf")
        with self.assertRaises(SecureUploadError) as raised:
            validate_uploaded_file(upload)
        self.assertEqual(raised.exception.messages, ["Malware scanning is currently unavailable."])
        scan_mock.assert_called_once()

    @skipUnless(os.environ.get("CLAMAV_INTEGRATION") == "1", "live ClamAV integration tests are CI-only")
    @override_settings(
        CLAMAV_ENABLED=True,
        CLAMAV_REQUIRED=True,
        CLAMAV_HOST="127.0.0.1",
        CLAMAV_PORT=3310,
        CLAMAV_TIMEOUT_SECONDS=30,
        CLAMAV_CHUNK_SIZE=1024 * 1024,
    )
    def test_live_clamav_scans_a_real_clean_upload(self):
        upload = SimpleUploadedFile("live.pdf", b"%PDF-1.7\nclean integration test\n", content_type="application/pdf")
        scan_uploaded_file(upload)
        self.assertEqual(upload.tell(), 0)

    @skipUnless(os.environ.get("CLAMAV_INTEGRATION") == "1", "live ClamAV integration tests are CI-only")
    @override_settings(
        CLAMAV_ENABLED=True,
        CLAMAV_REQUIRED=True,
        CLAMAV_HOST="127.0.0.1",
        CLAMAV_PORT=3310,
        CLAMAV_TIMEOUT_SECONDS=30,
        CLAMAV_CHUNK_SIZE=1024 * 1024,
    )
    def test_live_clamav_detects_standard_antivirus_test_signature(self):
        eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n"
        upload = SimpleUploadedFile("scan-test.txt", eicar, content_type="text/plain")
        with self.assertRaises(ClamAVMalwareDetectedError):
            scan_uploaded_file(upload)
        self.assertEqual(upload.tell(), 0)


class SimpleTestUploadedFile(SimpleUploadedFile):
    def __init__(self, content):
        super().__init__("upload.pdf", content, content_type="application/pdf")
