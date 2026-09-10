import io
import os
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

WATERMARK_TEXT = "PIXIU TECH • STUDENT COPY • CONFIDENTIAL"
STUDENT_ROLES = {"student", "school", "all"}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def _safe_filename(name):
    original = os.path.basename(name or "upload")
    stem, ext = os.path.splitext(original)
    return f"watermarked_{stem}{ext.lower()}"


def _pdf_overlay(width, height):
    buffer = io.BytesIO()
    page = canvas.Canvas(buffer, pagesize=(float(width), float(height)))
    page.saveState()
    try:
        page.setFillAlpha(0.16)
    except Exception:
        pass
    page.setFillGray(0.35)
    page.setFont("Helvetica-Bold", max(18, min(36, int(min(float(width), float(height)) / 18))))
    page.translate(float(width) / 2, float(height) / 2)
    page.rotate(32)
    step = max(90, min(150, int(min(float(width), float(height)) / 7)))
    for y in range(-int(height) * 2, int(height) * 2, step):
        page.drawCentredString(0, y, WATERMARK_TEXT)
    page.restoreState()
    page.save()
    return buffer.getvalue()


def watermark_pdf(raw_bytes):
    reader = PdfReader(io.BytesIO(raw_bytes))
    writer = PdfWriter()
    for source_page in reader.pages:
        width = float(source_page.mediabox.width)
        height = float(source_page.mediabox.height)
        overlay = PdfReader(io.BytesIO(_pdf_overlay(width, height))).pages[0]
        source_page.merge_page(overlay)
        writer.add_page(source_page)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def _font(size):
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size=size)
    except Exception:
        return ImageFont.load_default()


def watermark_image(raw_bytes):
    original = Image.open(io.BytesIO(raw_bytes))
    source = original.convert("RGBA")
    overlay = Image.new("RGBA", source.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    font = _font(max(16, int(min(source.size) / 16)))
    text_width = max(240, int(source.width * 0.34))
    while font and draw.textbbox((0, 0), WATERMARK_TEXT, font=font)[2] > text_width and getattr(font, "size", 0) > 10:
        font = _font(max(10, getattr(font, "size", 24) - 2))
    spacing = max(120, int(min(source.size) / 5))
    for y in range(-source.height, source.height * 2, spacing):
        for x in range(-source.width, source.width * 2, max(spacing * 2, 180)):
            draw.text((x, y), WATERMARK_TEXT, font=font, fill=(55, 65, 81, 52), stroke_width=1, stroke_fill=(255, 255, 255, 80))
    merged = Image.alpha_composite(source, overlay)
    output = io.BytesIO()
    original_format = original.format or "PNG"
    save_format = "JPEG" if original_format.upper() in {"JPG", "JPEG"} else original_format
    if save_format.upper() == "WEBP":
        merged.save(output, format="WEBP", quality=92)
    elif save_format.upper() == "JPEG":
        merged.convert("RGB").save(output, format="JPEG", quality=92)
    else:
        merged.save(output, format="PNG")
    return output.getvalue()


def prepare_uploaded_file(uploaded_file, target_role, watermark_enabled=True):
    role = str(target_role or "student").strip().lower()
    if not watermark_enabled or role == "trainer" or role not in STUDENT_ROLES:
        return uploaded_file, False

    extension = Path(uploaded_file.name or "").suffix.lower()
    raw = uploaded_file.read()
    uploaded_file.seek(0)
    if extension == ".pdf" or str(getattr(uploaded_file, "content_type", "")).lower() == "application/pdf":
        processed = watermark_pdf(raw)
    elif extension in SUPPORTED_IMAGE_EXTENSIONS or str(getattr(uploaded_file, "content_type", "")).lower().startswith("image/"):
        processed = watermark_image(raw)
    else:
        raise ValueError("Student-facing file uploads must be PDF or image files so Pixiu Tech can apply a permanent watermark. Use an external URL for video or other unsupported files.")
    return ContentFile(processed, name=_safe_filename(uploaded_file.name)), True


def prepare_stored_file(field_file, target_role, watermark_enabled=True):
    role = str(target_role or "student").strip().lower()
    if not watermark_enabled or role == "trainer" or role not in STUDENT_ROLES or not field_file:
        return field_file, False
    field_file.open("rb")
    try:
        content = ContentFile(field_file.read(), name=field_file.name)
    finally:
        field_file.close()
    return prepare_uploaded_file(content, target_role, watermark_enabled=True)
