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
from .upload_security import SecureMultiPartParser, SecureUploadError, validate_uploaded_file


class SecureUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [SecureMultiPartParser, FormParser]

    def post(self, request):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            raise PermissionDenied("Only administrators and trainers can upload files.")

        uploaded = request.FILES.get("file")
        if uploaded is None:
            raise ValidationError({"file": "A file is required."})

        try:
            validate_uploaded_file(uploaded)
        except SecureUploadError as exc:
            raise ValidationError({"file": exc.messages}) from exc

        # The validator has replaced the client filename with a server-generated
        # UUID filename. Never put the submitted filename into the storage path.
        path = default_storage.save(f"private_uploads/{Path(uploaded.name).name}", uploaded)

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
