// Single production API authority for the entire Pixiu LMS application.
// Browser storage may cache session state, but all authenticated data comes from this API.
const configuredApiBase = import.meta.env.VITE_API_URL?.trim();

export const API_BASE = (configuredApiBase || 'https://pixiu-lms-api.onrender.com/api').replace(/\/$/, '');
export const API_URL = API_BASE;
