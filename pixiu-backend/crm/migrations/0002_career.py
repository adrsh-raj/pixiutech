import uuid
from django.db import migrations, models
from crm.models import career_cv_upload_to
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('crm', '0001_initial')]

    operations = [
        migrations.CreateModel(
            name='CareerOpening',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=180)),
                ('location', models.CharField(blank=True, max_length=180)),
                ('employment_type', models.CharField(blank=True, max_length=80)),
                ('description', models.TextField()),
                ('requirements', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('closed', 'Closed')], default='draft', max_length=20)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['sort_order', '-created_at'], 'indexes': [models.Index(fields=['status', 'sort_order'], name='career_open_status_idx')]},
        ),
        migrations.CreateModel(
            name='CareerApplication',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=160)),
                ('email', models.EmailField(max_length=254)),
                ('phone', models.CharField(max_length=10)),
                ('cover_message', models.TextField(blank=True, max_length=4000)),
                ('cv', models.FileField(max_length=300, upload_to=career_cv_upload_to)),
                ('cv_original_name', models.CharField(max_length=255)),
                ('cv_size', models.PositiveIntegerField()),
                ('cv_sha256', models.CharField(max_length=64)),
                ('status', models.CharField(choices=[('new', 'New'), ('reviewed', 'Reviewed'), ('shortlisted', 'Shortlisted'), ('rejected', 'Rejected'), ('hired', 'Hired')], default='new', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('opening', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='applications', to='crm.careeropening')),
            ],
            options={'ordering': ['-created_at'], 'indexes': [models.Index(fields=['status', 'created_at'], name='career_app_status_idx'), models.Index(fields=['opening', 'created_at'], name='career_app_opening_idx')]},
        ),
    ]