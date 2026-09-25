"""Temporary upload, transcoding, and final-storage helpers for learning videos."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

import boto3
from botocore.config import Config
from django.conf import settings
from django.utils import timezone

from core.clamav_client import ensure_clean_upload
from core.upload_security import SecureUploadError


VIDEO_EXTENSIONS = {".mp4", ".webm"}
VIDEO_OUTPUT_BUCKET_ENV = "SUPABASE_STORAGE_BUCKET"
VIDEO_TEMP_BUCKET_ENV = "SUPABASE_VIDEO_TEMP_BUCKET"

# Conservative school-video profile: max 720p, H.264/AAC, fast-start MP4.
FFMPEG_VIDEO_CRF = "26"
FFMPEG_PRESET = os.environ.get("PIXIU_FFMPEG_PRESET", "medium")
FFMPEG_AUDIO_BITRATE = os.environ.get("PIXIU_FFMPEG_AUDIO_BITRATE", "96k")


def _s3_config():
    endpoint = str(getattr(settings, "SUPABASE_STORAGE_ENDPOINT", "")).strip()
    region = str(getattr(settings, "SUPABASE_STORAGE_REGION", "ap-south-1")).strip()
    access_key = str(getattr(settings, "SUPABASE_STORAGE_ACCESS_KEY", "")).strip()
    secret_key = str(getattr(settings, "SUPABASE_STORAGE_SECRET_KEY", "")).strip()
    if not endpoint or not access_key or not secret_key:
        raise RuntimeError("Supabase Storage S3 credentials are not configured.")

    addressing_style = os.environ.get("AWS_S3_ADDRESSING_STYLE", "path").strip()
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region or None,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(s3={"addressing_style": addressing_style or "path"}),
    )


def final_bucket() -> str:
    bucket = str(getattr(settings, "SUPABASE_STORAGE_BUCKET", "")).strip()
    if not bucket:
        raise RuntimeError("SUPABASE_STORAGE_BUCKET is not configured.")
    return bucket


def final_storage_location() -> str:
    return str(getattr(settings, "AWS_LOCATION", os.environ.get("AWS_LOCATION", "pixiu-media"))).strip("/")


def final_physical_key(relative_key: str) -> str:
    relative_key = str(relative_key or "").lstrip("/")
    location = final_storage_location()
    return f"{location}/{relative_key}" if location else relative_key


def temp_bucket() -> str:
    bucket = os.environ.get(VIDEO_TEMP_BUCKET_ENV, "pixiu-video-temp").strip()
    if not bucket:
        raise RuntimeError("SUPABASE_VIDEO_TEMP_BUCKET is not configured.")
    return bucket


def upload_temp_video(uploaded: BinaryIO, content_id: str, extension: str) -> tuple[str, int]:
    extension = extension.lower()
    if extension not in VIDEO_EXTENSIONS:
        raise SecureUploadError("Only MP4 and WebM videos are supported.")

    key = f"incoming/{timezone.now():%Y/%m}/{content_id}/{uuid4().hex}{extension}"
    client = _s3_config()
    if hasattr(uploaded, "seek"):
        uploaded.seek(0)

    client.upload_fileobj(
        uploaded,
        temp_bucket(),
        key,
        ExtraArgs={"ContentType": "video/mp4" if extension == ".mp4" else "video/webm"},
    )

    size = int(getattr(uploaded, "size", 0) or 0)
    return key, size


def delete_object(bucket: str, key: str) -> None:
    if not key:
        return
    _s3_config().delete_object(Bucket=bucket, Key=key)


def delete_final_object(relative_key: str) -> None:
    if not relative_key:
        return
    delete_object(final_bucket(), final_physical_key(relative_key))


def object_exists(bucket: str, key: str) -> bool:
    try:
        _s3_config().head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


def _download_to_file(bucket: str, key: str, destination: Path) -> None:
    client = _s3_config()
    destination.parent.mkdir(parents=True, exist_ok=True)
    client.download_file(bucket, key, str(destination))


def _upload_final(source: Path, key: str) -> None:
    client = _s3_config()
    client.upload_file(
        str(source),
        final_bucket(),
        final_physical_key(key),
        ExtraArgs={"ContentType": "video/mp4", "CacheControl": "private, no-store, max-age=0"},
    )


def _probe(path: Path) -> dict:
    command = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height",
        "-of", "json",
        str(path),
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return json.loads(result.stdout or "{}")


def _validate_and_scan_output(path: Path) -> None:
    if path.suffix.lower() != ".mp4":
        raise SecureUploadError("Optimized video must be an MP4 file.")
    size = path.stat().st_size
    if size <= 0:
        raise SecureUploadError("Optimized video is empty.")
    max_bytes = int(getattr(settings, "SECURE_VIDEO_MAX_BYTES", 500 * 1024 * 1024))
    if size > max_bytes:
        raise SecureUploadError("Optimized video exceeds the configured size limit.")

    with path.open("rb") as stream:
        signature = stream.read(16)
        if len(signature) < 8 or signature[4:8] != b"ftyp":
            raise SecureUploadError("Optimized video failed MP4 signature validation.")
        stream.seek(0)
        ensure_clean_upload(stream)


def process_video_content(content_id: str) -> dict:
    from learning.models import LearningContent

    content = LearningContent.objects.get(pk=content_id, content_type="video")
    temp_key = str(content.video_temp_key or "").strip()
    if not temp_key or not object_exists(temp_bucket(), temp_key):
        raise FileNotFoundError("Temporary video upload is missing.")

    workdir = Path(tempfile.mkdtemp(prefix="pixiu-video-"))
    source = workdir / ("source" + Path(content.video_original_name or ".mp4").suffix.lower())
    output = workdir / "optimized.mp4"

    try:
        _download_to_file(temp_bucket(), temp_key, source)

        probe = _probe(source)
        duration = int(max(0, round(float(probe.get("format", {}).get("duration") or 0))))
        video_stream = next(
            (stream for stream in probe.get("streams", []) if stream.get("codec_type") == "video"),
            None,
        )
        if not video_stream:
            raise SecureUploadError("No video stream was found in the uploaded file.")

        width = int(video_stream.get("width") or 0) or None
        height = int(video_stream.get("height") or 0) or None

        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", str(source),
            "-map", "0:v:0",
            "-map", "0:a?",
            "-vf", "scale=1280:720:force_original_aspect_ratio=decrease",
            "-c:v", "libx264",
            "-preset", FFMPEG_PRESET,
            "-crf", FFMPEG_VIDEO_CRF,
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", FFMPEG_AUDIO_BITRATE,
            "-movflags", "+faststart",
            "-map_metadata", "-1",
            str(output),
        ]
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=60 * 60)

        optimized_probe = _probe(output)
        optimized_stream = next(
            (stream for stream in optimized_probe.get("streams", []) if stream.get("codec_type") == "video"),
            None,
        )
        final_width = int(optimized_stream.get("width") or width or 0) or None
        final_height = int(optimized_stream.get("height") or height or 0) or None
        final_duration = int(max(0, round(float(optimized_probe.get("format", {}).get("duration") or duration))))

        _validate_and_scan_output(output)

        final_key = f"videos/{timezone.now():%Y/%m}/{content.id}.mp4"
        _upload_final(output, final_key)

        return {
            "file_key": final_key,
            "size": int(output.stat().st_size),
            "duration": final_duration,
            "width": final_width,
            "height": final_height,
        }
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
