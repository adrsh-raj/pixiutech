from django.db.models.signals import pre_save
from django.dispatch import receiver
from rest_framework.exceptions import ValidationError

from .models import LearningContent
from .watermarking import prepare_stored_file


@receiver(pre_save, sender=LearningContent)
def enforce_learning_content_watermark(sender, instance, **kwargs):
    role = str(instance.target_role or "student").strip().lower()
    if role == "trainer":
        instance.is_watermarked = False
        return
    if role not in {"student", "school", "all"} or not instance.file:
        return

    original = None
    if instance.pk:
        original = sender.objects.filter(pk=instance.pk).only("file", "target_role", "is_watermarked").first()

    old_name = original.file.name if original and original.file else ""
    new_name = instance.file.name or ""
    file_changed = bool(instance._state.adding or new_name != old_name)
    role_changed_from_trainer = bool(original and str(original.target_role).lower() == "trainer" and role != "trainer")

    if not file_changed and not role_changed_from_trainer and instance.is_watermarked:
        return

    try:
        prepared, watermarked = prepare_stored_file(instance.file, role)
    except ValueError as exc:
        raise ValidationError({"file": str(exc)}) from exc

    if watermarked:
        if instance.file and not instance._state.adding and old_name and old_name != new_name:
            try:
                instance.file.storage.delete(old_name)
            except Exception:
                pass
        instance.file = prepared
    instance.is_watermarked = watermarked
