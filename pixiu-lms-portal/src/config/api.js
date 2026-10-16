// Canonical Phase-7 API endpoint. Always normalize the configured value to the
// Django /api/v1 root so production cannot accidentally call a bare host or /api.
const explicitApiBase = import.meta.env.VITE_API_URL?.trim();
const legacyDjangoBase = import.meta.env.VITE_DJANGO_API_URL?.trim();

const defaultApiBase = 'https://pixiu-django-api.onrender.com/api/v1';

function normalizeApiBase(value) {
  const candidate = String(value || defaultApiBase).trim();

  if (candidate.startsWith('/')) {
    let pathname = candidate.replace(/\/+$/, '');
    if (!pathname || pathname === '/') pathname = '/api/v1';
    else if (pathname === '/api') pathname = '/api/v1';
    else if (pathname.endsWith('/api/v1')) pathname = pathname;
    else if (pathname.endsWith('/api/v1/')) pathname = pathname.slice(0, -1);
    else if (pathname.endsWith('/api')) pathname = `${pathname}/v1`;
    else pathname = `${pathname}/api/v1`;
    return pathname;
  }

  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported API URL protocol.');

    let pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') pathname = '/api/v1';
    else if (pathname === '/api') pathname = '/api/v1';
    else if (pathname.endsWith('/api/v1')) pathname = pathname;
    else if (pathname.endsWith('/api/v1/')) pathname = pathname.slice(0, -1);
    else if (pathname.endsWith('/api')) pathname = `${pathname}/v1`;
    else pathname = `${pathname}/api/v1`;

    url.pathname = pathname;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error(`Invalid Django API URL: ${error.message}`);
  }
}

export const API_BASE = normalizeApiBase(explicitApiBase || legacyDjangoBase);
export const API_URL = API_BASE;
