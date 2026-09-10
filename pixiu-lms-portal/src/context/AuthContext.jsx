import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'pixiu_auth_token';
const REFRESH_KEY = 'pixiu_auth_refresh_token';
const USER_KEY = 'pixiu_auth_user';
let refreshPromise = null;

async function readJson(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return {};
  return response.json().catch(() => ({}));
}

function saveSession(access, refresh, user) {
  localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function fetchOnce(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const signal = options.signal || controller.signal;
    return await fetch(url, { ...options, signal });
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
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return null;
    try {
      const response = await fetchOnce(`${API_BASE}/auth/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }), cache: 'no-store' }, 20000);
      const data = await readJson(response);
      if (!response.ok || !data.access) return null;
      localStorage.setItem(TOKEN_KEY, data.access);
      if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
      return data.access;
    } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const request = async (accessToken) => {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetchWithRetry(`${API_BASE}${path}`, { ...options, headers, cache: options.cache || 'no-store' });
  };
  let accessToken = localStorage.getItem(TOKEN_KEY);
  let response = await request(accessToken);
  if (response.status === 401 && !String(path).startsWith('/auth/')) {
    accessToken = await refreshAccessToken();
    if (accessToken) response = await request(accessToken);
  }
  return response;
}

export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) { if (active) { setToken(null); setUser(null); setLoading(false); } return; }
      try {
        const response = await apiFetch('/auth/me/');
        if (!response.ok) throw new Error('Session expired');
        const data = await readJson(response);
        if (!data.user?.id || !data.user?.role) throw new Error('Invalid session response');
        if (active) { setToken(localStorage.getItem(TOKEN_KEY)); setUser(data.user); localStorage.setItem(USER_KEY, JSON.stringify(data.user)); }
      } catch { clearAuthStorage(); if (active) { setToken(null); setUser(null); } }
      finally { if (active) setLoading(false); }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const refresh = async () => { const next = await refreshAccessToken(); if (next) setToken(next); };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = window.setInterval(refresh, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [token]);

  const login = async (username, password, expectedRole = null) => {
    const cleanUsername = username?.trim(); const cleanPassword = password ?? '';
    if (!cleanUsername || !cleanPassword) return { success: false, error: 'Username and password are required.' };
    const body = JSON.stringify({ username: cleanUsername, password: cleanPassword, role: expectedRole || undefined });
    let lastError = null;
    for (const delay of [0, 2000, 5000]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const response = await fetchOnce(`${API_BASE}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store' }, 25000);
        const data = await readJson(response);
        if (response.ok && data.access && data.refresh && data.user) {
          setToken(data.access); setUser(data.user); saveSession(data.access, data.refresh, data.user); window.dispatchEvent(new Event('pixiu_auth_state_changed')); return { success: true, user: data.user };
        }
        if (![502, 503, 504].includes(response.status)) return { success: false, error: data.detail || data.error || 'Invalid username or password.' };
        lastError = new Error(data.detail || 'Authentication service is waking up.');
      } catch (error) { lastError = error; }
    }
    return { success: false, error: lastError?.name === 'AbortError' ? 'Authentication service is taking too long to respond. Please try again.' : 'Authentication service is waking up or temporarily unavailable. Please try again.' };
  };

  const logout = async () => {
    const currentToken = token || localStorage.getItem(TOKEN_KEY); const refresh = localStorage.getItem(REFRESH_KEY);
    try { if (currentToken && refresh) await fetchOnce(`${API_BASE}/auth/logout/`, { method: 'POST', headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }), cache: 'no-store' }, 15000); } catch {} finally {
      setUser(null); setToken(null); clearAuthStorage(); Object.keys(localStorage).filter(key => key.startsWith('pixiu_') && key.includes(':')).forEach(key => localStorage.removeItem(key)); window.dispatchEvent(new Event('pixiu_auth_state_changed'));
    }
  };

  const value = useMemo(() => ({ user, token, role: user?.role || null, isAuthenticated: Boolean(user && token), loading, login, logout }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; };
