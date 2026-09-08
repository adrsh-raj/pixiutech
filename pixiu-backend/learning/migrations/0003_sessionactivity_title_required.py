from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [("learning", "0002_session_workflow")]

    operations = [
        migrations.AddConstraint(
            model_name="sessionactivity",
            constraint=models.CheckConstraint(
                condition=~Q(title=""),
                name="session_activity_title_required",
            ),
        ),
    ]
