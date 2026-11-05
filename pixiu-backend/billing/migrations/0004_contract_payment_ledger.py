from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [("billing", "0003_billing_profile")]

    operations = [
        migrations.AlterField(
            model_name="payment",
            name="invoice",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="payments",
                to="billing.invoice",
            ),
        ),
        migrations.AddField(
            model_name="payment",
            name="contract",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="payments",
                to="billing.schoolcontract",
            ),
        ),
        migrations.AddField(
            model_name="receipt",
            name="school_name_snapshot",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="receipt",
            name="invoice_number_snapshot",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="receipt",
            name="contract_number_snapshot",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="receipt",
            name="total_amount_snapshot",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14),
        ),
        migrations.AddField(
            model_name="receipt",
            name="amount_paid_snapshot",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14),
        ),
        migrations.AddField(
            model_name="receipt",
            name="balance_due_snapshot",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14),
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=(
                    Q(invoice__isnull=False, contract__isnull=True)
                    | Q(invoice__isnull=True, contract__isnull=False)
                ),
                name="payment_exactly_one_target",
            ),
        ),
    ]
