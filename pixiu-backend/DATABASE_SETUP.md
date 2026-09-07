# Step 3 — Fresh PostgreSQL Database

This Django backend is intentionally separated from the legacy Node/PostgreSQL system.

## Rules

1. Create a brand-new PostgreSQL database for the Django rebuild.
2. Do not point `DATABASE_URL` at the existing legacy LMS database.
3. Do not import legacy rows into the new database.
4. Keep the legacy database untouched until the Django migration is complete and verified.
5. The database name can be chosen by the deployment environment; it is never hard-coded in application code.

## Environment variables

Set these in the Django deployment environment:

- `DATABASE_URL`: connection URL for the new PostgreSQL database.
- `DJANGO_EXPECTED_DATABASE_NAME`: the exact name of that new database.
- `DJANGO_DB_SSLMODE=require` when the provider requires encrypted PostgreSQL connections.

The settings module refuses to start when `DATABASE_URL` points to a different database than `DJANGO_EXPECTED_DATABASE_NAME`.

## Verify before migrations

From `pixiu-backend/`:

```bash
python manage.py check
python manage.py check_database --strict
```

`check_database --strict` performs read-only PostgreSQL checks and prints the database actually reached. It does not delete or modify application data.

Only after the output confirms the new empty database should Django migrations be run.

## Why this is different from the old system

The old LMS database remains an audit/reference source during the rebuild, but it is not the source of truth for the new Django application. The new application will build its own relational models with real foreign keys and permission checks. No names, school IDs, trainer IDs, student records, or demo relationships will be embedded in Django code.
