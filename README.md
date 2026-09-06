# Pixiu Tech

Pixiu Tech is a React/Vite education platform with two frontend applications and one LMS backend.

## Production architecture

- **Public website:** repository root, deployed on Vercel.
- **LMS portal:** `pixiu-lms-portal/`, deployed on Vercel as a separate Vite project with that directory as its Root Directory.
- **LMS API:** `pixiu-lms-portal/server/`, deployed on Render.
- **Database:** PostgreSQL owned by the LMS API.
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
VITE_API_URL=https://<your-lms-api-host>/api
```

The LMS uses `pixiu-lms-portal/src/config/api.js` as its single API URL authority. The value may be an absolute HTTP(S) URL or a same-origin `/api` path. One trailing slash is normalized away.

The frontend has no localhost fallback and no browser-side database fallback. PostgreSQL/API is authoritative for application records. GET requests tolerate Render cold-start responses with bounded retry/backoff; writes are never retried automatically to avoid duplicates.

### LMS API

The server requires deployment environment variables for its database, JWT signing secret, and CORS policy. No production credentials belong in Git.

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

Teacher master PDFs live outside web-public directories under `pixiu-lms-portal/server/private/materials/` and are served through authenticated API routes.

Uploaded student/project evidence is stored privately and served through authenticated API routes. There is no public `/uploads` static mount.

Do not place private teaching packs, answer keys, student/parent personal data, database snapshots, or runtime secrets under `public/` or frontend source directories.

## Development

```bash
npm install
npm run dev
npm run build
```

For the LMS frontend:

```bash
cd pixiu-lms-portal
npm install
npm run dev
npm run build
```

The LMS backend lives at `pixiu-lms-portal/server/` and is a separate Node service.

## Repository rules

Keep one canonical implementation for each production feature. Do not reintroduce legacy login/resource-hub apps, duplicate circuit-lab code, Netlify deployment files, browser-side database mocks, seed-data authentication, or browser credential fallbacks.
