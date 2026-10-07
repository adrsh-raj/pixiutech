"""Centralized, defense-in-depth validation for user-uploaded files."""

from __future__ import annotations

import logging
import re
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadhandler import FileUploadHandler
from django.core.files.uploadedfile import SimpleUploadedFile, UploadedFile
from rest_framework.exceptions import ParseError
from rest_framework.parsers import MultiPartParser as DRFMultiPartParser

from .clamav_client import (
    ClamAVMalwareDetectedError,
    ClamAVUnavailableError,
    ensure_clean_upload,
)

# Product-supported binary formats. Active-content formats such as SVG, HTML,
# JavaScript and executable/archive formats are intentionally excluded.
logger = logging.getLogger("security.uploads")


ALLOWED_UPLOADS = {
    ".pdf": ("application/pdf",),
    ".png": ("image/png",),
    ".jpg": ("image/jpeg", "image/jpg"),
    ".jpeg": ("image/jpeg", "image/jpg"),
    ".webp": ("image/webp",),
    ".mp4": ("video/mp4",),
    ".webm": ("video/webm",),
}

MAGIC_BYTES = {
    ".pdf": ((b"%PDF-", 0),),
    ".png": ((b"\x89PNG\r\n\x1a\n", 0),),
    ".jpg": ((b"\xff\xd8\xff", 0),),
    ".jpeg": ((b"\xff\xd8\xff", 0),),
    ".webp": ((b"RIFF", 0), (b"WEBP", 8)),
    ".mp4": ((b"ftyp", 4),),
    ".webm": ((b"\x1a\x45\xdf\xa3", 0),),
}


class SecureUploadError(DjangoValidationError):
    """Validation error raised for unsafe uploads."""


def max_upload_bytes(extension: str | None = None) -> int:
    normalized = str(extension or "").lower()
    if normalized in {".mp4", ".webm"}:
        return int(getattr(settings, "SECURE_VIDEO_MAX_BYTES", 500 * 1024 * 1024))
    return int(getattr(settings, "SECURE_UPLOAD_MAX_BYTES", 20 * 1024 * 1024))


