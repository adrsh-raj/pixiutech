# PIXIU Tech Production Architecture

## Production ownership

PIXIU uses one frontend deployment model and one backend deployment model:

- **Frontend deployments:** Vercel + Vite for both frontend applications.
  - Root application: public PIXIU Tech website.
  - `pixiu-lms-portal/`: canonical LMS web application.
- **Backend deployment:** Render for `pixiu-lms-portal/server/` (the LMS API).
- **Database:** PostgreSQL owned by the LMS backend.

GitHub `main` is the single production source branch. `master` is kept aligned with `main` and must not carry a separate application version.

## Routing ownership

- `https://pixiutech.com/login` redirects to the canonical LMS login.
- `https://portal.pixiutech.com/login` is the actual LMS authentication screen.
- Public website routes stay in the root Vite app.
- LMS routes stay inside `pixiu-lms-portal`.
- The circuit lab exists only in the LMS application; the root `/simulation` route redirects there.

## API configuration contract

- The LMS frontend has one API configuration authority: `pixiu-lms-portal/src/config/api.js`.
- `VITE_API_URL` is the preferred deployment value and should contain the complete API base, including `/api`.
- The frontend strips one trailing slash and accepts either an absolute HTTP(S) URL or a same-origin path.
- When `VITE_API_URL` is absent during a static build, the frontend falls back to `/api` so the bundle can still be built. Production deployments should set the canonical API origin explicitly; the fallback does not invent a Render hostname.
- No localhost URL or hard-coded provider URL is part of the production source.
- The public website uses `VITE_LMS_URL` for the LMS portal URL.
- JWT secrets, database credentials, and CORS configuration remain deployment environment variables only.

## Deployment configuration

Both Vercel applications use the same explicit Vite deployment contract: `npm run build` with `dist` as the output directory and SPA fallback to `index.html`.

- Root Vercel project: repository root.
- LMS Vercel project: Vercel Root Directory `pixiu-lms-portal`.
- Render service: `pixiu-lms-portal/server/`.

The LMS frontend does not contain its API server and the root website does not contain a second API implementation.

## Removed duplicate runtime authorities

- Root legacy login implementation removed.
- Root legacy resource hub removed.
- Root legacy student portal removed.
- Standalone `virtual-circuit-lab/` application removed.
- Netlify deployment configuration removed.
- Obsolete deployment trigger marker files removed.

## Operational rule

Do not add a second frontend host, a second API URL constant, or a second circuit-lab implementation. New runtime configuration belongs in deployment environment variables and the appropriate single config module.
