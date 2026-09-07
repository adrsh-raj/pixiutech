# PIXIU Tech Django Backend

Clean replacement backend for the PIXIU LMS.

## Stack

- Django
- Django REST Framework
- PostgreSQL via psycopg 3
- django-cors-headers

## Rebuild rules

This backend starts against a fresh PostgreSQL database. Legacy Express/SQLite application data is not imported.

Business domains and authentication are added incrementally in the numbered rebuild steps.

No school, trainer, class, student, database name, password, or relationship is hard-coded in application logic.

## Local setup

```bash
cd pixiu-backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env  # macOS/Linux
python manage.py check
python manage.py check_database --strict
python manage.py migrate
python manage.py runserver
```

## Environment rules

`DATABASE_URL` must point to the new PIXIU Django PostgreSQL database during this rebuild.

Set `DJANGO_EXPECTED_DATABASE_NAME` to the exact new database name. With that value present, the app refuses to start when the configured database name does not match it.

Set `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, and `DJANGO_CSRF_TRUSTED_ORIGINS` per deployment environment. Do not use a wildcard browser origin in production.

Never commit `.env`, real database credentials, Django secrets, or generated passwords.

## Deployment preflight

Before deploying a new environment:

```bash
python manage.py check --deploy
python manage.py check_database --strict
python manage.py migrate --plan
```

Only run migrations after `check_database --strict` confirms the intended fresh database. Do not point this backend at the legacy database.
