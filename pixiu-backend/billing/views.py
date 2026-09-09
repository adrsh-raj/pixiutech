from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from audit.services import record_audit

from .models import BillingStatus, Invoice, InvoiceLineItem, Payment, Receipt, PaymentStatus
from .serializers import InvoiceLineItemSerializer, InvoiceLineItemWriteSerializer, InvoiceSerializer, PaymentRecordSerializer, PaymentSerializer, ReceiptSerializer
from .services import add_invoice_line, record_payment, recalculate_invoice, update_invoice_line


class BillingScopedMixin:
    def initial(self, request, *args, **kwargs):
        mapping={"list":"VIEW","retrieve":"VIEW","create":"CREATE","update":"EDIT","partial_update":"EDIT","destroy":"DELETE","issue":"EDIT","void":"EDIT","record":"CREATE"}
        self.required_action=mapping.get(self.action,"VIEW")
        super().initial(request,*args,**kwargs)
    def role_only(self,*roles):
        if self.request.user.role not in roles: raise PermissionDenied("Your role cannot perform this operation.")


def _school_filter(qs, request, field="school"):
    school = request.query_params.get("school")
    if not school or field not in {"school", "invoice__school"}:
        return qs
    value = str(school).strip()
    from django.db.models import Q
    if field == "school":
        return qs.filter(Q(school__school_code=value.upper()) | Q(school_id=value))
    return qs.filter(Q(invoice__school__school_code=value.upper()) | Q(invoice__school_id=value))


