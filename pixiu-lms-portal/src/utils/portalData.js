export function asCollection(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

export function asText(value, fallback = '') {
  return value == null ? fallback : String(value).trim();
}

export function normalizeId(value) {
  return asText(value).replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeAssignments(value) {
  if (Array.isArray(value)) return value.map(item => asText(item)).filter(Boolean);
  const text = asText(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(item => asText(item)).filter(Boolean);
  } catch {
    // Fall back to delimiter parsing for legacy payloads.
  }
  return text.split(/[\s,;|]+/).map(item => item.trim()).filter(Boolean);
}

export function normalizeStatus(value, fallback = 'unknown') {
  const text = asText(value).toLowerCase();
  return text || fallback;
}

export function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? asText(value, fallback) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(`1970-01-01T${value}`);
  if (!Number.isNaN(date.getTime()) && /^\d{1,2}:\d{2}/.test(value)) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return asText(value, fallback);
}

export function normalizeApiError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const detail = error.detail || error.message || error.error;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (typeof error === 'object') {
    const first = Object.values(error).flat?.().find(item => typeof item === 'string' && item.trim());
    if (first) return first.trim();
  }
  return fallback;
}
