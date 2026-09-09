from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from academics.services import accessible_school_queryset
from audit.services import record_audit
from .models import SchoolContract, ContractStatus, Invoice, BillingStatus, Payment, PaymentStatus, Receipt
from .serializers import InvoiceSerializer, PaymentSerializer, ReceiptSerializer


class SchoolContractSerializer(serializers.ModelSerializer):
    school_code = serializers.CharField(source="school.school_code", read_only=True)
    school_name = serializers.CharField(source="school.name", read_only=True)

    class Meta:
        model = SchoolContract
        fields = ["id", "contract_number", "school", "school_code", "school_name", "start_date", "end_date", "total_value", "status", "notes", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        user = self.context["request"].user
        school = attrs.get("school", getattr(self.instance, "school", None))
        if not school or not accessible_school_queryset(user).filter(pk=school.pk).exists():
            raise serializers.ValidationError({"school": "You cannot manage contracts for this school."})
        if attrs.get("start_date", getattr(self.instance, "start_date", None)) and attrs.get("end_date", getattr(self.instance, "end_date", None)):
            if attrs.get("end_date") < attrs.get("start_date"):
                raise serializers.ValidationError("Contract end date cannot be before start date.")
        return attrs


class ContractViewSet(viewsets.ModelViewSet):
    queryset = SchoolContract.objects.select_related("school", "created_by")
    serializer_class = SchoolContractSerializer
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]

    def initial(self, request, *args, **kwargs):
        self.required_action = {"list":"VIEW","retrieve":"VIEW","create":"CREATE","update":"EDIT","partial_update":"EDIT","destroy":"DELETE"}.get(self.action, "VIEW")
        super().initial(request, *args, **kwargs)

    def get_queryset(self):
        qs = self.queryset
        if self.request.user.role != UserRole.ADMIN:
            qs = qs.filter(school__in=accessible_school_queryset(self.request.user))
        school = self.request.query_params.get("school")
        if school:
            value = str(school).strip()
            qs = qs.filter(Q(school__school_code=value.upper()) | Q(school_id=value))
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL}:
            raise PermissionDenied("Your role cannot create contracts.")
        obj = serializer.save(created_by=self.request.user)
        record_audit(actor=self.request.user, action="create", entity_type="SchoolContract", entity_id=obj.id, summary=f"Created contract {obj.contract_number}", request=self.request)

    def perform_update(self, serializer):
        if self.request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL}:
            raise PermissionDenied("Your role cannot edit contracts.")
        obj = serializer.save()
        record_audit(actor=self.request.user, action="update", entity_type="SchoolContract", entity_id=obj.id, summary=f"Updated contract {obj.contract_number}", request=self.request)

    def perform_destroy(self, instance):
        raise ValidationError("Contracts are retained. Change the contract status to expired or terminated instead of deleting it.")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_summary(request):
    qs = Invoice.objects.select_related("school", "contract")
    if request.user.role != UserRole.ADMIN:
        qs = qs.filter(school__in=accessible_school_queryset(request.user))
    school = request.query_params.get("school")
    if school:
        qs = qs.filter(Q(school__school_code=str(school).upper()) | Q(school_id=school))
    active = qs.exclude(status=BillingStatus.VOID)
    values = active.aggregate(invoiced=Sum("total_amount"), collected=Sum("amount_paid"))
    invoiced = values["invoiced"] or Decimal("0")
    collected = values["collected"] or Decimal("0")
    contracts = SchoolContract.objects.filter(school__in=accessible_school_queryset(request.user)) if request.user.role != UserRole.ADMIN else SchoolContract.objects.all()
    if school: contracts = contracts.filter(Q(school__school_code=str(school).upper()) | Q(school_id=school))
    contract_value = contracts.exclude(status=ContractStatus.TERMINATED).aggregate(total=Sum("total_value"))["total"] or Decimal("0")
    return Response({"contract_value": contract_value, "invoiced": invoiced, "collected": collected, "pending": max(invoiced - collected, Decimal("0")), "invoice_count": active.count(), "void_invoice_count": qs.filter(status=BillingStatus.VOID).count()})
