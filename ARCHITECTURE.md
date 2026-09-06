# PIXIU Tech Production Architecture

## Production ownership

- Root application: public PIXIU Tech website on Vercel.
- `pixiu-lms-portal/`: canonical LMS web application on Vercel.
- `pixiu-lms-portal/server/`: canonical LMS API on Render.
- Database state belongs to the LMS backend. Browser localStorage may cache session/fetched data for UX, but is never an authentication or persistence authority.

## Routing ownership

- `https://pixiutech.com/login` redirects to the canonical LMS login.
- `https://portal.pixiutech.com/login` is the actual LMS authentication screen.
- Public website routes stay in the root Vite app.
- LMS routes stay inside `pixiu-lms-portal`.

## Configuration ownership

- Public website portal URL: `VITE_LMS_URL`, with a production-host-derived fallback only on the official PIXIU production hostname.
- LMS API URL: `VITE_API_URL`; browser code has no localhost or baked Render API fallback.
- JWT signing secret: server environment variable `JWT_SECRET` only.

## Removed duplicate runtime authorities

- Root legacy login implementation removed.
- Root legacy resource hub removed.
- Root legacy student portal removed.
- Standalone `virtual-circuit-lab/` application removed; the remaining circuit-lab implementation is the source used by the production apps.
- Netlify deployment configuration removed; Vercel is the public website deployment authority.

## Deployment rule

GitHub is the source of truth. Vercel deploys the public and LMS frontends from this repository, while Render runs the LMS API. Runtime URLs and secrets are supplied through deployment environment variables rather than source code.
