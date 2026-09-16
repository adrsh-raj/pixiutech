from django.core.files.storage import default_storage
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import Trainer
from learning.models import LearningContent
from notifications.models import Notification, NotificationType
from .upload_security import SecureMultiPartParser, SecureUploadError, validate_uploaded_file

MATERIAL_MARKER = "trainer_material_id"
MAX_FILE_SIZE = 20 * 1024 * 1024


def _serialize(material, target="ALL"):
    return {
        "id": str(material.id),
        "title": material.title,
        "description": material.description,
        "class_grade": material.grade,
        "level": material.level,
        "target_trainer_id": target,
        "type": "PDF",
        "created_at": material.created_at,
    }


def _allowed_material_ids(user):
    return {
        str(row.metadata.get(MATERIAL_MARKER))
        for row in Notification.objects.filter(recipient=user)
        if isinstance(row.metadata, dict) and row.metadata.get(MATERIAL_MARKER)
    }


class TrainerMaterialListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]
    parser_classes = [SecureMultiPartParser, FormParser]
    throttle_scope = "trainer_material_upload"

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    def get(self, request):
        if request.user.role == UserRole.ADMIN:
            materials = LearningContent.objects.filter(
                target_role="trainer", content_type="pdf", status="published"
            ).order_by("-created_at")
            output = []
            for material in materials:
                note = Notification.objects.filter(
                    metadata__contains={MATERIAL_MARKER: str(material.id)}
                ).order_by("created_at").first()
                target = (note.metadata or {}).get("target_trainer_id", "ALL") if note else "ALL"
                output.append(_serialize(material, target))
            return Response(output)

        if request.user.role != UserRole.TRAINER:
            raise PermissionDenied("Only administrators and trainers can access trainer materials.")

        ids = _allowed_material_ids(request.user)
        if not ids:
            return Response([])
        materials = LearningContent.objects.filter(
            id__in=ids, target_role="trainer", content_type="pdf", status="published"
        ).order_by("-created_at")
        return Response([_serialize(material, "ALL") for material in materials])

    def post(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only administrators can send trainer materials.")

        uploaded = request.FILES.get("file")
        title = str(request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "Material title is required."})
        if uploaded is None:
            raise ValidationError({"file": "A PDF file is required."})
        if uploaded.size > MAX_FILE_SIZE:
            raise ValidationError({"file": "PDF must be 20 MB or smaller."})
        try:
            validate_uploaded_file(uploaded)
        except SecureUploadError as exc:
            raise ValidationError({"file": exc.messages}) from exc
        if uploaded.name.rsplit(".", 1)[-1].lower() != "pdf":
            raise ValidationError({"file": "Trainer materials must be PDF files."})

        grade = str(request.data.get("class_grade") or "").strip()
        if grade and not grade.isdigit():
            raise ValidationError({"class_grade": "Class / Grade must be numeric."})
        level = str(request.data.get("level") or "").strip()
        target = str(request.data.get("target_trainer_id") or "ALL").strip()

        trainer = None
        if target != "ALL":
            trainer = Trainer.objects.filter(pk=target).select_related("account").first()
            if trainer is None or trainer.account_id is None or trainer.status != "active" or not trainer.account.is_active:
                raise ValidationError({"target_trainer_id": "Selected active trainer was not found."})

        material = LearningContent.objects.create(
            title=title,
            description=str(request.data.get("description") or ""),
            content_type="pdf",
            grade=grade,
            level=level,
            target_role="trainer",
            status="published",
            is_watermarked=False,
            created_by=request.user,
        )
        try:
            material.file.save(uploaded.name, uploaded, save=True)
            if trainer:
                recipients = [trainer.account]
            else:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                account_ids = Trainer.objects.filter(
                    status="active", account__is_active=True
                ).values_list("account_id", flat=True)
                recipients = list(User.objects.filter(
                    id__in=account_ids, is_active=True, role=UserRole.TRAINER
                ))
            for recipient in recipients:
                Notification.objects.create(
                    recipient=recipient,
                    notification_type=NotificationType.INFO,
                    title=f"Trainer material: {title}",
                    message="A private trainer teaching PDF has been assigned to you.",
                    event_key=f"trainer-material:{material.id}:{recipient.id}",
                    metadata={MATERIAL_MARKER: str(material.id), "target_trainer_id": target},
                )
        except Exception:
            if material.file:
                material.file.delete(save=False)
            material.delete()
            raise
        return Response(_serialize(material, target), status=status.HTTP_201_CREATED)


class TrainerMaterialDetailView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def _get_material(self, pk):
        return get_object_or_404(
            LearningContent,
            pk=pk,
            target_role="trainer",
            content_type="pdf",
            status="published",
        )

    def delete(self, request, pk):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only administrators can delete trainer materials.")
        material = self._get_material(pk)
        Notification.objects.filter(metadata__contains={MATERIAL_MARKER: str(material.id)}).delete()
        if material.file:
            material.file.delete(save=False)
        material.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TrainerMaterialFileView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request, pk):
        material = get_object_or_404(
            LearningContent,
            pk=pk,
            target_role="trainer",
            content_type="pdf",
            status="published",
        )
        allowed = request.user.role == UserRole.ADMIN or str(pk) in _allowed_material_ids(request.user)
        if not allowed:
            raise PermissionDenied("You are not allowed to open this trainer material.")
        if not material.file or not default_storage.exists(material.file.name):
            return Response({"error": "Material file is unavailable."}, status=status.HTTP_404_NOT_FOUND)
        handle = material.file.open("rb")
        response = FileResponse(handle, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{material.file.name.rsplit("/", 1)[-1]}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response
