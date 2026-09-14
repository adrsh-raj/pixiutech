from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("learning", "0010_remove_unwanted_learning_level_fields")]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS learning_content_file_backup (
                    content_id uuid PRIMARY KEY
                        REFERENCES learning_learningcontent(id) ON DELETE CASCADE,
                    file_name varchar(255) NOT NULL,
                    content_type varchar(100) NOT NULL,
                    data bytea NOT NULL,
                    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """,
            reverse_sql="DROP TABLE IF EXISTS learning_content_file_backup",
        ),
    ]
