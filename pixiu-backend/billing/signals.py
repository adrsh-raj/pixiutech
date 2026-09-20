from django.db.models.signals import post_save
from django.dispatch import receiver

from academics.models import School
from .services import ensure_school_billing_profile


@receiver(post_save, sender=School)
def provision_school_billing_profile(sender, instance, created, **kwargs):
    if created:
        ensure_school_billing_profile(school=instance)
