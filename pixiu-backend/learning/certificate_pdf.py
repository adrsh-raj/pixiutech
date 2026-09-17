"""Canonical certificate PDF import.

All certificate PDF endpoints use the A4 landscape renderer in
certificate_pdf_v3. This compatibility module preserves the old import path.
"""

from .certificate_pdf_v3 import CERTIFICATE_SIZE, build_certificate_pdf

__all__ = ['CERTIFICATE_SIZE', 'build_certificate_pdf']
