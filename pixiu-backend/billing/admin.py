from django.contrib import admin
from .models import Invoice, InvoiceLineItem, Payment, Receipt
admin.site.register([Invoice, InvoiceLineItem, Payment, Receipt])
