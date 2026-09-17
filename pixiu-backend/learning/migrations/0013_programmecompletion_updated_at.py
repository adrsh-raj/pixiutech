from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('learning', '0012_backfill_session_workflow'),
    ]

    operations = [
        migrations.AddField(
            model_name='programmecompletion',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
