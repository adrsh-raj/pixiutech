// Canonical Phase-7 API endpoint. The portal no longer defaults to the legacy Node API.
// Set VITE_API_URL to the Django /api/v1 endpoint. The older VITE_DJANGO_API_URL
// is accepted only as a compatibility fallback and is normalized to /api/v1.
const explicitApiBase = import.meta.env.VITE_API_URL?.trim();
const legacyDjangoBase = import.meta.env.VITE_DJANGO_API_URL?.trim();

function normalizeApiBase(value, { allowApiRoot = false } = {}) {
  const candidate = String(value || '').trim();
  if (!candidate) throw new Error('Django API URL is not configured. Set VITE_API_URL.');
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported API URL protocol.');

    const pathname = url.pathname.replace(/\/+$/, '');
    if (allowApiRoot && pathname.endsWith('/api')) url.pathname = `${pathname}/v1`;
    else if (allowApiRoot && !pathname.endsWith('/api/v1')) url.pathname = `${pathname}/api/v1`;
    else url.pathname = pathname;

    return url.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error(`Invalid Django API URL: ${error.message}`);
  }
}

export const API_BASE = explicitApiBase
  ? normalizeApiBase(explicitApiBase)
  : normalizeApiBase(legacyDjangoBase, { allowApiRoot: true });
export const API_URL = API_BASE;
