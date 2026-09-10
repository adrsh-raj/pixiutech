from django.core.files.storage import default_storage
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.models import UserRole
from learning.models import LearningContent
from learning.services import accessible_content


class LearningContentFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        content = get_object_or_404(accessible_content(request.user), pk=pk)
        if request.user.role == UserRole.STUDENT and content.status != "published":
            raise PermissionDenied("This content is not published.")
        if not content.file or not default_storage.exists(content.file.name):
            raise ValidationError("This content has no uploaded file.")

        content_type = "application/octet-stream"
        if content.content_type == "pdf":
            content_type = "application/pdf"
        elif content.content_type == "image":
            extension = content.file.name.rsplit(".", 1)[-1].lower() if "." in content.file.name else "png"
            content_type = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "webp": "image/webp",
            }.get(extension, "image/png")

        response = FileResponse(content.file.open("rb"), content_type=content_type)
        response["Content-Disposition"] = f'inline; filename="{content.file.name.rsplit("/", 1)[-1]}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response
