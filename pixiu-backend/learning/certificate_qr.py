import io

import qrcode
from django.core.files.storage import default_storage


def generate_verification_qr(*, verification_url: str, certificate_id: str) -> str:
    """Generate and persist a QR PNG for a certificate verification URL.

    The QR is generated server-side so the printed certificate has a stable,
    self-hosted verification image and does not depend on a third-party QR API.
    Returns the storage URL for the generated PNG.
    """
    image = qrcode.make(verification_url)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    filename = f"certificates/qr/{certificate_id}.png"
    stored = default_storage.save(filename, __import__("django.core.files.base", fromlist=["ContentFile"]).ContentFile(buffer.getvalue()))
    return default_storage.url(stored)
