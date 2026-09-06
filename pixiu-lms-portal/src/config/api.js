// Single runtime API authority for the Pixiu LMS frontend.
// Production/preview deployments may override VITE_API_URL. When the variable
// is unavailable during a static build, use the deterministic same-origin
// /api base rather than crashing the bundle at module load time.
const rawApiBase = import.meta.env.VITE_API_URL?.trim() || '/api';

function normalizeApiBase(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '/api';

  if (candidate.startsWith('/')) {
    return candidate.replace(/\/$/, '') || '/api';
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Unsupported API URL protocol.');
    }
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error(`Invalid VITE_API_URL: ${error.message}`);
  }
}

export const API_BASE = normalizeApiBase(rawApiBase);
export const API_URL = API_BASE;
