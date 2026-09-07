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

## Phase 2 — Authentication, authorization and credentials

### Step 6 — Authentication

The backend uses a custom `accounts.User` model with JWT Bearer authentication. Access tokens are short-lived, refresh tokens rotate, and refresh tokens are blacklisted after use. Logout blacklists the submitted refresh token.

Endpoints:

```text
POST /api/accounts/login/
POST /api/accounts/refresh/
POST /api/accounts/logout/
GET  /api/accounts/me/
POST /api/accounts/password/change/
```

Login is scoped/throttled. Suspended/inactive accounts cannot authenticate into protected API endpoints.

### Step 7 — Role and action permissions

Four roles are defined: `admin`, `school`, `trainer`, and `student`.

Business actions are represented explicitly as:

```text
VIEW CREATE EDIT DELETE PUBLISH ASSIGN GRADE RATE EXPORT
```

`accounts.permissions` provides the reusable action-policy foundation. Later domain modules must combine this with relational queryset/object scope checks. For example, a trainer may have `VIEW` permission for students but only students reachable through an actual trainer-school/class assignment.

### Step 8 — Credential management

Passwords are always passed through Django's password hashing API. Plaintext passwords are never stored and API responses do not return password values.

Admin-only account management endpoints:

```text
POST /api/accounts/credentials/manage/
POST /api/accounts/credentials/manage/<username>/reset/
```

Self-service password change:

```text
POST /api/accounts/password/change/
```

School passwords require at least 8 characters; trainer passwords require at least 12 characters. Admin-set/reset managed credentials set `must_change_password=True` and revoke existing refresh-token sessions.

Student credential generation is implemented as a backend utility and will be called from the Student domain when the authoritative School → Class → Student relationships exist.

Student ID format:

`[SCHOOL_CODE][GRADE][SECTION] [ROLL_NO_2_DIGITS]`

Example: `XYZ8A 03`

Student password format:

`[UPPERCASE_SCHOOL_CODE][COMPACT_STUDENT_USERNAME_WITH_LOWERCASE_SCHOOL_PREFIX][@hata]`

Example: `XYZ8A 03` → `XYZxyz8A3@hata`

The React frontend must never construct or invent these identities.

See `PHASE_2_SECURITY.md` for the complete security contract.

### Admin bootstrap

No default admin password exists in code.

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
python manage.py test accounts
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
