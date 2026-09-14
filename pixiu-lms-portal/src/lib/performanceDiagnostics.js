const ENABLED = String(import.meta.env.VITE_PERF_DIAGNOSTICS || '').toLowerCase() === 'true';
const MAX_ENTRIES = 500;
const entries = [];
const measures = new Map();

const SAFE_ACTIONS = new Set([
  'status', 'stage', 'complete', 'unlock', 'issue', 'void', 'admin-override',
]);

function safePath(path) {
  const raw = String(path || '').split('?')[0].split('#')[0];
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return '/';
  const first = `/${parts[0]}`;
  const safe = [first];
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index];
    if (SAFE_ACTIONS.has(part)) safe.push(part);
    else safe.push(':id');
  }
  return safe.join('/');
}

function pushEntry(entry) {
  if (!ENABLED) return;
  entries.push(Object.freeze({
    ts: Date.now(),
    method: String(entry.method || 'GET').toUpperCase(),
    path: safePath(entry.path),
    status: Number(entry.status) || 0,
    durationMs: Number(entry.durationMs.toFixed(2)),
    cached: Boolean(entry.cached),
  }));
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

function snapshot() {
  return entries.map(entry => ({ ...entry }));
}

function measureSnapshot() {
  return [...measures.values()].map(item => ({ ...item }));
}

function summary() {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.method} ${entry.path}`;
    const group = groups.get(key) || { method: entry.method, path: entry.path, count: 0, errors: 0, durations: [] };
    group.count += 1;
    if (entry.status >= 400 || entry.status === 0) group.errors += 1;
    if (!entry.cached) group.durations.push(entry.durationMs);
    groups.set(key, group);
  }

  return [...groups.values()].map(group => {
    const values = [...group.durations].sort((a, b) => a - b);
    const percentile = p => values.length ? values[Math.min(values.length - 1, Math.floor((p / 100) * values.length))] : null;
    return {
      method: group.method,
      path: group.path,
      requests: group.count,
      errors: group.errors,
      p50Ms: percentile(50),
      p95Ms: percentile(95),
      p99Ms: percentile(99),
    };
  });
}

export function recordApiPerformance(path, method, data) {
  pushEntry({ path, method, ...data });
}

export function markPerformance(name) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  try { performance.mark(`pixiu:${String(name)}`); } catch {}
}

export function measurePerformance(name, startMark) {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return null;
  try {
    const measure = performance.measure(`pixiu:${String(name)}`, `pixiu:${String(startMark)}`);
    const durationMs = Number(measure.duration.toFixed(2));
    measures.set(String(name), Object.freeze({ name: String(name), durationMs, ts: Date.now() }));
    return durationMs;
  } catch {
    return null;
  }
}

// User-timing measurements are always available so production can be measured
// without enabling request-level diagnostics or logging extra application data.
if (typeof window !== 'undefined') {
  window.__PIXIU_PERF__ = Object.freeze({
    enabled: true,
    apiDiagnosticsEnabled: ENABLED,
    snapshot,
    summary,
    measures: measureSnapshot,
    clear: () => { entries.length = 0; measures.clear(); },
  });
}
