# PIXIU Tech Django Backend

Clean replacement backend for the PIXIU LMS.

## Stack

- Django
- Django REST Framework
- PostgreSQL via psycopg 3
- django-cors-headers
- SimpleJWT

## Rebuild rules

This backend starts against a fresh PostgreSQL database. Legacy Express/SQLite application data is not imported.

Business domains and authentication are added incrementally in the numbered rebuild steps.

No school, trainer, class, student, database name, password, or relationship is hard-coded in application logic.

## Step 5 — Authentication foundation

The Django backend now uses a custom `accounts.User` model. The user account stores identity/access concerns only:

- username
- password hash managed by Django
- role: `admin`, `school`, `trainer`, `student`
- status: `active`, `suspended`, `inactive`
- password-change flag
- display name

School, trainer, and student business profiles are intentionally not stored as loose string fields on the user row. They will be connected with explicit one-to-one/foreign-key relationships in later domain steps.

JWT authentication endpoints:

```text
POST /api/accounts/login/
POST /api/accounts/refresh/
POST /api/accounts/logout/
GET  /api/accounts/me/
```

The access token is short-lived and refresh tokens rotate with blacklist support. Login is throttled by an environment-configurable rate limit.

### Admin bootstrap

No default admin username or password exists in code.

Set credentials only through the deployment environment:

```text
ADMIN_BOOTSTRAP_USERNAME=<your-admin-username>
ADMIN_BOOTSTRAP_PASSWORD=<your-strong-admin-password>
```

Then run:

```bash
python manage.py bootstrap_admin
```

For an intentional password reset of an existing admin account:

```bash
python manage.py bootstrap_admin --reset-password
```

Never commit actual credentials to GitHub.

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

JWT lifetimes and login throttling are environment-configurable through `.env`.

Never commit `.env`, real database credentials, Django secrets, or generated passwords.

## Deployment preflight

Before deploying a new environment:

```bash
python manage.py check --deploy
python manage.py check_database --strict
python manage.py migrate --plan
```

Only run migrations after `check_database --strict` confirms the intended fresh database. Do not point this backend at the legacy database.
