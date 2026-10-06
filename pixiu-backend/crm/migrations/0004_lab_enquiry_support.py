import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("crm", "0003_career")]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="enquiry_type",
            field=models.CharField(
                choices=[
                    ("sales", "Sales"),
                    ("bug", "Bug"),
                    ("help", "Help"),
                    ("other", "Other"),
                ],
                default="sales",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="LabEnquiryAttachment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("file", models.FileField(max_length=320, upload_to="private_lab_enquiries/")),
                ("original_name", models.CharField(max_length=255)),
                ("size", models.PositiveIntegerField()),
                ("content_type", models.CharField(max_length=120)),
                ("sha256", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("lead", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="lab_attachments",
                    to="crm.lead",
                )),
            ],
            options={"ordering": ["created_at"]},
        ),
    ]
