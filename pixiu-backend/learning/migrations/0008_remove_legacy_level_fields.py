from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0007_assessment_uniqueness"),
    ]

    operations = [
        migrations.RemoveField(model_name="curriculumunit", name="level"),
        migrations.RemoveField(model_name="learningcontent", name="level"),
        migrations.RemoveField(model_name="quiz", name="level"),
        migrations.RemoveField(model_name="studentassessment", name="level"),
    ]
