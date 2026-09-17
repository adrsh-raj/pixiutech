import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../config/api';
import { measurePerformance, markPerformance, recordApiPerformance } from '../lib/performanceDiagnostics';

const AuthContext = createContext(null);
const AUTH_EVENT = 'pixiu_auth_state_changed';
const SESSION_ROLE_KEY = 'pixiu_session_role';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const API_READ_CACHE_TTL_MS = 30 * 1000;
const API_READ_CACHE_MAX_ENTRIES = 250;
let accessTokenMemory = null;
let refreshPromise = null;
const apiReadCache = new Map();

function clearApiReadCache() {
  apiReadCache.clear();
}

function pruneApiReadCache(now = Date.now()) {
  for (const [key, entry] of apiReadCache) {
    if (now - entry.createdAt > API_READ_CACHE_TTL_MS) apiReadCache.delete(key);
  }
  while (apiReadCache.size > API_READ_CACHE_MAX_ENTRIES) {
    const oldestKey = apiReadCache.keys().next().value;
    if (oldestKey === undefined) break;
    apiReadCache.delete(oldestKey);
  }
}

function isCacheableRead(path, method, accessToken) {
  if (!accessToken || !['GET', 'HEAD'].includes(method)) return false;
  const normalizedPath = String(path || '');
  if (normalizedPath.startsWith('/auth/')) return false;
  if (normalizedPath === '/health' || normalizedPath.startsWith('/health/')) return false;
  if (/^\/content\/[^/]+\/file\/?$/.test(normalizedPath)) return false;
  return true;
}

function buildReadCacheKey(path, method, accessToken) {
  return `${method}:${accessToken}:${path}`;
}

function getSessionRole() {
  try {
    return String(window.sessionStorage.getItem(SESSION_ROLE_KEY) || '').trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

function setSessionRole(role) {
  try {
    if (role) window.sessionStorage.setItem(SESSION_ROLE_KEY, String(role).trim().toLowerCase());
    else window.sessionStorage.removeItem(SESSION_ROLE_KEY);
  } catch {}
}

function broadcastAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

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
  } finally {
    window.clearTimeout(timer);
  }
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

async function refreshAccessToken(roleHint = null) {
  if (refreshPromise) return refreshPromise;
  const role = String(roleHint || getSessionRole() || '').trim().toLowerCase();
  refreshPromise = (async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const response = await fetchOnce(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ role: role || undefined }),
        cache: 'no-store',
        credentials: 'include',
      }, 20000);
      const data = await readJson(response);
      if (!response.ok || !data.access) {
        accessTokenMemory = null;
        clearApiReadCache();
        return null;
      }
      accessTokenMemory = data.access;
      return data.access;
    } catch {
      accessTokenMemory = null;
      clearApiReadCache();
      return null;
    } finally {
      refreshPromise = null;
    }
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

    const cacheableRead = isCacheableRead(path, method, accessToken);
    const cacheKey = cacheableRead ? buildReadCacheKey(path, method, accessToken) : null;
    if (cacheKey) {
      const now = Date.now();
      pruneApiReadCache(now);
      const cached = apiReadCache.get(cacheKey);
      if (cached && now - cached.createdAt <= API_READ_CACHE_TTL_MS) return responseFromCache({ ...cached, path, method });
      if (cached) apiReadCache.delete(cacheKey);
    }

    const response = await fetchWithRetry(`${API_BASE}${path}`, {
      ...options,
      headers,
      cache: cacheableRead ? 'no-store' : (options.cache || 'no-store'),
      credentials: 'include',
    });

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
      clearAuthStorage();
      broadcastAuthChange();
    }
  }
  if (response.ok && !['GET', 'HEAD'].includes(method)) clearApiReadCache();
  return response;
}

export function clearAuthStorage() {
  accessTokenMemory = null;
  clearApiReadCache();
  clearLegacyAuthStorage();
  setSessionRole(null);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => accessTokenMemory);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    clearLegacyAuthStorage();
    const syncAuthState = () => {
      setToken(accessTokenMemory);
      if (!accessTokenMemory) setUser(null);
    };
    window.addEventListener(AUTH_EVENT, syncAuthState);
    return () => window.removeEventListener(AUTH_EVENT, syncAuthState);
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
        if (active) {
          accessTokenMemory = access;
          setToken(access);
          setUser(data.user);
          setSessionRole(data.user.role);
        }
      } catch {
        clearAuthStorage();
        if (active) { setToken(null); setUser(null); }
      } finally {
        if (active) setLoading(false);
      }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const refresh = async () => {
      const next = await refreshAccessToken(getSessionRole());
      if (next) {
        accessTokenMemory = next;
        setToken(next);
      } else {
        clearAuthStorage();
        setToken(null);
        setUser(null);
        broadcastAuthChange();
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = window.setInterval(refresh, 10 * 60 * 1000);
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
      const response = await fetchOnce(`${API_BASE}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store', credentials: 'include' }, 25000);
      const data = await readJson(response);
      if (response.ok && data.access && data.user) {
        clearApiReadCache();
        accessTokenMemory = data.access;
        setToken(data.access);
        setUser(data.user);
        setSessionRole(data.user.role);
        broadcastAuthChange();
        measurePerformance('login.e2e', 'login.e2e.start');
        return { success: true, user: data.user };
      }
      measurePerformance('login.e2e.failed', 'login.e2e.start');
      return { success: false, error: data.detail || data.error || 'Invalid username or password.' };
    } catch (error) {
      measurePerformance('login.e2e.failed', 'login.e2e.start');
      return { success: false, error: error?.name === 'AbortError' ? 'Authentication service is taking too long to respond. Please try again.' : 'Authentication service is temporarily unavailable. Please try again.' };
    }
  };

  const logout = async () => {
    const role = user?.role || getSessionRole();
    try {
      await fetchOnce(`${API_BASE}/auth/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role || undefined }),
        cache: 'no-store',
        credentials: 'include',
      }, 15000);
    } catch {}
    finally {
      setUser(null);
      setToken(null);
      clearAuthStorage();
      broadcastAuthChange();
    }
  };

  useEffect(() => {
    if (!token) {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      return undefined;
    }

    let lastActivity = 0;
    const armIdleTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => { void logout(); }, IDLE_TIMEOUT_MS);
    };
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      armIdleTimer();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'];
    events.forEach(event => window.addEventListener(event, onActivity, { passive: true }));
    armIdleTimer();

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      events.forEach(event => window.removeEventListener(event, onActivity));
    };
  }, [token]);

  const value = useMemo(() => ({ user, token, role: user?.role || null, isAuthenticated: Boolean(user && token), loading, login, logout }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
