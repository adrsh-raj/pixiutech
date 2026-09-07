from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import Student, Trainer
from billing.models import Invoice
from billing.services import add_invoice_line, recalculate_invoice, update_invoice_line
from crm.models import CommunicationLog
from crm.serializers import CommunicationLogSerializer
from notifications.models import Notification, NotificationType

from .api_v1_compat import ContractBillingViewSet, ContractNotificationViewSet, _first, _school, _student

LEGACY_INVOICE_STATUS = {"pending": "issued", "pending_verification": "issued", "paid": "paid", "partially_paid": "partially_paid", "overdue": "overdue", "draft": "draft", "issued": "issued", "void": "void"}

def normalize_invoice_status(value):
    return LEGACY_INVOICE_STATUS.get(str(value or "").strip().lower().replace(" ", "_"), "issued")

class ContractBillingFullViewSet(ContractBillingViewSet):
    def _legacy_lines(self, request):
        lines = request.data.get("lines") or request.data.get("items")
        if isinstance(lines, dict): lines = [lines]
        if not isinstance(lines, list): lines = []
        if not lines:
            lines = [{"description": request.data.get("tranche_title") or request.data.get("title") or "STEM Robotics & Lab Operations", "quantity": 1, "unit_price": _first(request.data, "amount", "total_amount", default=0)}]
        return lines

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
            response = super().create(request, *args, **kwargs)
            invoice = Invoice.objects.filter(pk=response.data.get("id")).first() if isinstance(response.data, dict) else None
            if invoice is None: raise ValidationError("Invoice was created but could not be reloaded.")
            requested_status = normalize_invoice_status(request.data.get("status", "draft"))
            for line in self._legacy_lines(request):
                add_invoice_line(invoice=invoice, description=str(_first(line, "description", "tranche_title", "title", default="STEM Robotics & Lab Operations"))[:250], quantity=_first(line, "quantity", "qty", default=1), unit_price=_first(line, "unit_price", "amount", "price", default=0))
            recalculate_invoice(invoice); invoice.refresh_from_db()
            if requested_status != "draft":
                invoice.status = requested_status; invoice.save(update_fields=["status", "updated_at"])
            response.data = self.map_out(invoice)
        return response

    def update(self, request, *args, **kwargs):
        invoice = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        with transaction.atomic():
            changed = []
            if "due_date" in request.data: invoice.due_date = request.data.get("due_date"); changed.append("due_date")
            issue_date = _first(request.data, "date_issued", "invoice_date", "issue_date")
            if issue_date is not None: invoice.issue_date = issue_date; changed.append("issue_date")
            if "status" in request.data: invoice.status = normalize_invoice_status(request.data.get("status")); changed.append("status")
            if changed: invoice.save(update_fields=[*changed, "updated_at"])
            title = _first(request.data, "tranche_title", "title"); amount = _first(request.data, "amount", "total_amount"); line = invoice.lines.first()
            if title is not None or amount is not None:
                if line is None: add_invoice_line(invoice=invoice, description=str(title or "STEM Robotics & Lab Operations")[:250], quantity=1, unit_price=amount or 0)
                else: update_invoice_line(line=line, description=str(title if title is not None else line.description)[:250], quantity=line.quantity, unit_price=amount if amount is not None else line.unit_price)
                recalculate_invoice(invoice)
            invoice.refresh_from_db()
        return Response(self.map_out(invoice))

    @action(detail=True, methods=["put"], url_path="status")
    def status_change(self, request, pk=None):
        invoice = self.get_object(); self.role_only(UserRole.ADMIN, UserRole.SCHOOL); invoice.status = normalize_invoice_status(request.data.get("status", invoice.status)); invoice.save(update_fields=["status", "updated_at"]); return Response(self.map_out(invoice))

