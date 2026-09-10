from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import UserRole
from billing.services import add_invoice_line
from billing.views import InvoiceViewSet


class TransactionalInvoiceViewSet(InvoiceViewSet):
    @action(detail=False, methods=["post"], url_path="create-with-lines")
    def create_with_lines(self, request):
        self.required_action = "CREATE"
        self.role_only(UserRole.ADMIN)

        payload = request.data.copy()
        lines = payload.pop("lines", [])
        if not isinstance(lines, list):
            raise ValidationError({"lines": "Lines must be a list."})

        with transaction.atomic():
            serializer = self.get_serializer(data=payload)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            invoice = serializer.instance
            for index, raw in enumerate(lines):
                if not isinstance(raw, dict):
                    raise ValidationError({"lines": {index: "Each line must be an object."}})
                description = str(raw.get("description", "")).strip()
                if not description:
                    raise ValidationError({"lines": {index: "Description is required."}})
                try:
                    quantity = int(raw.get("quantity", 1))
                    unit_price = Decimal(str(raw.get("unit_price", "0")))
                except (TypeError, ValueError, InvalidOperation):
                    raise ValidationError({"lines": {index: "Quantity must be an integer and unit price must be numeric."}})
                if quantity <= 0:
                    raise ValidationError({"lines": {index: "Quantity must be positive."}})
                if unit_price < 0:
                    raise ValidationError({"lines": {index: "Unit price cannot be negative."}})
                add_invoice_line(invoice=invoice, description=description, quantity=quantity, unit_price=unit_price)
            invoice.refresh_from_db()
            return Response(self.get_serializer(invoice).data, status=201)
