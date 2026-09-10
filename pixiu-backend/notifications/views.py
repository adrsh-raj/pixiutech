from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import School, SchoolClass, Student, Trainer
from audit.services import record_audit
from .models import Notification, NotificationPreference, NotificationType
from .serializers import NotificationSerializer, NotificationPreferenceSerializer

User = get_user_model()
TARGET_TYPES = {"all_schools", "specific_school", "specific_trainer", "specific_class", "all_trainers", "all_students", "universal"}


def resolve(model, value, code_field=None):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        obj = model.objects.filter(pk=raw).first()
    except (TypeError, ValueError):
        obj = None
    if obj or not code_field:
        return obj
    return model.objects.filter(**{f"{code_field}__iexact": raw}).first()


class NotificationPortalViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.select_related("recipient").order_by("-created_at")
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, IsActiveAccount]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        # A portal inbox is always recipient-scoped.  Admins may create
        # notifications, but they must not see school/trainer/student copies
        # merely because they are the sender.  This also makes read/read-all
        # operate on the exact same recipient-scoped queryset and prevents a
        # false 404/"No Notification matches the given query" when an admin
        # clicks a notification that belongs to another user.
        return self.queryset.filter(recipient=self.request.user)

    @staticmethod
    def output(obj):
        metadata = obj.metadata or {}
        return {
            "id": str(obj.id), "title": obj.title, "message": obj.message, "type": obj.notification_type,
            "severity": metadata.get("severity", "info"), "read": bool(obj.read_at), "created_at": obj.created_at,
            "target_type": metadata.get("target_type", "user"), "target_school_id": metadata.get("target_school_id", ""),
            "target_school_code": metadata.get("target_school_code", ""), "target_trainer_id": metadata.get("target_trainer_id", ""),
            "target_class_id": metadata.get("target_class_id", ""), "target_class_name": metadata.get("target_class_name", ""),
            "broadcast_key": metadata.get("broadcast_key", ""), "recipient_id": str(obj.recipient_id),
        }

    def list(self, request, *args, **kwargs):
        return Response([self.output(obj) for obj in self.get_queryset()])

    def retrieve(self, request, *args, **kwargs):
        return Response(self.output(self.get_object()))

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.output(notification))

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"updated": updated})

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Only administrators can send targeted notifications.")
        title = str(request.data.get("title", "")).strip()
        message = str(request.data.get("message", "")).strip()
        target_type = str(request.data.get("target_type", "")).strip().lower()
        notification_type = str(request.data.get("notification_type", request.data.get("type", "info"))).strip().lower()
        severity = str(request.data.get("severity", "info")).strip().lower()
        if not title: raise ValidationError({"title": "Notification title is required."})
        if not message: raise ValidationError({"message": "Notification message is required."})
        if target_type not in TARGET_TYPES: raise ValidationError({"target_type": "Unsupported notification target."})
        if notification_type not in {x.value for x in NotificationType}: raise ValidationError({"notification_type": "Unsupported notification type."})
        if severity not in {"info", "warning", "urgent", "success"}: raise ValidationError({"severity": "Unsupported notification severity."})

        school = resolve(School, request.data.get("target_school_id"), "school_code") if target_type == "specific_school" else None
        trainer = resolve(Trainer, request.data.get("target_trainer_id"), "trainer_id") if target_type == "specific_trainer" else None
        school_class = resolve(SchoolClass, request.data.get("target_class_id")) if target_type == "specific_class" else None
        if target_type == "specific_school" and not school: raise ValidationError({"target_school_id": "A valid school is required."})
        if target_type == "specific_trainer" and not trainer: raise ValidationError({"target_trainer_id": "A valid trainer is required."})
        if target_type == "specific_class" and not school_class: raise ValidationError({"target_class_id": "A valid class is required."})

        if target_type == "all_schools":
            recipient_ids = list(User.objects.filter(role=UserRole.SCHOOL, is_active=True).values_list("id", flat=True))
        elif target_type == "specific_school":
            ids = []
            if school.account_id and school.account.is_active: ids.append(school.account_id)
            ids += list(User.objects.filter(role=UserRole.TRAINER, is_active=True, trainer_profile__school_assignments__school=school, trainer_profile__school_assignments__status="active").values_list("id", flat=True).distinct())
            ids += list(User.objects.filter(role=UserRole.STUDENT, is_active=True, student_profile__school_class__school=school).values_list("id", flat=True).distinct())
            recipient_ids = ids
        elif target_type == "specific_trainer":
            recipient_ids = [trainer.account_id] if trainer.account_id and trainer.account.is_active else []
        elif target_type == "specific_class":
            recipient_ids = list(User.objects.filter(role=UserRole.STUDENT, is_active=True, student_profile__school_class=school_class).values_list("id", flat=True).distinct())
        elif target_type == "all_trainers":
            recipient_ids = list(User.objects.filter(role=UserRole.TRAINER, is_active=True).values_list("id", flat=True))
        elif target_type == "all_students":
            recipient_ids = list(User.objects.filter(role=UserRole.STUDENT, is_active=True).values_list("id", flat=True))
        else:
            recipient_ids = list(User.objects.filter(is_active=True).exclude(role=UserRole.ADMIN).values_list("id", flat=True))

        recipient_ids = list(dict.fromkeys(recipient_ids))
        if not recipient_ids: raise ValidationError({"target_type": "There are no active recipients for this target."})

        broadcast_key = str(request.data.get("event_key") or uuid4())
        metadata = {"target_type": target_type, "severity": severity, "broadcast_key": broadcast_key}
        if school: metadata.update({"target_school_id": str(school.id), "target_school_code": school.school_code})
        if trainer: metadata["target_trainer_id"] = str(trainer.id)
        if school_class: metadata.update({"target_class_id": str(school_class.id), "target_class_name": school_class.display_name})

        created = []
        with transaction.atomic():
            for recipient_id in recipient_ids:
                obj, _ = Notification.objects.get_or_create(
                    recipient_id=recipient_id, event_key=f"{broadcast_key}:{recipient_id}",
                    defaults={"notification_type": notification_type, "title": title[:200], "message": message, "metadata": metadata},
                )
                created.append(obj)
            record_audit(actor=request.user, action="create", entity_type="notification", entity_id=broadcast_key,
                         summary=f"Targeted notification sent to {len(created)} recipients",
                         changes={"target_type": target_type, "recipient_count": len(created), "severity": severity}, request=request)
        return Response([self.output(obj) for obj in created], status=status.HTTP_201_CREATED)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount]
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()
    def get_queryset(self): return self.queryset.filter(recipient=self.request.user)
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification = self.get_object(); notification.read_at = timezone.now(); notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"updated": updated}, status=status.HTTP_200_OK)


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount]
    serializer_class = NotificationPreferenceSerializer
    queryset = NotificationPreference.objects.all()
    http_method_names = ["get", "post", "put", "patch"]
    def get_queryset(self): return self.queryset.filter(user=self.request.user)
    def perform_create(self, serializer): serializer.save(user=self.request.user)
    def perform_update(self, serializer):
        if serializer.instance.user_id != self.request.user.id: raise PermissionDenied("You cannot edit another user's notification preferences.")
        serializer.save()
