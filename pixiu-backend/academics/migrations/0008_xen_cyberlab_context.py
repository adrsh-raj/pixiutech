import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0007_xenjob_format_mode'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='xenjob',
            name='context_revision',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='xenjob',
            name='context_session_id',
            field=models.CharField(blank=True, db_index=True, max_length=128),
        ),
        migrations.CreateModel(
            name='XenCyberLabContext',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('session_id', models.CharField(db_index=True, max_length=128)),
                ('circuit_revision', models.PositiveIntegerField(default=0)),
                ('interaction_revision', models.PositiveIntegerField(default=0)),
                ('event_seq', models.PositiveIntegerField(default=0)),
                ('last_event_id', models.CharField(blank=True, max_length=128)),
                ('last_event_type', models.CharField(blank=True, max_length=48)),
                ('context_payload', models.JSONField(blank=True, default=dict)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='xen_cyberlab_contexts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Xen CyberLab Context',
                'verbose_name_plural': 'Xen CyberLab Contexts',
                'indexes': [models.Index(fields=['user', 'updated_at'], name='academics_x_user_id_cyb_idx')],
                'constraints': [models.UniqueConstraint(fields=('user', 'session_id'), name='xen_cyberlab_user_session_unique')],
            },
        ),
    ]
