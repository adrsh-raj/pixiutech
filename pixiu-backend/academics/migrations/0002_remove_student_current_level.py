from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "academics_student" DROP COLUMN IF EXISTS "current_level";',
                    reverse_sql=migrations.RunSQL.noop,
                )
            ],
            state_operations=[
                migrations.RemoveField(model_name="student", name="current_level"),
            ],
        )
    ]
