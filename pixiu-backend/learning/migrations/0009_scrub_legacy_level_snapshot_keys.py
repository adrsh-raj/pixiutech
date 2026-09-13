from django.db import migrations


LEGACY_KEYS = {"current_level", "level"}


def scrub(value):
    if isinstance(value, dict):
        return {key: scrub(item) for key, item in value.items() if key not in LEGACY_KEYS}
    if isinstance(value, list):
        return [scrub(item) for item in value]
    return value


def forwards(apps, schema_editor):
    Certificate = apps.get_model("learning", "Certificate")
    for certificate in Certificate.objects.exclude(snapshot={}):
        snapshot = certificate.snapshot or {}
        cleaned = scrub(snapshot)
        if cleaned != snapshot:
            certificate.snapshot = cleaned
            certificate.save(update_fields=["snapshot"])


def backwards(apps, schema_editor):
    # Legacy level data is intentionally not reconstructed.
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0008_remove_legacy_level_fields"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
