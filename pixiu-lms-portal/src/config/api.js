// Single runtime API authority for the Pixiu LMS frontend.
// The portal is deployed separately from the API, so production must not
// silently fall back to the portal's own /api origin. VITE_API_URL can still
// override this for another environment/preview.
const DEFAULT_API_BASE = 'https://pixiu-lms-api.onrender.com/api';
const rawApiBase = import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_BASE;

function normalizeApiBase(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return DEFAULT_API_BASE;

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
