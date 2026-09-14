# Phase 0 — Production Performance Baseline

Phase 0 is measurement-only. Do not tune workers, add indexes, add pagination, or change caching while collecting this baseline.

## 1. Production JS bundle size

Build the LMS and run the existing bundle report:

```powershell
cd pixiu-lms-portal
npm run build
node ..\tools\frontend_bundle_report.mjs
```

Record `js_total`, `css_total`, and the largest JS chunks. The Vite build output is also useful for checking route-level code splitting.

## 2–3. API p50/p95/p99 + DB query count/time

The Django diagnostics middleware is opt-in. In Render, temporarily set:

```text
PERF_DIAGNOSTICS=true
```

Do not permanently enable this in production after Phase 0. It adds measurement overhead by design.

After deployment, create a temporary access-token environment variable locally. Never paste a JWT into chat or commit it:

```powershell
$env:PIXIU_PERF_TOKEN = '<your temporary access token>'
```

Run the canonical matrix:

```powershell
cd "D:\git site\pixiutech"
python tools/perf_baseline.py `
  --base-url https://pixiu-django-api.onrender.com/api/v1 `
  --all-endpoints `
  --requests 100 `
  --concurrencies 1,10,25,50,100 `
  --auth-env PIXIU_PERF_TOKEN `
  --csv phase0-api.csv
```

The CSV contains, for every endpoint and concurrency level:

- p50 / p95 / p99 / mean / min / max request latency
- 2xx/3xx count
- 4xx/5xx count
- server/transport error count
- DB query-count p50 and max
- DB execution-time p50/p95/p99
- server-side request-duration p50/p95/p99

`/auth/me/` is included. The endpoint set also includes `/kits`, which is outside the original 17 DataContext resources but is part of the student production flow.

A 4xx response is reported as an HTTP error but does not fail the tool; a 5xx or transport failure does. This distinguishes an endpoint that is intentionally unauthorized for a role from an actual server-side failure.

## 4. Login end-to-end timing

Use Chrome DevTools with Network → Fetch/XHR and clear the network log before login. Record the `login/` request start-to-end duration, the following token refresh if any, and the first authenticated `/auth/me/` response. Do not export or share cookies, authorization headers, or tokens.

Repeat at least 10 times with a fresh tab/session and record p50/p95/p99 manually. Do not include a Turnstile challenge time in the API-only endpoint numbers; keep it as part of the true end-to-end user timing.

## 5. Dashboard Time-to-Interactive

Use Chrome DevTools → Performance with a fresh tab, enable screenshots, and record one clean navigation from login to the student dashboard. Capture:

- navigation start → first content paint
- navigation start → largest content paint
- DOMContentLoaded
- load event
- the first moment the dashboard is visibly usable and navigation/buttons accept input

The last value is the product-level TTI proxy for Pixiu. Use the same test account, device, browser and network profile for every baseline run. Do not compare manual TTI numbers from different environments.

The LMS also has opt-in browser diagnostics at `window.__PIXIU_PERF__` when `VITE_PERF_DIAGNOSTICS=true`, which can be used to inspect the API request summary without exposing request bodies or auth values.

## 6. 10 → 25 → 50 → 100 concurrent users

The matrix command above runs exactly these levels for every endpoint. For the baseline report, keep the sample count at 100 requests per endpoint per level so p99 is meaningful.

Do not interpret one noisy Render run as a regression. Run the same matrix twice and preserve both CSVs; use the second run as the primary warm comparison if the first run clearly includes service wake-up/cold-start behavior.

## Phase 0 completion gate

Phase 0 is complete when the following artifacts exist:

1. production `dist/assets` bundle report
2. one API matrix CSV for the selected production role/token
3. login p50/p95/p99 notes
4. dashboard TTI notes
5. concurrency matrix results with zero unexplained 5xx/transport failures

Only after this gate should Phase 2 fixes be evaluated quantitatively.
