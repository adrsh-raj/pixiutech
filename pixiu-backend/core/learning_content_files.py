from pathlib import Path

from django.core.files.storage import default_storage
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from learning.models import LearningContent
from learning.services import accessible_content


class LearningContentFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        content = get_object_or_404(LearningContent, pk=pk, status="published")
        if not accessible_content(request.user).filter(pk=content.pk).exists():
            raise PermissionDenied("You are not allowed to open this learning material.")
        if not content.file or not default_storage.exists(content.file.name):
            return Response({"error": "Learning content file is unavailable."}, status=status.HTTP_404_NOT_FOUND)

        handle = content.file.open("rb")
        filename = Path(content.file.name).name
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