class ContractNotificationFullViewSet(ContractNotificationViewSet):
    def get_queryset(self):
        if getattr(self.request.user, "role", None) == UserRole.ADMIN: return Notification.objects.all().order_by("-created_at")
        return super().get_queryset()
    def update(self, request, *args, **kwargs):
        notification = self.get_object()
        if request.user.role != UserRole.ADMIN: raise PermissionDenied("Only administrators can edit broadcast notifications.")
        notification.title = str(_first(request.data, "title", default=notification.title))[:200]; notification.message = str(_first(request.data, "message", default=notification.message))
        metadata = dict(notification.metadata or {})
        for key in ("target_type", "target_school_id", "target_classes", "scheduled_date", "scheduled_time", "severity", "template_type"):
            if key in request.data: metadata[key] = request.data.get(key)
        notification.metadata = metadata; kind = str(_first(request.data, "notification_type", "type", default=notification.notification_type)).lower(); notification.notification_type = kind if kind in {x.value for x in NotificationType} else NotificationType.INFO
        notification.save(update_fields=["title", "message", "metadata", "notification_type"]); return Response(self.map_out(notification))
    def destroy(self, request, *args, **kwargs):
        if request.user.role != UserRole.ADMIN: raise PermissionDenied("Only administrators can delete broadcast notifications.")
        self.get_object().delete(); return Response(status=status.HTTP_204_NO_CONTENT)
    def map_out(self, obj):
        metadata = obj.metadata or {}; return {"id": str(obj.pk), "title": obj.title, "message": obj.message, "type": obj.notification_type, "severity": metadata.get("severity", "info"), "read": bool(obj.read_at), "created_at": obj.created_at, "target_type": metadata.get("target_type", "User"), "target_school_id": metadata.get("target_school_id", ""), "target_classes": metadata.get("target_classes", ""), "scheduled_date": metadata.get("scheduled_date", ""), "scheduled_time": metadata.get("scheduled_time", ""), "template_type": metadata.get("template_type", ""), "target_user_id": obj.recipient_id}
    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.ADMIN: raise PermissionDenied("Only administrators can send targeted notifications.")
        target_type = str(request.data.get("target_type", "Universal")).strip().lower(); school = _school(request.data.get("target_school_id")); grades = {str(x).strip().upper() for x in str(request.data.get("target_classes", "")).split(",") if str(x).strip()}; students = Student.objects.filter(status="active", account__is_active=True); trainers = Trainer.objects.filter(status="active", account__is_active=True)
        if school: students = students.filter(school_class__school=school); trainers = trainers.filter(school_assignments__school=school, school_assignments__status="active").distinct()
        if grades and target_type in {"all_students", "specific_class"}: students = students.filter(school_class__grade__in=grades)
        if target_type in {"all_students", "specific_class"}: recipients = [s.account for s in students.select_related("account") if s.account_id]
        elif target_type == "all_trainers": recipients = [t.account for t in trainers.select_related("account") if t.account_id]
        elif target_type in {"universal", "all"}: recipients = list(active_users())
        elif target_type == "school":
            if school is None: raise ValidationError({"target_school_id": "A valid target school is required."})
            recipients = [*list(s.account for s in students.select_related("account") if s.account_id), *list(t.account for t in trainers.select_related("account") if t.account_id)];
            if school.account_id: recipients.append(school.account)
        else: raise ValidationError({"target_type": "Unsupported notification target."})
        kind = str(_first(request.data, "notification_type", "type", default="info")).lower(); kind = kind if kind in {x.value for x in NotificationType} else NotificationType.INFO; base_key = str(_first(request.data, "event_key", default=f"broadcast-{timezone_timestamp()}")); metadata = {key: request.data.get(key) for key in ("target_type", "target_school_id", "target_classes", "scheduled_date", "scheduled_time", "severity", "template_type") if key in request.data}; created = []
        for recipient in {r for r in recipients if r and r.is_active}: created.append(Notification.objects.create(recipient=recipient, notification_type=kind, title=str(request.data.get("title", "Notification"))[:200], message=str(request.data.get("message", "")), event_key=f"{base_key}:{recipient.pk}", metadata=metadata))
        return Response([self.map_out(obj) for obj in created], status=status.HTTP_201_CREATED)

def timezone_timestamp():
    from django.utils import timezone
    return timezone.now().timestamp()

def active_users():
    from django.contrib.auth import get_user_model
    return get_user_model().objects.filter(is_active=True)

class ContractCommunicationLogViewSet(viewsets.ModelViewSet):
    queryset = CommunicationLog.objects.select_related("student", "actor"); serializer_class = CommunicationLogSerializer; permission_classes = [IsAuthenticated]; http_method_names = ["get", "post", "head", "options"]
    def get_queryset(self):
        qs = self.queryset
        if self.request.user.role == UserRole.ADMIN: return qs
        if self.request.user.role in {UserRole.SCHOOL, UserRole.TRAINER}: return qs.filter(student__school_class__school__account_id=self.request.user.id)
        if self.request.user.role == UserRole.STUDENT: return qs.filter(student__account_id=self.request.user.id)
        return qs.none()
    def create(self, request, *args, **kwargs):
        if self.request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL}: raise PermissionDenied("Only administrators and school accounts can log parent communications.")
        student = _student(request.data.get("student_id") or request.data.get("student"));
        if student is None: raise ValidationError({"student_id": "Student does not exist."})
        if request.user.role == UserRole.SCHOOL and student.school_class.school.account_id != request.user.id: raise PermissionDenied("You cannot log a message for another school.")
        payload = {"student": str(student.pk), "recipient": _first(request.data, "recipient", default="Parent"), "channel": _first(request.data, "channel", default="whatsapp"), "template": _first(request.data, "template", default=""), "message": _first(request.data, "message", default=""), "status": _first(request.data, "status", default="Queued")}; serializer = self.get_serializer(data=payload); serializer.is_valid(raise_exception=True); return Response(self.get_serializer(serializer.save(actor=request.user)).data, status=status.HTTP_201_CREATED)
