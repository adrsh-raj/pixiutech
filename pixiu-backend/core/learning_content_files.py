from pathlib import Path

from django.core.files.storage import default_storage
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import DatabaseError, connection
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsActiveAccount
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from accounts.models import User, UserStatus
from learning.models import LearningContent
from learning.services import accessible_content


PLAYBACK_TOKEN_MAX_AGE = 60 * 60
_playback_signer = TimestampSigner(salt="pixiu-learning-video-playback")


def _backup_file(content_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT file_name, content_type, data FROM learning_content_file_backup WHERE content_id = %s",
                [str(content_id)],
            )
            return cursor.fetchone()
    except DatabaseError:
        return None


def _content_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
    }.get(suffix, "application/octet-stream")


def _stream_storage_file(file_name, content_type, request):
    size = default_storage.size(file_name)
    range_header = request.headers.get("Range", "")
    handle = default_storage.open(file_name, "rb")

    if not range_header:
        response = FileResponse(handle, content_type=content_type)
        response["Content-Length"] = str(size)
        response["Accept-Ranges"] = "bytes"
        response["Content-Disposition"] = "inline"
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["Pragma"] = "no-cache"
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["Referrer-Policy"] = "no-referrer"
        return response

    if not range_header.startswith("bytes=") or "," in range_header:
        handle.close()
        return Response({"error": "Invalid byte range."}, status=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE)

    raw_range = range_header[6:].strip()
    try:
        start_text, end_text = raw_range.split("-", 1)
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else size - 1
        else:
            suffix_length = int(end_text)
            start = max(0, size - suffix_length)
            end = size - 1
        if start < 0 or end < start or start >= size:
            raise ValueError
        end = min(end, size - 1)
    except (ValueError, TypeError):
        handle.close()
        response = Response({"error": "Requested byte range is not satisfiable."}, status=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE)
        response["Content-Range"] = f"bytes */{size}"
        return response

    length = end - start + 1
    handle.seek(start)

    def chunks():
        remaining = length
        try:
            while remaining > 0:
                chunk = handle.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
        finally:
            handle.close()

    response = StreamingHttpResponse(chunks(), status=206, content_type=content_type)
    response["Content-Length"] = str(length)
    response["Content-Range"] = f"bytes {start}-{end}/{size}"
    response["Accept-Ranges"] = "bytes"
    response["Content-Disposition"] = "inline"
    response["Cache-Control"] = "private, no-store, max-age=0"
    response["Pragma"] = "no-cache"
    response["X-Content-Type-Options"] = "nosniff"
    response["X-Frame-Options"] = "DENY"
    response["Referrer-Policy"] = "no-referrer"
    return response


class LearningContentPlaybackTokenView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request, pk):
        content = get_object_or_404(LearningContent, pk=pk, status="published", content_type="video")
        if not accessible_content(request.user).filter(pk=content.pk).exists():
            raise PermissionDenied("You are not allowed to open this learning video.")
        if not content.file or not default_storage.exists(content.file.name):
            return Response({"error": "Learning video is unavailable."}, status=status.HTTP_404_NOT_FOUND)

        token = _playback_signer.sign(f"{content.pk}:{request.user.pk}")
        return Response({
            "id": str(content.pk),
            "video_url": f"/api/v1/content/{content.pk}/video?token={token}",
            "expires_in": PLAYBACK_TOKEN_MAX_AGE,
        })


class LearningContentVideoView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, pk):
        token = str(request.query_params.get("token") or "").strip()
        if not token:
            raise PermissionDenied("A playback token is required.")
        try:
            payload = _playback_signer.unsign(token, max_age=PLAYBACK_TOKEN_MAX_AGE)
            content_id, user_id = str(payload).split(":", 1)
        except (BadSignature, SignatureExpired, ValueError):
            raise PermissionDenied("This playback session has expired.")

        if content_id != str(pk):
            raise PermissionDenied("This playback token is not valid for this video.")

        user = get_object_or_404(User, pk=user_id, is_active=True, status=UserStatus.ACTIVE)
        content = get_object_or_404(LearningContent, pk=pk, status="published", content_type="video")
        if not accessible_content(user).filter(pk=content.pk).exists():
            raise PermissionDenied("You are not allowed to open this learning video.")
        if not content.file or not default_storage.exists(content.file.name):
            return Response({"error": "Learning video is unavailable."}, status=status.HTTP_404_NOT_FOUND)

        return _stream_storage_file(content.file.name, _content_type(content.file.name), request)


class LearningContentFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        content = get_object_or_404(LearningContent, pk=pk, status="published")
        if content.content_type == "video":
            return Response({"error": "Videos use the protected playback endpoint."}, status=status.HTTP_400_BAD_REQUEST)
        if not accessible_content(request.user).filter(pk=content.pk).exists():
            raise PermissionDenied("You are not allowed to open this learning material.")

        filename = Path(content.file.name).name if content.file else f"learning-material-{content.pk}"
        if content.file and default_storage.exists(content.file.name):
            handle = content.file.open("rb")
            response = FileResponse(handle, content_type=_content_type(filename))
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            response["Cache-Control"] = "private, no-store, max-age=0"
            response["X-Content-Type-Options"] = "nosniff"
            return response

        backup = _backup_file(content.pk)
        if backup:
            backup_name, backup_type, data = backup
            response = HttpResponse(bytes(data), content_type=backup_type or "application/octet-stream")
            response["Content-Disposition"] = f'inline; filename="{backup_name}"'
            response["Cache-Control"] = "private, no-store, max-age=0"
            response["X-Content-Type-Options"] = "nosniff"
            return response

        return Response({"error": "Learning content file is unavailable."}, status=status.HTTP_404_NOT_FOUND)
