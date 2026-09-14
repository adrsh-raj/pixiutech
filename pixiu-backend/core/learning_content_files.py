from pathlib import Path

from django.core.files.storage import default_storage
from django.db import connection
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from learning.models import LearningContent
from learning.services import accessible_content


def _backup_file(content_id):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT file_name, content_type, data FROM learning_content_file_backup WHERE content_id = %s",
            [str(content_id)],
        )
        return cursor.fetchone()


class LearningContentFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        content = get_object_or_404(LearningContent, pk=pk, status="published")
        if not accessible_content(request.user).filter(pk=content.pk).exists():
            raise PermissionDenied("You are not allowed to open this learning material.")

        filename = Path(content.file.name).name if content.file else f"learning-material-{content.pk}"
        if content.file and default_storage.exists(content.file.name):
            handle = content.file.open("rb")
            content_type = "application/octet-stream"
            suffix = Path(filename).suffix.lower()
            if suffix == ".pdf":
                content_type = "application/pdf"
            elif suffix in {".png", ".jpg", ".jpeg", ".webp"}:
                content_type = f"image/{'jpeg' if suffix in {'.jpg', '.jpeg'} else suffix[1:]}"

            response = FileResponse(handle, content_type=content_type)
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            response["X-Content-Type-Options"] = "nosniff"
            return response

        # Render's local media filesystem is ephemeral. New uploads are backed
        # up in PostgreSQL so protected learning files remain readable after a
        # restart/deploy even when the original FileField object is gone.
        backup = _backup_file(content.pk)
        if backup:
            backup_name, backup_type, data = backup
            response = HttpResponse(bytes(data), content_type=backup_type or "application/octet-stream")
            response["Content-Disposition"] = f'inline; filename="{backup_name}"'
            response["X-Content-Type-Options"] = "nosniff"
            return response

        return Response({"error": "Learning content file is unavailable."}, status=status.HTTP_404_NOT_FOUND)
