from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .views import AuditLogViewSet
from accounts.models import User, UserRole
from .models import AuditAction, AuditLog
from .services import record_audit

class AuditTests(TestCase):
    def test_admin_can_permanently_delete_audit_log_after_password_reverification(self):
        user = User.objects.create_user(
            "delete-admin",
            "correct-password",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        log = record_audit(
            actor=user,
            action="create",
            entity_type="Invoice",
            entity_id="42",
            summary="Test audit event",
        )

        factory = APIRequestFactory()
        request = factory.post(
            f"/api/v1/logs/{log.pk}/permanent-delete",
            {"password": "correct-password"},
            format="json",
        )
        force_authenticate(request, user=user)
        response = AuditLogViewSet.as_view({"post": "permanent_delete"})(request, pk=log.pk)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(AuditLog.objects.filter(pk=log.pk).exists())
        deletion_log = AuditLog.objects.filter(
            actor=user,
            entity_type="AuditLog",
            entity_id=str(log.pk),
            action=AuditAction.DELETE,
        ).first()
        self.assertIsNotNone(deletion_log)

    def test_admin_cannot_permanently_delete_audit_log_with_wrong_password(self):
        user = User.objects.create_user(
            "delete-admin-wrong",
            "correct-password",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        log = record_audit(
            actor=user,
            action="create",
            entity_type="Invoice",
            entity_id="43",
            summary="Protected audit event",
        )

        factory = APIRequestFactory()
        request = factory.post(
            f"/api/v1/logs/{log.pk}/permanent-delete",
            {"password": "wrong-password"},
            format="json",
        )
        force_authenticate(request, user=user)
        response = AuditLogViewSet.as_view({"post": "permanent_delete"})(request, pk=log.pk)

        self.assertEqual(response.status_code, 403)
        self.assertTrue(AuditLog.objects.filter(pk=log.pk).exists())

    def test_audit_log_is_append_only(self):
        user=User.objects.create_user("audit-admin","strong-pass",role=UserRole.ADMIN,is_staff=True)
        log=record_audit(actor=user,action="create",entity_type="Invoice",entity_id="1",summary="Created invoice")
        with self.assertRaises(ValueError):
            log.summary="Changed"; log.save()
        with self.assertRaises(ValueError):
            log.delete()
