from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("create", "Create"),
                    ("update", "Update"),
                    ("delete", "Delete"),
                    ("void", "Void"),
                    ("login", "Login"),
                    ("logout", "Logout"),
                    ("password_reset", "Password Reset"),
                    ("assignment_change", "Assignment Change"),
                    ("attendance_override", "Attendance Override"),
                    ("payment", "Payment"),
                    ("export", "Export"),
                    ("approve", "Approve"),
                    ("reject", "Reject"),
                    ("other", "Other"),
                ],
                max_length=20,
            ),
        ),
    ]
