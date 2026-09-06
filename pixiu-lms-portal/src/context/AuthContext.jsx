import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'pixiu_auth_token';
const USER_KEY = 'pixiu_auth_user';

async function readJson(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return {};
  return response.json().catch(() => ({}));
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem(USER_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` }
        });

        if (!response.ok) throw new Error('Session expired');
        const data = await readJson(response);
        if (!data.user) throw new Error('Invalid session response');

        if (active) {
          setToken(savedToken);
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const login = async (username, password, expectedRole = null) => {
    const cleanUsername = username?.trim();
    const cleanPassword = password ?? '';

    if (!cleanUsername || !cleanPassword) {
      return { success: false, error: 'Username and password are required.' };
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
          role: expectedRole || undefined
        })
      });

      const data = await readJson(response);
      if (!response.ok || !data.token || !data.user) {
        return { success: false, error: data.error || 'Invalid username or password.' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new Event('pixiu_auth_state_changed'));
      return { success: true, user: data.user };
    } catch {
      // Authentication must fail closed. Never authenticate from browser-stored credentials.
      return {
        success: false,
        error: 'Authentication service is unavailable. Please try again shortly.'
      };
    }
  };

  const logout = async () => {
    const currentToken = token;
    try {
      if (currentToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` }
        });
      }
    } catch {
      // Local session cleanup still happens if the API is unavailable.
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      Object.keys(localStorage).filter(key => key.startsWith('pixiu_') && key.includes(':')).forEach(key => localStorage.removeItem(key));
      window.dispatchEvent(new Event('pixiu_auth_state_changed'));
    }
  };

  const value = useMemo(() => ({
    user,
    token,
    role: user?.role || null,
    isAuthenticated: Boolean(user && token),
    loading,
    login,
    logout
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
