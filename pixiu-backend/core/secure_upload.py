"""Authenticated generic upload endpoint backed by centralized upload security."""

from pathlib import Path

from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from .upload_security import SecureMultiPartParser, secure_storage_name, validate_uploaded_file


class SecureUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [SecureMultiPartParser, FormParser]

    def post(self, request):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            raise PermissionDenied("Only administrators and trainers can upload files.")

        uploaded = request.FILES.get("file")
        if uploaded is None:
            raise ValidationError({"file": "A file is required."})

        validate_uploaded_file(uploaded)
        # validate_uploaded_file assigns a server-generated UUID filename.
        filename = secure_storage_name(uploaded.name)
        uploaded.name = filename
        path = default_storage.save(f"private_uploads/{filename}", uploaded)

        return Response(
            {
                "success": True,
                "filename": Path(path).name,
                "size": uploaded.size,
                "content_type": getattr(uploaded, "content_type", "") or "application/octet-stream",
                "url": default_storage.url(path),
            },
            status=status.HTTP_201_CREATED,
        )
