# Login timing

The login flow records a user-perceived end-to-end timing measurement as `login.e2e` in `window.__PIXIU_PERF__.measures()` / `sessionStorage` under `pixiu_phase0_perf`.

The measurement starts immediately before the login request and ends after a successful response has been parsed and auth state has been committed to React state/memory.
