# Phase 8 — Automated Verification and Production Deployment

Phase 8 closes the gap between a working repository and a deployable production stack.

## 44–46 — Automated, permission, and migration tests

The GitHub Actions verification workflow runs against PostgreSQL 16 and now performs:

- `python manage.py check`
- `python manage.py check --deploy`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py migrate --noinput`
- the full Django test suite
- Python compilation and `collectstatic`
- public-site Vite build
- LMS Vite build

Phase 8 tests cover the Django JWT login → refresh → `/auth/me/` → logout flow, unauthenticated API denial, admin-vs-school create permissions, trainer assignment restrictions, trainer scoping, and required migrated tables.

## 47 — Production build

The backend uses Gunicorn rather than Django's development server. Static files are collected into `staticfiles/` and served through WhiteNoise. Production settings reject a missing secret or a non-PostgreSQL `DATABASE_URL`.

## 48 — Render

`render.yaml` defines the Django web service as a monorepo service with `pixiu-backend` as its root directory. It builds dependencies, applies migrations, collects static files, starts Gunicorn, and health-checks `/api/v1/health/`.

The following values intentionally remain deployment-time configuration and are not committed:

- `DATABASE_URL`
- `DJANGO_EXPECTED_DATABASE_NAME`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`

Render provides environment variables/secrets separately from source control; do not commit real production credentials.

## 49 — Vercel

The repository root and `pixiu-lms-portal/` both have explicit Vite/Vercel SPA configuration. The LMS project must use its `pixiu-lms-portal` root directory and set:

`VITE_API_URL=https://<render-django-host>/api/v1`

The compatibility variable `VITE_DJANGO_API_URL=https://<render-django-host>/api` may remain for the Phase 6 admin page; it is normalized by the frontend to `/api/v1`.

## 50 — End-to-end deployment smoke test

`scripts/e2e-smoke.mjs` can verify a deployed frontend and/or Django API without adding another runtime dependency. It checks:

1. frontend returns HTML;
2. Django health returns `{ "status": "ok" }`;
3. when `E2E_USERNAME` and `E2E_PASSWORD` are supplied, login returns access/refresh tokens and `/auth/me/` returns the expected role.

Example:

```bash
E2E_BASE_URL=https://lms.example.com \
E2E_API_URL=https://api.example.com/api/v1 \
E2E_USERNAME=admin \
E2E_PASSWORD='...' \
E2E_ROLE=admin \
node scripts/e2e-smoke.mjs
```

## What still requires deployment-side action

The repository can define and validate the deployment, but it cannot create services inside a Render or Vercel account from GitHub source alone. After connecting the repository in Render and Vercel, configure the environment variables above and trigger the first production deploy. The deployment smoke script should then be run against the resulting URLs.


## Release-gate hardening

Phase 8 now includes repository-level release-gate checks for the public website, the `/simulation` Virtual Lab route, Django `/api/v1/health/`, public-enquiry validation, and the absence of the legacy JSON `/api/enquiry` function. A manual GitHub Actions release gate is provided for real deployed URLs.

Repository checks do not by themselves mark production closed. Render health, Vercel project root/environment configuration, deployment quota availability, and final browser smoke results remain deployment-side evidence requirements.
