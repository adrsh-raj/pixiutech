"""Backward-compatible certificate PDF import.

The production certificate endpoint now uses the certificate-size renderer in
certificate_pdf_v2. Keeping this module as the canonical import avoids older
internal callers silently generating the legacy A4 landscape certificate.
"""

from .certificate_pdf_v2 import CERTIFICATE_SIZE, build_certificate_pdf

__all__ = ['CERTIFICATE_SIZE', 'build_certificate_pdf']
