// Single runtime API authority for the Pixiu LMS frontend.
// Configure VITE_API_URL in the LMS deployment environment.
const configuredApiBase = import.meta.env.VITE_API_URL?.trim();

if (!configuredApiBase) {
  throw new Error('VITE_API_URL is required for the Pixiu LMS frontend.');
}

export const API_BASE = configuredApiBase.replace(/\/$/, '');
export const API_URL = API_BASE;
