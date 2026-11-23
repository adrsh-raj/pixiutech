from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("academics", "0004_xensession_response_payload")]

    operations = [
        migrations.AddConstraint(
            model_name="xensession",
            constraint=models.UniqueConstraint(
                fields=("user", "idempotency_key"), name="xen_session_user_key_unique",
            ),
        ),
        migrations.AlterField(
            model_name="xensession",
            name="idempotency_key",
            field=models.CharField(max_length=128),
        ),
    ]