class InvoiceViewSet(BillingScopedMixin,viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated,IsActiveAccount,HasActionPermission]
    queryset=Invoice.objects.select_related("school","school_class","trainer","contract","created_by").prefetch_related("lines","payments__receipt")
    serializer_class=InvoiceSerializer
    def get_queryset(self):
        u=self.request.user
        qs=self.queryset
        if u.role==UserRole.ADMIN:
            pass
        elif u.role==UserRole.SCHOOL:
            qs=qs.filter(school__account_id=u.id)
        elif u.role==UserRole.TRAINER:
            qs=qs.filter(trainer__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "school")
    def perform_create(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        obj=serializer.save(invoice_number=f"INV-{__import__('uuid').uuid4().hex[:10].upper()}",created_by=self.request.user)
        record_audit(actor=self.request.user,action="create",entity_type="Invoice",entity_id=obj.id,summary=f"Created invoice {obj.invoice_number}",request=self.request)
    def perform_update(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        invoice=serializer.instance
        if invoice.status not in {BillingStatus.DRAFT,BillingStatus.ISSUED}:
            raise ValidationError("Only draft or issued invoices can be edited.")
        obj=serializer.save()
        record_audit(actor=self.request.user,action="update",entity_type="Invoice",entity_id=obj.id,summary=f"Updated invoice {obj.invoice_number}",request=self.request)
    def perform_destroy(self,instance):
        raise ValidationError("Invoices are not deleted. Use the Void action so the financial record remains retained.")
    @action(detail=True,methods=["post"])
    def issue(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        invoice=self.get_object()
        if invoice.status!=BillingStatus.DRAFT: raise ValidationError("Only draft invoices can be issued.")
        recalculate_invoice(invoice)
        if invoice.total_amount <= 0: raise ValidationError("An invoice must have a positive total before it can be issued.")
        invoice.status=BillingStatus.ISSUED
        invoice.save(update_fields=["status","updated_at"])
        record_audit(actor=request.user,action="update",entity_type="Invoice",entity_id=invoice.id,summary=f"Issued invoice {invoice.invoice_number}",changes={"status": "issued"},request=request)
        return Response(self.get_serializer(invoice).data)
    @action(detail=True,methods=["post"])
    def void(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        invoice=self.get_object()
        if invoice.status==BillingStatus.PAID: raise ValidationError("Paid invoices cannot be voided. Use a controlled finance adjustment.")
        if invoice.status==BillingStatus.VOID: raise ValidationError("Invoice is already void.")
        invoice.status=BillingStatus.VOID
        invoice.save(update_fields=["status","updated_at"])
        record_audit(actor=request.user,action="void",entity_type="Invoice",entity_id=invoice.id,summary=f"Voided invoice {invoice.invoice_number}",changes={"status":"void"},request=request)
        return Response(self.get_serializer(invoice).data


class InvoiceLineItemViewSet(BillingScopedMixin,viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated,IsActiveAccount,HasActionPermission]
    queryset=InvoiceLineItem.objects.select_related("invoice")
    serializer_class=InvoiceLineItemSerializer
    def get_queryset(self):
        u=self.request.user
        qs=self.queryset
        if u.role==UserRole.ADMIN:
            pass
        elif u.role==UserRole.SCHOOL:
            qs=qs.filter(invoice__school__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "invoice__school")
    def get_serializer_class(self): return InvoiceLineItemWriteSerializer if self.action in {"create","update","partial_update"} else InvoiceLineItemSerializer
    def perform_create(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        invoice=serializer.validated_data["invoice"]
        if self.request.user.role==UserRole.SCHOOL and invoice.school.account_id!=self.request.user.id: raise PermissionDenied("You cannot edit this invoice.")
        add_invoice_line(invoice=invoice,description=serializer.validated_data["description"],quantity=serializer.validated_data["quantity"],unit_price=serializer.validated_data["unit_price"])
    def perform_update(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        invoice=serializer.instance.invoice
        if self.request.user.role==UserRole.SCHOOL and invoice.school.account_id!=self.request.user.id: raise PermissionDenied("You cannot edit this invoice.")
        update_invoice_line(line=serializer.instance,description=serializer.validated_data["description"],quantity=serializer.validated_data["quantity"],unit_price=serializer.validated_data["unit_price"])
    def perform_destroy(self,instance):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        if self.request.user.role==UserRole.SCHOOL and instance.invoice.school.account_id!=self.request.user.id: raise PermissionDenied("You cannot edit this invoice.")
        if instance.invoice.status not in {BillingStatus.DRAFT,BillingStatus.ISSUED}: raise ValidationError("Only draft or issued invoices can be edited.")
        with transaction.atomic():
            invoice=Invoice.objects.select_for_update().get(pk=instance.invoice_id); instance.delete(); recalculate_invoice(invoice)


class PaymentViewSet(BillingScopedMixin,viewsets.ReadOnlyModelViewSet):
    permission_classes=[IsAuthenticated,IsActiveAccount,HasActionPermission]
    queryset=Payment.objects.select_related("invoice__school","recorded_by","receipt")
    serializer_class=PaymentSerializer
    def get_queryset(self):
        u=self.request.user
        qs=self.queryset
        if u.role==UserRole.ADMIN:
            pass
        elif u.role==UserRole.SCHOOL:
            qs=qs.filter(invoice__school__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "invoice__school")
    @action(detail=False,methods=["post"] ,url_path="record")
    def record(self,request):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        serializer=PaymentRecordSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        invoice=serializer.validated_data["invoice"]
        if request.user.role==UserRole.SCHOOL and invoice.school.account_id!=request.user.id: raise PermissionDenied("You cannot record payment for this invoice.")
        if invoice.status not in {BillingStatus.ISSUED,BillingStatus.PARTIALLY_PAID,BillingStatus.OVERDUE}: raise ValidationError("Only issued invoices can receive payments.")
        payment,receipt=record_payment(recorded_by=request.user,**serializer.validated_data)
        return Response({"payment":PaymentSerializer(payment).data,"receipt":ReceiptSerializer(receipt).data},status=status.HTTP_201_CREATED)


class ReceiptViewSet(BillingScopedMixin,viewsets.ReadOnlyModelViewSet):
    permission_classes=[IsAuthenticated,IsActiveAccount,HasActionPermission]
    queryset=Receipt.objects.select_related("payment__invoice__school","issued_by")
    serializer_class=ReceiptSerializer
    def get_queryset(self):
        u=self.request.user
        qs=self.queryset
        if u.role==UserRole.ADMIN:
            pass
        elif u.role==UserRole.SCHOOL:
            qs=qs.filter(payment__invoice__school__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "invoice__school")
