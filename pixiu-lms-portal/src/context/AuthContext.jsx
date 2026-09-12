import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config/api';

const AuthContext = createContext(null);
const AUTH_EVENT = 'pixiu_auth_state_changed';
let accessTokenMemory = null;
let refreshPromise = null;

function broadcastAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
  try { window.localStorage.setItem(`${AUTH_EVENT}:${Date.now()}`, '1'); } catch {}
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
  try {
    const signal = options.signal || controller.signal;
    return await fetch(url, { ...options, signal, credentials: options.credentials || 'include' });
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

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetchOnce(`${API_BASE}/auth/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), cache: 'no-store' }, 20000);
      const data = await readJson(response);
      if (!response.ok || !data.access) {
        accessTokenMemory = null;
        return null;
      }
      accessTokenMemory = data.access;
      return data.access;
    } catch {
      accessTokenMemory = null;
      return null;
    } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const request = async (accessToken) => {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetchWithRetry(`${API_BASE}${path}`, { ...options, headers, cache: options.cache || 'no-store', credentials: 'include' });
  };

  let response = await request(accessTokenMemory);
  if (response.status === 401 && !String(path).startsWith('/auth/')) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      response = await request(nextToken);
    } else {
      clearAuthStorage();
      broadcastAuthChange();
    }
  }
  return response;
}

export function clearAuthStorage() {
  accessTokenMemory = null;
  clearLegacyAuthStorage();
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => accessTokenMemory);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
        const access = await refreshAccessToken();
        if (!access) throw new Error('No refresh session');
        const response = await fetchWithRetry(`${API_BASE}/auth/me/`, { headers: { Authorization: `Bearer ${access}` }, cache: 'no-store', credentials: 'include' });
        if (!response.ok) throw new Error('Session expired');
        const data = await readJson(response);
        if (!data.user?.id || !data.user?.role) throw new Error('Invalid session response');
        if (active) {
          accessTokenMemory = access;
          setToken(access);
          setUser(data.user);
        }
      } catch {
        clearAuthStorage();
        if (active) { setToken(null); setUser(null); }
      } finally { if (active) setLoading(false); }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const refresh = async () => {
      const next = await refreshAccessToken();
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
    const cleanUsername = username?.trim(); const cleanPassword = password ?? '';
    if (!cleanUsername || !cleanPassword) return { success: false, error: 'Username and password are required.' };
    const body = JSON.stringify({
      username: cleanUsername,
      password: cleanPassword,
      role: expectedRole || undefined,
      turnstile_token: turnstileToken || undefined,
    });
    let lastError = null;
    for (const delay of [0, 2000, 5000]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const response = await fetchOnce(`${API_BASE}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store', credentials: 'include' }, 25000);
        const data = await readJson(response);
        if (response.ok && data.access && data.user) {
          accessTokenMemory = data.access;
          setToken(data.access);
          setUser(data.user);
          broadcastAuthChange();
          return { success: true, user: data.user };
        }
        if (![502, 503, 504].includes(response.status)) return { success: false, error: data.detail || data.error || 'Invalid username or password.' };
        lastError = new Error(data.detail || 'Authentication service is waking up.');
      } catch (error) { lastError = error; }
    }
    return { success: false, error: lastError?.name === 'AbortError' ? 'Authentication service is taking too long to respond. Please try again.' : 'Authentication service is waking up or temporarily unavailable. Please try again.' };
  };

  const logout = async () => {
    try {
      await fetchOnce(`${API_BASE}/auth/logout/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), cache: 'no-store', credentials: 'include' }, 15000);
    } catch {} finally {
      setUser(null); setToken(null); clearAuthStorage(); broadcastAuthChange();
    }
  };

  const value = useMemo(() => ({ user, token, role: user?.role || null, isAuthenticated: Boolean(user && token), loading, login, logout }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; };