def max_multipart_bytes() -> int:
    return int(
        getattr(
            settings,
            "SECURE_UPLOAD_MAX_MULTIPART_BYTES",
            max(int(getattr(settings, "SECURE_UPLOAD_MAX_BYTES", 20 * 1024 * 1024)), int(getattr(settings, "SECURE_VIDEO_MAX_BYTES", 500 * 1024 * 1024))) + 5 * 1024 * 1024,
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


def validate_uploaded_file(
    uploaded: UploadedFile | None,
    *,
    scan: bool = True,
    raise_clamav_unavailable: bool = False,
) -> UploadedFile:
    """Validate, malware-scan, and rename an upload before storage."""
    if uploaded is None:
        raise SecureUploadError("A file is required.")
    if not isinstance(uploaded, UploadedFile) and not hasattr(uploaded, "name"):
        raise SecureUploadError("Invalid uploaded file.")

    original_name = _clean_original_name(getattr(uploaded, "name", None))
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_UPLOADS:
        raise SecureUploadError(
            "Only PDF, PNG, JPG/JPEG, WEBP, MP4, and WEBM files are allowed."
        )

    size = getattr(uploaded, "size", None)
    if size is None or int(size) <= 0:
        raise SecureUploadError("Uploaded file is empty.")
    upload_limit = max_upload_bytes(extension)
    if int(size) > upload_limit:
        raise SecureUploadError(
            f"Video files must be {upload_limit // (1024 * 1024)} MB or smaller." if extension in {".mp4", ".webm"} else
            f"File must be {upload_limit // (1024 * 1024)} MB or smaller."
        )

    declared_type = str(getattr(uploaded, "content_type", "") or "").split(";", 1)[0].strip().lower()
    expected_types = set(ALLOWED_UPLOADS[extension])
    if declared_type and declared_type not in expected_types:
        raise SecureUploadError(
            f"File content type does not match the .{extension.lstrip('.')} extension."
        )

    _assert_signature(uploaded, extension)
    _assert_valid_image(uploaded, extension)

    if scan:
        try:
            ensure_clean_upload(uploaded)
        except ClamAVMalwareDetectedError as exc:
            raise SecureUploadError("Uploaded file failed malware scanning.") from exc
        except ClamAVUnavailableError as exc:
            if raise_clamav_unavailable:
                raise
            raise SecureUploadError("Malware scanning is currently unavailable.") from exc

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

    def new_file(self, field_name, file_name, *args, **kwargs):
        self._received = 0
        self._extension = Path(str(file_name or "")).suffix.lower()
        return super().new_file(field_name, file_name, *args, **kwargs)

    def receive_data_chunk(self, raw_data, start):
        self._received += len(raw_data)
        limit = max_upload_bytes(getattr(self, "_extension", ""))
        if self._received > limit:
            raise ParseError(
                f"File exceeds the {limit // (1024 * 1024)} MB upload limit."
            )
        return raw_data

    def file_complete(self, file_size):
        return None



def career_cv_max_bytes() -> int:
    return int(getattr(settings, "CAREER_CV_MAX_BYTES", 2 * 1024 * 1024))


def _sanitize_career_pdf(raw: bytes) -> bytes:
    """Create a conservative PDF derivative when antivirus service is unavailable.

    The derivative keeps page content but drops common interactive/active PDF
    structures such as annotations, actions, forms, names, and embedded-file
    references. This is a fallback only; a live ClamAV verdict remains preferred.
    """
    try:
        from pypdf import PdfReader, PdfWriter

        reader = PdfReader(BytesIO(raw), strict=True)
        writer = PdfWriter()
        for page in reader.pages:
            for key in ("/Annots", "/AA", "/PieceInfo", "/Metadata"):
                page.pop(key, None)
            writer.add_page(page)

        catalog = writer._root_object
        for key in ("/OpenAction", "/AA", "/Names", "/AcroForm", "/Metadata"):
            catalog.pop(key, None)

        output = BytesIO()
        writer.write(output)
        sanitized = output.getvalue()
        if not sanitized:
            raise SecureUploadError("CV PDF could not be safely rebuilt.")
        return sanitized
    except SecureUploadError:
        raise
    except Exception as exc:
        raise SecureUploadError("CV PDF could not be safely rebuilt.") from exc


def validate_career_cv(uploaded: UploadedFile | None) -> tuple[UploadedFile, str]:
    """Validate a CV as a small, non-active PDF and return its SHA-256."""
    if uploaded is None:
        raise SecureUploadError("A CV PDF is required.")

    original_name = _clean_original_name(getattr(uploaded, "name", None))
    if Path(original_name).suffix.lower() != ".pdf":
        raise SecureUploadError("CV must be a PDF file.")

    size = getattr(uploaded, "size", None)
    if size is None or int(size) <= 0:
        raise SecureUploadError("CV file is empty.")
    if int(size) > career_cv_max_bytes():
        raise SecureUploadError(
            f"CV must be {career_cv_max_bytes() // (1024 * 1024)} MB or smaller."
        )

    declared_type = str(getattr(uploaded, "content_type", "") or "").split(";", 1)[0].strip().lower()
    if declared_type and declared_type != "application/pdf":
        raise SecureUploadError("CV content type must be application/pdf.")

    _assert_signature(uploaded, ".pdf")

    position = uploaded.tell() if hasattr(uploaded, "tell") else 0
    try:
        try:
            uploaded.seek(0)
            raw = uploaded.read()
        except (AttributeError, OSError, ValueError) as exc:
            raise SecureUploadError("CV could not be read safely.") from exc

        # Reject common PDF active-content/attachment primitives. This is
        # additional defense-in-depth; ClamAV remains the primary malware scan.
        if re.search(rb"/(?:javascript|js|openaction|aa|embeddedfile|filespec)\b", raw, flags=re.IGNORECASE):
            raise SecureUploadError("CV PDF contains unsupported active or embedded content.")

        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(raw), strict=True)
            if not reader.pages:
                raise SecureUploadError("CV PDF does not contain a readable page.")
        except SecureUploadError:
            raise
        except Exception as exc:
            raise SecureUploadError("CV PDF is invalid or could not be safely parsed.") from exc
    finally:
        try:
            uploaded.seek(position)
        except (AttributeError, OSError):
            pass

    try:
        ensure_clean_upload(uploaded)
    except ClamAVMalwareDetectedError as exc:
        raise SecureUploadError("Uploaded CV failed malware scanning and was rejected.") from exc
    except ClamAVUnavailableError:
        # A CV submission must not dead-end because the AV sidecar is starting,
        # restarting, or temporarily unreachable. The PDF has already passed
        # signature, size, strict parsing, and active-content checks above.
        # Rebuild it into a conservative derivative before storage so the
        # application can proceed without exposing the scanner outage to users.
        logger.warning("ClamAV unavailable for career CV; storing sanitized PDF derivative")
        sanitized = _sanitize_career_pdf(raw)
        if len(sanitized) > career_cv_max_bytes():
            raise SecureUploadError("CV PDF could not be safely stored within the size limit.")
        uploaded = SimpleUploadedFile(
            secure_storage_name(original_name, extension=".pdf"),
            sanitized,
            content_type="application/pdf",
        )
        raw = sanitized
    except Exception as exc:
        # Unexpected scanner integration failures are still fail-closed.
        raise SecureUploadError("CV security validation failed. Please try again shortly.") from exc

    import hashlib
    digest = hashlib.sha256(raw).hexdigest()
    if not getattr(uploaded, "_pixiu_secure_upload", False):
        uploaded.name = secure_storage_name(original_name, extension=".pdf")
        setattr(uploaded, "_pixiu_secure_upload", True)
    return uploaded, digest


class CareerCVSizeHandler(FileUploadHandler):
    """Streaming 2 MB cap for public career CV uploads."""

    def __init__(self, request=None):
        super().__init__(request)
        self._received = 0

    def new_file(self, *args, **kwargs):
        self._received = 0
        return super().new_file(*args, **kwargs)

    def receive_data_chunk(self, raw_data, start):
        self._received += len(raw_data)
        if self._received > career_cv_max_bytes():
            raise ParseError(
                f"CV exceeds the {career_cv_max_bytes() // (1024 * 1024)} MB upload limit."
            )
        return raw_data

    def file_complete(self, file_size):
        return None


class CareerCVMultipartParser(DRFMultiPartParser):
    """Use the tighter career CV upload handler for this endpoint only."""

    def parse(self, stream, media_type=None, parser_context=None):
        request = (parser_context or {}).get("request")
        if request is not None:
            request._request.upload_handlers = [
                CareerCVSizeHandler(request._request),
                __import__("django.core.files.uploadhandler", fromlist=["MemoryFileUploadHandler"]).MemoryFileUploadHandler(request._request),
                __import__("django.core.files.uploadhandler", fromlist=["TemporaryFileUploadHandler"]).TemporaryFileUploadHandler(request._request),
            ]
            raw_length = getattr(request, "META", {}).get("CONTENT_LENGTH")
            if raw_length:
                try:
                    if int(raw_length) > career_cv_max_bytes() + 512 * 1024:
                        raise ParseError(
                            f"Career application upload exceeds the allowed CV request size."
                        )
                except (TypeError, ValueError):
                    pass
        return super().parse(stream, media_type=media_type, parser_context=parser_context)
