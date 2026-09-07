# Pixiu Tech

Pixiu Tech is a React/Vite education platform with two frontend applications and one canonical Django LMS backend.

## Production architecture

- **Public website:** repository root, deployed on Vercel.
- **LMS portal:** `pixiu-lms-portal/`, deployed on Vercel as a separate Vite project with that directory as its Root Directory.
- **LMS API:** `pixiu-backend/`, Django REST Framework, deployed on Render.
- **Database:** PostgreSQL owned by the Django LMS API.
- **Source of truth:** GitHub `main`.

Both frontend applications use `npm run build` → `dist/`, with SPA fallback configured by their respective `vercel.json` files.

## Runtime configuration

### Public website

Set:

```env
VITE_LMS_URL=https://portal.pixiutech.com
ENQUIRY_DELIVERY_ENDPOINT=https://formspree.io/f/<form-id>
```

`VITE_LMS_URL` is consumed by `src/config/runtime.js` as the single LMS URL authority. The enquiry form posts only to the same-origin `/api/enquiry` Vercel function. `ENQUIRY_DELIVERY_ENDPOINT` is server-side configuration and must not use the `VITE_` prefix.

### LMS frontend

Set:

```env
VITE_API_URL=https://<your-django-api-host>/api/v1
```

The LMS uses `pixiu-lms-portal/src/config/api.js` as its single API URL authority. The legacy `VITE_DJANGO_API_URL=https://<your-django-api-host>/api` variable is accepted only for the Phase 6 admin operations page and is normalized to `/api/v1`.

The frontend has no localhost fallback and no browser-side database fallback. PostgreSQL/API is authoritative for application records. GET requests tolerate Render cold-start responses with bounded retry/backoff; writes are never retried automatically to avoid duplicates.

### LMS API

The Django backend requires deployment environment variables for its PostgreSQL database, JWT signing secret, allowed hosts, and frontend CORS/CSRF origins. No production credentials belong in Git.

Required production configuration is documented in `PHASE_8_DEPLOYMENT.md` and `pixiu-backend/.env.example`.

## Routing ownership

- Public website routes stay in the root application.
- LMS routes stay in `pixiu-lms-portal/`.
- `https://pixiutech.com/login` forwards users to the canonical LMS login.
- `https://portal.pixiutech.com/login` is the actual LMS login screen.
- The circuit lab lives only in the LMS portal; the root `/simulation` route forwards there.

## Forms and security

Public enquiries are handled by the website's server-side `/api/enquiry` function. The browser never calls the third-party delivery endpoint directly. The endpoint validates the payload, checks the allowed origin, applies a small in-memory rate limit, rejects a honeypot field, and forwards the enquiry server-side.

The website does not attempt to block browser context menus, keyboard shortcuts, DevTools, or inspection tools. Those controls are not treated as security boundaries.

## Protected materials and uploads

Protected teaching materials should not be placed inside frontend `public/` directories. Student/project evidence is intended to be private application data and should be stored through the authenticated Django API rather than as a public static asset.

Do not place private teaching packs, answer keys, student/parent personal data, database snapshots, or runtime secrets under `public/` or frontend source directories.

## Development

Public website:

```bash
npm install
npm run dev
npm run build
```

LMS frontend:

```bash
cd pixiu-lms-portal
npm install
npm run dev
npm run build
```

Django API:

```bash
cd pixiu-backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

For production, use the Render configuration in `render.yaml` rather than Django's development server.

## Verification

The GitHub Actions workflow runs Django deployment checks, migration-drift checks, the Django test suite against PostgreSQL 16, Python compilation, static collection, and both Vite production builds.

Deployment smoke checks are available in `scripts/e2e-smoke.mjs`. See `PHASE_8_DEPLOYMENT.md` for the Render/Vercel setup and end-to-end verification flow.
