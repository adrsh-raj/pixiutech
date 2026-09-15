"""Centralized, defense-in-depth validation for user-uploaded files."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadhandler import FileUploadHandler
from django.core.files.uploadedfile import UploadedFile
from rest_framework.exceptions import ParseError
from rest_framework.parsers import MultiPartParser as DRFMultiPartParser

# Product-supported binary formats. Active-content formats such as SVG, HTML,
# JavaScript and executable/archive formats are intentionally excluded.
ALLOWED_UPLOADS = {
    ".pdf": ("application/pdf",),
    ".png": ("image/png",),
    ".jpg": ("image/jpeg", "image/jpg"),
    ".jpeg": ("image/jpeg", "image/jpg"),
    ".webp": ("image/webp",),
}

MAGIC_BYTES = {
    ".pdf": ((b"%PDF-", 0),),
    ".png": ((b"\x89PNG\r\n\x1a\n", 0),),
    ".jpg": ((b"\xff\xd8\xff", 0),),
    ".jpeg": ((b"\xff\xd8\xff", 0),),
    ".webp": ((b"RIFF", 0), (b"WEBP", 8)),
}


class SecureUploadError(DjangoValidationError):
    """Validation error raised for unsafe uploads."""


def max_upload_bytes() -> int:
    return int(getattr(settings, "SECURE_UPLOAD_MAX_BYTES", 20 * 1024 * 1024))


def max_multipart_bytes() -> int:
    return int(
        getattr(
            settings,
            "SECURE_UPLOAD_MAX_MULTIPART_BYTES",
            max_upload_bytes() + 5 * 1024 * 1024,
        )
    )


def _clean_original_name(name: str | None) -> str:
    raw = str(name or "").replace("\\", "/")
    basename = Path(raw).name
    if not basename or basename in {".", ".."}:
        raise SecureUploadError("A valid filename is required.")
    if "\x00" in basename or "\r" in basename or "\n" in basename:
        raise SecureUploadError("Filename contains forbidden control characters.")
    return basename


def _assert_signature(uploaded: UploadedFile, extension: str) -> None:
    signatures = MAGIC_BYTES[extension]
    position = uploaded.tell() if hasattr(uploaded, "tell") else 0
    try:
        uploaded.seek(0)
        head = uploaded.read(16)
        for signature, offset in signatures:
            if len(head) < offset + len(signature) or head[offset : offset + len(signature)] != signature:
                raise SecureUploadError("File content does not match the allowed file type.")
    finally:
        try:
            uploaded.seek(position)
        except (AttributeError, OSError):
            pass


def _assert_valid_image(uploaded: UploadedFile, extension: str) -> None:
    if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        return
    try:
        from PIL import Image
    except ImportError as exc:
        raise SecureUploadError("Image validation is unavailable on this server.") from exc

    position = uploaded.tell() if hasattr(uploaded, "tell") else 0
    try:
        uploaded.seek(0)
        image = Image.open(uploaded)
        image.verify()
    except Exception as exc:
        raise SecureUploadError("Uploaded image is invalid or corrupted.") from exc
    finally:
        try:
            uploaded.seek(position)
        except (AttributeError, OSError):
            pass


def secure_storage_name(original_name: str | None, *, extension: str | None = None) -> str:
    safe_original = _clean_original_name(original_name)
    suffix = (extension or Path(safe_original).suffix).lower()
    if suffix not in ALLOWED_UPLOADS:
        raise SecureUploadError("This file type is not allowed.")
    return f"{uuid4().hex}{suffix}"


def validate_uploaded_file(uploaded: UploadedFile | None) -> UploadedFile:
    """Validate an upload and replace its client-controlled storage filename."""
    if uploaded is None:
        raise SecureUploadError("A file is required.")
    if not isinstance(uploaded, UploadedFile) and not hasattr(uploaded, "name"):
        raise SecureUploadError("Invalid uploaded file.")

    original_name = _clean_original_name(getattr(uploaded, "name", None))
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_UPLOADS:
        raise SecureUploadError(
            "Only PDF, PNG, JPG/JPEG, and WEBP files are allowed."
        )

    size = getattr(uploaded, "size", None)
    if size is None or int(size) <= 0:
        raise SecureUploadError("Uploaded file is empty.")
    if int(size) > max_upload_bytes():
        raise SecureUploadError(
            f"File must be {max_upload_bytes() // (1024 * 1024)} MB or smaller."
        )

    declared_type = str(getattr(uploaded, "content_type", "") or "").split(";", 1)[0].strip().lower()
    expected_types = set(ALLOWED_UPLOADS[extension])
    if declared_type and declared_type not in expected_types:
        raise SecureUploadError(
            f"File content type does not match the .{extension.lstrip('.')} extension."
        )

    _assert_signature(uploaded, extension)
    _assert_valid_image(uploaded, extension)

    uploaded.name = secure_storage_name(original_name, extension=extension)
    setattr(uploaded, "_pixiu_secure_upload", True)
    return uploaded


def validate_file_field_value(value):
    """Validator compatible with Django/DRF FileField validation."""
    if value is None or getattr(value, "_committed", False):
        return value
    uploaded = getattr(value, "file", value)
    validate_uploaded_file(uploaded)
    value.name = uploaded.name
    setattr(value, "_pixiu_secure_upload", True)
    return value


class SecureMultiPartParser(DRFMultiPartParser):
    """Reject oversized multipart requests before DRF parses their files."""

    def parse(self, stream, media_type=None, parser_context=None):
        request = (parser_context or {}).get("request")
        raw_length = getattr(request, "META", {}).get("CONTENT_LENGTH") if request else None
        if raw_length:
            try:
                if int(raw_length) > max_multipart_bytes():
                    raise ParseError(
                        f"Multipart request exceeds the {max_multipart_bytes() // (1024 * 1024)} MB limit."
                    )
            except (TypeError, ValueError):
                pass
        return super().parse(stream, media_type=media_type, parser_context=parser_context)


class SecureUploadSizeHandler(FileUploadHandler):
    """Streaming size guard for multipart uploads, including chunked requests."""

    def __init__(self, request=None):
        super().__init__(request)
        self._received = 0

    def new_file(self, *args, **kwargs):
        self._received = 0
        return super().new_file(*args, **kwargs)

    def receive_data_chunk(self, raw_data, start):
        self._received += len(raw_data)
        if self._received > max_upload_bytes():
            raise ParseError(
                f"File exceeds the {max_upload_bytes() // (1024 * 1024)} MB upload limit."
            )
        return raw_data

    def file_complete(self, file_size):
        return None
