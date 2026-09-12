from django.db import migrations, models
import django.db.models.deletion
import uuid


def seed_technologies(apps, schema_editor):
    Technology = apps.get_model('learning', 'Technology')
    defaults = [
        ('robotics', 'Robotics', 10),
        ('ai', 'AI', 20),
        ('drone', 'Drone', 30),
        ('3d-printing', '3D Printing', 40),
        ('computational-design', 'Computational Design', 50),
    ]
    for code, name, sort_order in defaults:
        Technology.objects.get_or_create(code=code, defaults={'name': name, 'sort_order': sort_order, 'active': True})


def seed_policy(apps, schema_editor):
    CompletionPolicy = apps.get_model('learning', 'CompletionPolicy')
    CompletionPolicy.objects.get_or_create(school_class=None, defaults={'name': 'Standard Pixiu completion policy'})


class Migration(migrations.Migration):
    dependencies = [('learning', '0004_session_curriculum_quiz_timing')]
    operations = [
        migrations.CreateModel(
            name='Technology',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.SlugField(max_length=80, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['sort_order', 'name']},
        ),
        migrations.CreateModel(
            name='CurriculumUnitProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('certificate_required', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('curriculum_unit', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='completion_profile', to='learning.curriculumunit')),
                ('technology', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='curriculum_units', to='learning.technology')),
            ],
        ),
        migrations.CreateModel(
            name='SessionWorkflow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_last_session_for_unit', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('session', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='workflow', to='learning.session')),
                ('technology', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='session_workflows', to='learning.technology')),
            ],
        ),
        migrations.CreateModel(
            name='CompletionPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='Standard Pixiu completion policy', max_length=160)),
                ('requires_attendance', models.BooleanField(default=True)),
                ('min_attendance_pct', models.DecimalField(decimal_places=2, default=75, max_digits=5)),
                ('requires_quiz', models.BooleanField(default=True)),
                ('min_quiz_pct', models.DecimalField(decimal_places=2, default=60, max_digits=5)),
                ('requires_practical', models.BooleanField(default=True)),
                ('min_practical_pct', models.DecimalField(decimal_places=2, default=70, max_digits=5)),
                ('requires_trainer_review', models.BooleanField(default=True)),
                ('min_trainer_review_rating', models.DecimalField(decimal_places=2, default=3, max_digits=3)),
                ('weight_practical', models.DecimalField(decimal_places=2, default=40, max_digits=5)),
                ('weight_quiz', models.DecimalField(decimal_places=2, default=25, max_digits=5)),
                ('weight_attendance', models.DecimalField(decimal_places=2, default=20, max_digits=5)),
                ('weight_trainer_review', models.DecimalField(decimal_places=2, default=15, max_digits=5)),
                ('active', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school_class', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='completion_policy', to='academics.schoolclass')),
            ],
            options={'ordering': ['school_class_id']},
        ),
        migrations.CreateModel(
            name='UnitCompletion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('passed', 'Passed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('attendance_pct', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('quiz_pct', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('practical_pct', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('trainer_review_avg', models.DecimalField(blank=True, decimal_places=2, max_digits=4, null=True)),
                ('score', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('reasons', models.JSONField(blank=True, default=list)),
                ('evaluated_at', models.DateTimeField(auto_now=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('curriculum_unit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='student_completions', to='learning.curriculumunit')),
                ('final_session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='unit_completions', to='learning.session')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='unit_completions', to='academics.student')),
            ],
            options={'ordering': ['curriculum_unit__unit_code']},
        ),
        migrations.CreateModel(
            name='ProgrammeCompletion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('in_progress', 'In progress'), ('trainer_requested', 'Trainer requested'), ('admin_completed', 'Admin completed')], default='in_progress', max_length=30)),
                ('overall_score', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('requested_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('completed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='programme_completions_approved', to='accounts.user')),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='programme_completion_requests', to='accounts.user')),
                ('student', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='programme_completion', to='academics.student')),
            ],
        ),
        migrations.CreateModel(
            name='Certificate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('certificate_id', models.CharField(max_length=80, unique=True)),
                ('verification_token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('programme_name', models.CharField(default='Pixiu Technology Programme', max_length=250)),
                ('technologies_snapshot', models.JSONField(default=list)),
                ('units_snapshot', models.JSONField(default=list)),
                ('overall_score', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('rank', models.PositiveIntegerField(blank=True, null=True)),
                ('rank_printed', models.BooleanField(default=False)),
                ('status', models.CharField(choices=[('issued', 'Issued'), ('revoked', 'Revoked')], default='issued', max_length=20)),
                ('issued_at', models.DateTimeField(auto_now_add=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('snapshot', models.JSONField(blank=True, default=dict)),
                ('issued_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='issued_pixiu_certificates', to='accounts.user')),
                ('school_class', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='certificates', to='academics.schoolclass')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='certificates', to='academics.student')),
            ],
            options={'ordering': ['-issued_at']},
        ),
        migrations.AddConstraint(
            model_name='unitcompletion',
            constraint=models.UniqueConstraint(fields=('student', 'curriculum_unit'), name='uniq_student_curriculum_completion'),
        ),
        migrations.RunPython(seed_technologies, migrations.RunPython.noop),
        migrations.RunPython(seed_policy, migrations.RunPython.noop),
    ]
