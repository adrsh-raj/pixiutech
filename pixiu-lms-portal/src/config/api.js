export const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : (import.meta.env.VITE_API_URL || '/api');

export const API_URL = API_BASE;
