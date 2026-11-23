from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("academics", "0003_xen_identity_registry")]

    operations = [
        migrations.AddField(
            model_name="xensession",
            name="response_payload",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
