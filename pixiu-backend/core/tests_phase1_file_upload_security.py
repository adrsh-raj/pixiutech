from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from PIL import Image
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import UserRole, UserStatus
from core.secure_upload import SecureUploadView
from core.upload_security import SecureUploadError, validate_uploaded_file


class _User:
    is_authenticated = True
    is_active = True
    status = UserStatus.ACTIVE

    def __init__(self, role, *, active=True, pk=1):
        self.pk = pk
        self.role = role
        self.is_active = active
        self.status = UserStatus.ACTIVE if active else UserStatus.SUSPENDED


def _upload(name, data, content_type):
    return SimpleUploadedFile(name=name, content=data, content_type=content_type)


def _valid_png_bytes():
    buffer = BytesIO()
    Image.new("RGB", (1, 1), (0, 0, 0)).save(buffer, format="PNG")
    return buffer.getvalue()


@override_settings(CLAMAV_ENABLED=False, CLAMAV_REQUIRED=False)
class SecureUploadValidationTests(SimpleTestCase):
    def test_accepts_valid_pdf_and_rewrites_filename(self):
        upload = _upload("lesson material.pdf", b"%PDF-1.7\n", "application/pdf")
        validate_uploaded_file(upload)
        self.assertRegex(upload.name, r"^[0-9a-f]{32}\.pdf$")

    def test_accepts_valid_png_and_rewrites_filename(self):
        upload = _upload("image.png", _valid_png_bytes(), "image/png")
        validate_uploaded_file(upload)
        self.assertRegex(upload.name, r"^[0-9a-f]{32}\.png$")

    def test_rejects_active_content_extension(self):
        upload = _upload("payload.svg", b"<svg/onload=alert(1)>", "image/svg+xml")
        with self.assertRaises(SecureUploadError):
            validate_uploaded_file(upload)

    def test_rejects_double_extension(self):
        upload = _upload("photo.jpg.php", b"%PDF-1.7\n", "application/pdf")
        with self.assertRaises(SecureUploadError):
            validate_uploaded_file(upload)

    def test_rejects_mismatched_mime(self):
        upload = _upload("photo.jpg", b"\xff\xd8\xff" + b"0" * 20, "application/pdf")
        with self.assertRaises(SecureUploadError):
            validate_uploaded_file(upload)

    def test_rejects_mismatched_signature(self):
        upload = _upload("photo.jpg", b"not-a-jpeg", "image/jpeg")
        with self.assertRaises(SecureUploadError):
            validate_uploaded_file(upload)

    @override_settings(SECURE_UPLOAD_MAX_BYTES=1024 * 1024)
    def test_rejects_oversized_file(self):
        upload = _upload("large.pdf", b"%PDF-1.7\n" + b"x" * (1024 * 1024), "application/pdf")
        with self.assertRaises(SecureUploadError):
            validate_uploaded_file(upload)

    def test_rewrites_path_traversal_filename_to_uuid(self):
        upload = _upload("../../secret.pdf", b"%PDF-1.7\n", "application/pdf")
        validate_uploaded_file(upload)
        self.assertNotIn("..", upload.name)
        self.assertNotIn("/", upload.name)
        self.assertNotIn("\\", upload.name)

    def test_rejects_control_character_filename(self):
        upload = _upload("lesson\r\n.pdf", b"%PDF-1.7\n", "application/pdf")
        with self.assertRaises(SecureUploadError):
            validate_uploaded_file(upload)


@override_settings(CLAMAV_ENABLED=False, CLAMAV_REQUIRED=False)
class SecureUploadEndpointTests(SimpleTestCase):
    def _request(self, user):
        factory = APIRequestFactory()
        request = factory.post(
            "/api/v1/upload/",
            {"file": _upload("../../evil.pdf", b"%PDF-1.7\n", "application/pdf")},
            format="multipart",
        )
        force_authenticate(request, user=user)
        return request

    def test_student_cannot_use_generic_upload_endpoint(self):
        response = SecureUploadView.as_view()(self._request(_User(UserRole.STUDENT)))
        self.assertEqual(response.status_code, 403)

    def test_inactive_admin_cannot_use_generic_upload_endpoint(self):
        response = SecureUploadView.as_view()(self._request(_User(UserRole.ADMIN, active=False)))
        self.assertEqual(response.status_code, 403)

    @patch("core.secure_upload.default_storage.url", return_value="/media/private_uploads/fake.pdf")
    @patch("core.secure_upload.default_storage.save", return_value="private_uploads/fake.pdf")
    def test_admin_upload_does_not_expose_original_filename(self, save_mock, url_mock):
        response = SecureUploadView.as_view()(self._request(_User(UserRole.ADMIN)))
        self.assertEqual(response.status_code, 201)
        saved_path = save_mock.call_args.args[0]
        self.assertNotIn("evil.pdf", saved_path)
        self.assertNotIn("..", saved_path)
        self.assertTrue(saved_path.startswith("private_uploads/"))
