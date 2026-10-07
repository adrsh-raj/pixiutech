from django.db import migrations, models

from crm.models import career_cv_upload_to


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0005_lead_read_at"),
    ]

    operations = [
        migrations.AlterField(
            model_name="careerapplication",
            name="cv",
            field=models.FileField(max_length=300, upload_to=career_cv_upload_to),
        ),
        migrations.AlterField(
            model_name="lead",
            name="enquiry_type",
            field=models.CharField(
                choices=[
                    ("sales", "Sales"),
                    ("bug", "Bug"),
                    ("help", "Help"),
                    ("other", "Other"),
                    ("philosophy", "Think / Rethink Philosophy"),
                ],
                default="sales",
                max_length=20,
            ),
        ),
    ]
