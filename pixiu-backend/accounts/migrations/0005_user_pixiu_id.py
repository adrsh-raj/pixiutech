from django.db import migrations, models


def populate_admin_pixiu_ids(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    used = set(
        value.upper()
        for value in User.objects.exclude(pixiu_id__isnull=True).exclude(pixiu_id="").values_list("pixiu_id", flat=True)
    )

    admins = User.objects.filter(role="admin").order_by("id")
    for index, user in enumerate(admins):
        if user.pixiu_id:
            continue

        if index == 0:
            base = "ADARSHRAJ"
        else:
            raw = " ".join(
                part for part in [user.display_name, user.first_name, user.last_name, user.username]
                if part
            )
            base = "".join(ch for ch in raw.upper() if ch.isalnum())[:72] or f"ADMIN{user.pk}"
            if base.isdigit():
                base = f"ADMIN{user.pk}"

        candidate = base
        suffix = 2
        while candidate.upper() in used:
            candidate = f"{base}{suffix}"
            suffix += 1

        candidate = candidate[:80]
        User.objects.filter(pk=user.pk).update(pixiu_id=candidate)
        used.add(candidate.upper())


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_security_controls"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="pixiu_id",
            field=models.CharField(blank=True, editable=False, max_length=80, null=True, unique=True),
        ),
        migrations.RunPython(populate_admin_pixiu_ids, migrations.RunPython.noop),
    ]
