from django.contrib import admin
from .models import Lead, LeadActivity, LeadContact
admin.site.register([Lead, LeadActivity, LeadContact])
