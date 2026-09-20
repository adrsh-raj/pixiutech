"""Helpers for storing user-entered plain text safely.

These helpers operate only on fields that are displayed as plain text.
Passwords, identifiers, source code, and other structured values must not be
passed through this sanitizer.
"""

from __future__ import annotations

import re
import unicodedata
from html import unescape

_DANGEROUS_BLOCK_RE = re.compile(
    r"<(?:script|style|iframe|object|embed)\b[^>]*>.*?</(?:script|style|iframe|object|embed)\s*>",
    re.IGNORECASE | re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]*>")


def sanitize_plain_text(
    value,
    max_length: int,
    *,
    preserve_newlines: bool = False,
) -> str:
    """Strip markup/control characters and normalize whitespace before storage."""
    text = unescape(str(value or ""))
    text = _DANGEROUS_BLOCK_RE.sub(" ", text)
    text = _TAG_RE.sub(" ", text)

    cleaned = []
    for char in text:
        category = unicodedata.category(char)
        if category.startswith("C") and char not in {"\n", "\t"}:
            continue
        cleaned.append(char)

    text = "".join(cleaned)
    if preserve_newlines:
        text = "\n".join(" ".join(line.split()) for line in text.splitlines())
    else:
        text = " ".join(text.split())
    return text[:max_length]
