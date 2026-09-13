from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(model_name="student", name="current_level"),
    ]
