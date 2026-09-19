import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../config/api';
import { measurePerformance, markPerformance, recordApiPerformance } from '../lib/performanceDiagnostics';

const AuthContext = createContext(null);
const AUTH_EVENT = 'pixiu_auth_state_changed';
const AUTH_LOGOUT_KEY = 'pixiu_portal_logout_at';
const SESSION_ROLE_KEY = 'pixiu_session_role';
const AUTH_REQUEST_TIMEOUT_MS = 60000;
const LOGIN_REQUEST_TIMEOUT_MS = 60000;
const PORTAL_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const PORTAL_ACTIVITY_PERSIST_MS = 15 * 1000;
const PORTAL_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const PORTAL_IDLE_MESSAGE = 'You were signed out after 10 minutes of inactivity. Please sign in again.';
const API_READ_CACHE_TTL_MS = 30 * 1000;
const API_READ_CACHE_MAX_ENTRIES = 250;
let accessTokenMemory = null;
let refreshPromise = null;
let csrfTokenMemory = null;
const apiReadCache = new Map();

function clearApiReadCache() { apiReadCache.clear(); }
function pruneApiReadCache(now = Date.now()) {
  for (const [key, entry] of apiReadCache) if (now - entry.createdAt > API_READ_CACHE_TTL_MS) apiReadCache.delete(key);
  while (apiReadCache.size > API_READ_CACHE_MAX_ENTRIES) {
    const oldestKey = apiReadCache.keys().next().value;
    if (oldestKey === undefined) break;
    apiReadCache.delete(oldestKey);
  }
}
function isCacheableRead(path, method, accessToken, requestedCache = '') {
  if (!accessToken || !['GET', 'HEAD'].includes(method)) return false;
  if (String(requestedCache || '').toLowerCase() === 'no-store') return false;
  const normalizedPath = String(path || '');
  if (normalizedPath.startsWith('/auth/')) return false;
  if (normalizedPath === '/health' || normalizedPath.startsWith('/health/')) return false;
  if (/^\/content\/[^/]+\/file\/?$/.test(normalizedPath)) return false;
  if (/^\/careers\/applications\/[^/]+\/cv\/?$/.test(normalizedPath)) return false;
  return true;
}
function buildReadCacheKey(path, method, accessToken) { return `${method}:${accessToken}:${path}`; }
function getSessionRole() {
  try { return String(window.sessionStorage.getItem(SESSION_ROLE_KEY) || '').trim().toLowerCase() || null; }
  catch { return null; }
}
function setSessionRole(role) {
  try { if (role) window.sessionStorage.setItem(SESSION_ROLE_KEY, String(role).trim().toLowerCase()); else window.sessionStorage.removeItem(SESSION_ROLE_KEY); }
  catch {}
}
function broadcastAuthChange() { window.dispatchEvent(new Event(AUTH_EVENT)); }
function clearLegacyAuthStorage() {
  try {
    ['pixiu_auth_token', 'pixiu_auth_refresh_token', 'pixiu_auth_user'].forEach(key => window.localStorage.removeItem(key));
    Object.keys(window.localStorage).filter(key => key.startsWith('pixiu_') && key.includes(':')).forEach(key => window.localStorage.removeItem(key));
  } catch {}
}
async function readJson(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return {};
  return response.json().catch(() => ({}));
}
async function fetchOnce(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const method = String(options.method || 'GET').toUpperCase();
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const signal = options.signal || controller.signal;
    const response = await fetch(url, { ...options, signal, credentials: options.credentials || 'include' });
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const safePath = String(url).startsWith(API_BASE) ? String(url).slice(API_BASE.length) : '/external';
    recordApiPerformance(safePath, method, { durationMs: ended - started, status: response.status, cached: false });
    return response;
  } catch (error) {
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const safePath = String(url).startsWith(API_BASE) ? String(url).slice(API_BASE.length) : '/external';
    recordApiPerformance(safePath, method, { durationMs: ended - started, status: 0, cached: false });
    throw error;
  } finally { window.clearTimeout(timer); }
}
async function fetchWithRetry(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  const delays = retryable ? [0, 1500, 4000] : [0];
  let lastResponse;
  let lastError;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    try {
      const response = await fetchOnce(url, options, 20000);
      lastResponse = response;
      if (response.ok || !retryable || ![502, 503, 504].includes(response.status) || attempt === delays.length - 1) return response;
    } catch (error) {
      lastError = error;
      if (!retryable || attempt === delays.length - 1) throw error;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error('Request failed.');
}
async function getCsrfToken(force = false) {
  if (csrfTokenMemory && !force) return csrfTokenMemory;
  const response = await fetchOnce(`${API_BASE}/auth/csrf/`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }, 15000);
  const data = await readJson(response);
  if (!response.ok || !data.csrfToken) throw new Error('Unable to initialize the security token.');
  csrfTokenMemory = String(data.csrfToken);
  return csrfTokenMemory;
}
async function authPostWithRetry(url, options = {}) {
  let lastError = null;
  const cookieAuthEndpoint = /\/auth\/(login|refresh|logout)\/$/.test(String(url));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const headers = new Headers(options.headers || {});
      if (cookieAuthEndpoint) headers.set('X-CSRFToken', await getCsrfToken(attempt > 0));
      const response = await fetchOnce(url, { ...options, headers }, AUTH_REQUEST_TIMEOUT_MS);
      if (response.status === 403 && cookieAuthEndpoint && attempt === 0) {
        csrfTokenMemory = null;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error?.name !== 'AbortError' || attempt === 1) throw error;
    }
  }
  throw lastError || new Error('Authentication request failed.');
}
async function refreshAccessToken(roleHint = null) {
  if (refreshPromise) return refreshPromise;
  const role = String(roleHint || getSessionRole() || '').trim().toLowerCase();
  refreshPromise = (async () => {
    try {
      const response = await authPostWithRetry(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role || undefined }),
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await readJson(response);
      if (!response.ok || !data.access) return null;
      accessTokenMemory = data.access;
      return data.access;
    } catch { return null; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}
function responseFromCache(entry) {
  recordApiPerformance(entry.path || '/', entry.method || 'GET', { durationMs: 0, status: entry.status, cached: true });
  return new Response(entry.body, { status: entry.status, statusText: entry.statusText, headers: new Headers(entry.headers) });
}
export async function apiFetch(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const request = async (accessToken) => {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const cacheableRead = isCacheableRead(path, method, accessToken, options.cache);
    const cacheKey = cacheableRead ? buildReadCacheKey(path, method, accessToken) : null;
    if (cacheKey) {
      const now = Date.now(); pruneApiReadCache(now);
      const cached = apiReadCache.get(cacheKey);
      if (cached && now - cached.createdAt <= API_READ_CACHE_TTL_MS) return responseFromCache({ ...cached, path, method });
      if (cached) apiReadCache.delete(cacheKey);
    }
    const response = await fetchWithRetry(`${API_BASE}${path}`, { ...options, headers, cache: cacheableRead ? 'no-store' : (options.cache || 'no-store'), credentials: 'include' });
    if (response.ok && cacheKey) {
      const body = await response.clone().text();
      apiReadCache.set(cacheKey, { createdAt: Date.now(), status: response.status, statusText: response.statusText, headers: Array.from(response.headers.entries()), body });
      pruneApiReadCache();
    }
    return response;
  };
  let response = await request(accessTokenMemory);
  if (response.status === 401 && !String(path).startsWith('/auth/')) {
    const nextToken = await refreshAccessToken(getSessionRole());
    if (nextToken) response = await request(nextToken);
    else {
      accessTokenMemory = null;
      clearApiReadCache();
      window.dispatchEvent(new Event(AUTH_EVENT));
    }
  }
  if (response.ok && !['GET', 'HEAD'].includes(method)) clearApiReadCache();
  return response;
}
export function clearAuthStorage({ clearRole = true } = {}) {
  accessTokenMemory = null;
  csrfTokenMemory = null;
  clearApiReadCache();
  clearLegacyAuthStorage();
  if (clearRole) setSessionRole(null);
}
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => accessTokenMemory);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    clearLegacyAuthStorage();
    const syncAuthState = () => { setToken(accessTokenMemory); if (!accessTokenMemory) setUser(null); };
    const syncCrossTabLogout = event => {
      if (event.key !== AUTH_LOGOUT_KEY || !event.newValue) return;
      accessTokenMemory = null;
      clearApiReadCache();
      setToken(null);
      setUser(null);
      setSessionRole(null);
    };
    window.addEventListener(AUTH_EVENT, syncAuthState);
    window.addEventListener('storage', syncCrossTabLogout);
    return () => {
      window.removeEventListener(AUTH_EVENT, syncAuthState);
      window.removeEventListener('storage', syncCrossTabLogout);
    };
  }, []);
  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const roleHint = getSessionRole();
        const access = await refreshAccessToken(roleHint);
        if (!access) throw new Error('No refresh session');
        const response = await fetchWithRetry(`${API_BASE}/auth/me/`, { headers: { Authorization: `Bearer ${access}` }, cache: 'no-store', credentials: 'include' });
        if (!response.ok) throw new Error('Session expired');
        const data = await readJson(response);
        if (!data.user?.id || !data.user?.role) throw new Error('Invalid session response');
        if (active) { accessTokenMemory = access; setToken(access); setUser(data.user); setSessionRole(data.user.role); }
      } catch {
        clearAuthStorage({ clearRole: false });
        if (active) { setToken(null); setUser(null); }
      } finally { if (active) setLoading(false); }
    };
    restoreSession();
    return () => { active = false; };
  }, []);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!token) return undefined;
    const refresh = async () => {
      if (Date.now() - lastActivityRef.current >= PORTAL_IDLE_TIMEOUT_MS) return;
      const previousToken = accessTokenMemory;
      const next = await refreshAccessToken(getSessionRole());
      if (next) { accessTokenMemory = next; setToken(next); }
      else accessTokenMemory = previousToken;
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActivityRef.current >= PORTAL_IDLE_TIMEOUT_MS) return;
      void refresh();
    };
    const interval = window.setInterval(refresh, PORTAL_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [token]);
  const login = async (username, password, expectedRole = null, turnstileToken = null) => {
    const cleanUsername = username?.trim();
    const cleanPassword = password ?? '';
    if (!cleanUsername || !cleanPassword) return { success: false, error: 'Username and password are required.' };
    const body = JSON.stringify({ username: cleanUsername, password: cleanPassword, role: expectedRole || undefined, turnstile_token: turnstileToken || undefined });
    markPerformance('login.e2e.start');
    try {
      const response = await authPostWithRetry(`${API_BASE}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store', credentials: 'include' });
      const data = await readJson(response);
      if (response.ok && data.access && data.user) {
        clearApiReadCache(); accessTokenMemory = data.access; setToken(data.access); setUser(data.user); setSessionRole(data.user.role); broadcastAuthChange(); measurePerformance('login.e2e', 'login.e2e.start'); return { success: true, user: data.user };
      }
      measurePerformance('login.e2e.failed', 'login.e2e.start'); return { success: false, error: data.detail || data.error || 'Invalid username or password.' };
    } catch (error) {
      measurePerformance('login.e2e.failed', 'login.e2e.start'); return { success: false, error: error?.name === 'AbortError' ? 'Authentication service is taking too long to respond. Please wait a little longer and try again.' : 'Authentication service is temporarily unavailable. Please try again.' };
    }
  };
  const logout = async ({ reason = '' } = {}) => {
    if (reason === 'idle') {
      try { window.sessionStorage.setItem('pixiu_idle_logout_msg', PORTAL_IDLE_MESSAGE); } catch {}
    }
    const role = user?.role || getSessionRole();
    try {
      await authPostWithRetry(`${API_BASE}/auth/logout/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: role || undefined }), cache: 'no-store', credentials: 'include' });
    } catch {}
    finally {
      setUser(null);
      setToken(null);
      clearAuthStorage();
      try { window.localStorage.setItem(AUTH_LOGOUT_KEY, String(Date.now())); } catch {}
      broadcastAuthChange();
    }
  };

  useEffect(() => {
    if (!token || !user?.id || !user?.role) return undefined;

    const storageKey = `pixiu_portal_last_activity:${user.id}:${user.role}`;
    const now = Date.now();
    let persisted = 0;
    try { persisted = Number(window.localStorage.getItem(storageKey) || 0) || 0; } catch {}

    if (persisted && now - persisted >= PORTAL_IDLE_TIMEOUT_MS) {
      void logout({ reason: 'idle' });
      return undefined;
    }

    lastActivityRef.current = now;
    let lastPersisted = now;
    try { window.localStorage.setItem(storageKey, String(now)); } catch {}

    let lastEvent = 0;
    let idleLogoutStarted = false;

    const markActivity = () => {
      const current = Date.now();
      if (current - lastEvent < 1000) return;
      lastEvent = current;
      lastActivityRef.current = current;
      if (current - lastPersisted >= PORTAL_ACTIVITY_PERSIST_MS) {
        try { window.localStorage.setItem(storageKey, String(current)); } catch {}
        lastPersisted = current;
      }
    };

    const checkIdle = () => {
      if (idleLogoutStarted) return;
      if (Date.now() - lastActivityRef.current < PORTAL_IDLE_TIMEOUT_MS) return;
      idleLogoutStarted = true;
      void logout({ reason: 'idle' });
    };

    const onStorage = event => {
      if (event.key !== storageKey || !event.newValue) return;
      const next = Number(event.newValue) || 0;
      if (next > lastActivityRef.current) lastActivityRef.current = next;
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      checkIdle();
      if (!idleLogoutStarted) markActivity();
    };

    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'click'];
    events.forEach(eventName => window.addEventListener(eventName, markActivity, { passive: true }));
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(checkIdle, 1000);

    return () => {
      window.clearInterval(interval);
      events.forEach(eventName => window.removeEventListener(eventName, markActivity));
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token, user?.id, user?.role]);
  const value = useMemo(() => ({ user, token, role: user?.role || null, isAuthenticated: Boolean(user && token), loading, login, logout }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
