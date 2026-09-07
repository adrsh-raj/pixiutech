// Canonical Phase-7 API endpoint. The portal no longer defaults to the legacy Node API.
// Set VITE_API_URL to the Django API root, normally ending in /api/v1.
const rawApiBase = import.meta.env.VITE_API_URL?.trim() || import.meta.env.VITE_DJANGO_API_URL?.trim();

function normalizeApiBase(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    throw new Error('VITE_API_URL must point to the Django /api/v1 endpoint.');
  }
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported API URL protocol.');
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error(`Invalid VITE_API_URL: ${error.message}`);
  }
}

export const API_BASE = normalizeApiBase(rawApiBase);
export const API_URL = API_BASE;
