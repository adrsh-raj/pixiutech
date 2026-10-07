from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0004_lab_enquiry_support"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
