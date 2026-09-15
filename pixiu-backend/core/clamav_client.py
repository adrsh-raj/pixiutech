"""Small stdlib-only client for scanning uploads with clamd over TCP.

The production deployment runs ClamAV as a Render private service. The client
uses the documented INSTREAM protocol so the uploaded bytes are never written
to the scanner's filesystem and the application can fail closed when the
scanner is required but unavailable.
"""

from __future__ import annotations

import logging
import socket
import struct
from typing import BinaryIO

from django.conf import settings

logger = logging.getLogger("security.uploads")


class ClamAVError(Exception):
    """Base class for scanner-side failures."""


class ClamAVUnavailableError(ClamAVError):
    """The scanner could not be reached or returned an unusable response."""


class ClamAVMalwareDetectedError(ClamAVError):
    """ClamAV identified a malicious signature."""


def clamav_enabled() -> bool:
    return bool(getattr(settings, "CLAMAV_ENABLED", False))


def clamav_required() -> bool:
    return bool(getattr(settings, "CLAMAV_REQUIRED", False))


def _scanner_address() -> tuple[str, int]:
    host = str(getattr(settings, "CLAMAV_HOST", "127.0.0.1")).strip()
    port = int(getattr(settings, "CLAMAV_PORT", 3310))
    if not host:
        raise ClamAVUnavailableError("ClamAV host is not configured.")
    if not 1 <= port <= 65535:
        raise ClamAVUnavailableError("ClamAV port is invalid.")
    return host, port


def _read_reply(sock: socket.socket, *, max_bytes: int = 4096) -> str:
    data = bytearray()
    while len(data) < max_bytes:
        chunk = sock.recv(min(1024, max_bytes - len(data)))
        if not chunk:
            break
        data.extend(chunk)
        if b"\0" in data or b"\n" in data:
            break
    if not data:
        raise ClamAVUnavailableError("ClamAV closed the connection without a verdict.")
    return bytes(data).replace(b"\0", b"\n").decode("utf-8", errors="replace").strip()


def _stream(sock: socket.socket, uploaded: BinaryIO, *, chunk_size: int) -> None:
    sock.sendall(b"zINSTREAM\0")
    while True:
        chunk = uploaded.read(chunk_size)
        if not chunk:
            break
        sock.sendall(struct.pack("!I", len(chunk)))
        sock.sendall(chunk)
    sock.sendall(struct.pack("!I", 0))


def scan_uploaded_file(uploaded: BinaryIO) -> None:
    """Scan a seekable upload; raises on malware or scanner failure.

    The caller remains responsible for extension/signature/size checks. This
    function preserves the current file cursor so validation can continue or
    storage can consume the upload after the scan.
    """
    if not clamav_enabled():
        return

    if not hasattr(uploaded, "seek") or not hasattr(uploaded, "read"):
        raise ClamAVUnavailableError("Upload stream is not seekable.")

    original_position = uploaded.tell() if hasattr(uploaded, "tell") else 0
    chunk_size = int(getattr(settings, "CLAMAV_CHUNK_SIZE", 1024 * 1024))
    timeout = float(getattr(settings, "CLAMAV_TIMEOUT_SECONDS", 30))
    if chunk_size <= 0 or chunk_size > 4 * 1024 * 1024:
        raise ClamAVUnavailableError("ClamAV chunk size is invalid.")
    if timeout <= 0:
        raise ClamAVUnavailableError("ClamAV timeout is invalid.")

    try:
        uploaded.seek(0)
        host, port = _scanner_address()
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            _stream(sock, uploaded, chunk_size=chunk_size)
            verdict = _read_reply(sock)
    except ClamAVMalwareDetectedError:
        raise
    except (OSError, ValueError, struct.error, ClamAVUnavailableError) as exc:
        raise ClamAVUnavailableError("Unable to obtain a ClamAV verdict.") from exc
    finally:
        try:
            uploaded.seek(original_position)
        except (AttributeError, OSError):
            pass

    normalized = verdict.lower()
    if normalized.endswith("found") or " found" in normalized:
        raise ClamAVMalwareDetectedError(verdict)
    if normalized.endswith("ok") or normalized == "stream: ok" or normalized.endswith(": ok"):
        return
    raise ClamAVUnavailableError("ClamAV returned an unexpected verdict.")


def ensure_clean_upload(uploaded: BinaryIO) -> None:
    """Apply the configured AV policy to an upload."""
    if not clamav_enabled():
        return
    try:
        scan_uploaded_file(uploaded)
    except ClamAVMalwareDetectedError as exc:
        logger.warning("Upload rejected by antivirus scanner: malware_detected")
        raise
    except ClamAVUnavailableError as exc:
        if clamav_required():
            logger.error("Upload rejected because required antivirus scanner is unavailable")
            raise
        logger.warning("Antivirus scanner unavailable; continuing because CLAMAV_REQUIRED=false")
