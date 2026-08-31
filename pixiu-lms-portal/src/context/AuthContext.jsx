import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : (import.meta.env.VITE_API_URL || '/api');

// Client Credentials Fallback Map for Vercel / Offline Deployments
const FALLBACK_USERS = [
  // Super Admin
  { username: 'adarshraj', password: 'Adarsg@pixiutech', role: 'admin', name: 'Adarsh Raj (Founder & Admin)', id: 'USR-ADMIN', related_id: 'ADM-01', school_id: 'ALL' },
  { username: 'admin', password: 'Adarsg@pixiutech', role: 'admin', name: 'Adarsh Raj (Founder & Admin)', id: 'USR-ADMIN-ALT', related_id: 'ADM-01', school_id: 'ALL' },
  
  // Primary Trainer
  { username: 'vikaspandey', password: 'Vikad@pixiutech', role: 'trainer', name: 'Vikas Pandey', id: 'USR-TR01', related_id: 'TR-01', school_id: 'ZPS' },
  { username: 'TR-01', password: 'Vikad@pixiutech', role: 'trainer', name: 'Vikas Pandey', id: 'USR-TR01-ALT', related_id: 'TR-01', school_id: 'ZPS' },
  
  // Class 6 Students (ZPSzenith6@hata)
  { username: 'ZPS6A 01', password: 'ZPSzenith6@hata', role: 'student', name: 'Aarav Sharma', id: 'USR-ZPS6A01', related_id: 'ZPS6A 01', school_id: 'ZPS' },
  { username: 'ZPS6A 02', password: 'ZPSzenith6@hata', role: 'student', name: 'Ananya Verma', id: 'USR-ZPS6A02', related_id: 'ZPS6A 02', school_id: 'ZPS' },
  { username: 'ZPS6A 03', password: 'ZPSzenith6@hata', role: 'student', name: 'Rohan Gupta', id: 'USR-ZPS6A03', related_id: 'ZPS6A 03', school_id: 'ZPS' },
  { username: 'ZPS6A 04', password: 'ZPSzenith6@hata', role: 'student', name: 'Ishita Singh', id: 'USR-ZPS6A04', related_id: 'ZPS6A 04', school_id: 'ZPS' },
  { username: 'ZPS6A 05', password: 'ZPSzenith6@hata', role: 'student', name: 'Kabir Mehta', id: 'USR-ZPS6A05', related_id: 'ZPS6A 05', school_id: 'ZPS' },

  // Class 7 Students (ZPSzenith7@hata)
  { username: 'ZPS7A 01', password: 'ZPSzenith7@hata', role: 'student', name: 'Devansh Tiwari', id: 'USR-ZPS7A01', related_id: 'ZPS7A 01', school_id: 'ZPS' },
  { username: 'ZPS7A 02', password: 'ZPSzenith7@hata', role: 'student', name: 'Meera Nair', id: 'USR-ZPS7A02', related_id: 'ZPS7A 02', school_id: 'ZPS' },
  { username: 'ZPS7A 03', password: 'ZPSzenith7@hata', role: 'student', name: 'Aditya Patel', id: 'USR-ZPS7A03', related_id: 'ZPS7A 03', school_id: 'ZPS' },
  { username: 'ZPS7A 04', password: 'ZPSzenith7@hata', role: 'student', name: 'Saanvi Joshi', id: 'USR-ZPS7A04', related_id: 'ZPS7A 04', school_id: 'ZPS' },
  { username: 'ZPS7A 05', password: 'ZPSzenith7@hata', role: 'student', name: 'Yash Vardhan', id: 'USR-ZPS7A05', related_id: 'ZPS7A 05', school_id: 'ZPS' },

  // Class 8 Students (ZPSzenith8@hata)
  { username: 'ZPS8A 01', password: 'ZPSzenith8@hata', role: 'student', name: 'Siddharth Roy', id: 'USR-ZPS8A01', related_id: 'ZPS8A 01', school_id: 'ZPS' },
  { username: 'ZPS8A 02', password: 'ZPSzenith8@hata', role: 'student', name: 'Diya Kapoor', id: 'USR-ZPS8A02', related_id: 'ZPS8A 02', school_id: 'ZPS' },
  { username: 'ZPS8A 03', password: 'ZPSzenith8@hata', role: 'student', name: 'Harsh Agarwal', id: 'USR-ZPS8A03', related_id: 'ZPS8A 03', school_id: 'ZPS' },
  { username: 'ZPS8A 04', password: 'ZPSzenith8@hata', role: 'student', name: 'Tanvi Saxena', id: 'USR-ZPS8A04', related_id: 'ZPS8A 04', school_id: 'ZPS' },
  { username: 'ZPS8A 05', password: 'ZPSzenith8@hata', role: 'student', name: 'Reyansh Dubey', id: 'USR-ZPS8A05', related_id: 'ZPS8A 05', school_id: 'ZPS' },

  // Class 9 Students (ZPSzenith9@hata)
  { username: 'ZPS9A 01', password: 'ZPSzenith9@hata', role: 'student', name: 'Arjun Reddy', id: 'USR-ZPS9A01', related_id: 'ZPS9A 01', school_id: 'ZPS' },
  { username: 'ZPS9A 02', password: 'ZPSzenith9@hata', role: 'student', name: 'Sneha Kulkarni', id: 'USR-ZPS9A02', related_id: 'ZPS9A 02', school_id: 'ZPS' },
  { username: 'ZPS9A 03', password: 'ZPSzenith9@hata', role: 'student', name: 'Varun Malhotra', id: 'USR-ZPS9A03', related_id: 'ZPS9A 03', school_id: 'ZPS' },
  { username: 'ZPS9A 04', password: 'ZPSzenith9@hata', role: 'student', name: 'Riya Sen', id: 'USR-ZPS9A04', related_id: 'ZPS9A 04', school_id: 'ZPS' },
  { username: 'ZPS9A 05', password: 'ZPSzenith9@hata', role: 'student', name: 'Dhruv Chauhan', id: 'USR-ZPS9A05', related_id: 'ZPS9A 05', school_id: 'ZPS' },

  // Class 11 Students (ZPSzenith11@hata)
  { username: 'ZPS11A 01', password: 'ZPSzenith11@hata', role: 'student', name: 'Aryan Srivastava', id: 'USR-ZPS11A01', related_id: 'ZPS11A 01', school_id: 'ZPS' },
  { username: 'ZPS11A 02', password: 'ZPSzenith11@hata', role: 'student', name: 'Pooja Bhatt', id: 'USR-ZPS11A02', related_id: 'ZPS11A 02', school_id: 'ZPS' },
  { username: 'ZPS11A 03', password: 'ZPSzenith11@hata', role: 'student', name: 'Nikhil Kashyap', id: 'USR-ZPS11A03', related_id: 'ZPS11A 03', school_id: 'ZPS' },
  { username: 'ZPS11A 04', password: 'ZPSzenith11@hata', role: 'student', name: 'Kavya Pandey', id: 'USR-ZPS11A04', related_id: 'ZPS11A 04', school_id: 'ZPS' },
  { username: 'ZPS11A 05', password: 'ZPSzenith11@hata', role: 'student', name: 'Shaurya Mishra', id: 'USR-ZPS11A05', related_id: 'ZPS11A 05', school_id: 'ZPS' },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pixiu_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('pixiu_auth_token') || null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.user) {
            setUser(data.user);
            localStorage.setItem('pixiu_auth_user', JSON.stringify(data.user));
          }
        } catch (e) {
          // If offline or on Vercel without backend, keep user from localStorage
          console.warn("API offline, using cached session.");
        }
      }
      setLoading(false);
    };

    verifySession();
  }, [token]);

  const login = async (username, password) => {
    const cleanUsername = username?.trim();
    const cleanPassword = password?.trim();

    // 1. First Attempt Live Backend Login
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
      });
      
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('pixiu_auth_token', data.token);
        localStorage.setItem('pixiu_auth_user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error && !data.error.includes('Failed to fetch')) {
          // Explicit invalid credentials from backend
          return { success: false, error: data.error };
        }
      }
    } catch (e) {
      console.warn("Backend API not reachable. Running client-side auth fallback...");
    }

    // 2. Seamless Client-Side Auth Fallback (For Vercel / Cloud Deployments)
    const match = FALLBACK_USERS.find(
      u => u.username.toLowerCase() === cleanUsername.toLowerCase() && u.password === cleanPassword
    );

    if (match) {
      const clientUser = {
        id: match.id,
        username: match.username,
        role: match.role,
        name: match.name,
        related_id: match.related_id,
        school_id: match.school_id
      };
      const clientToken = `token_${match.role}_${Date.now()}`;
      setToken(clientToken);
      setUser(clientUser);
      localStorage.setItem('pixiu_auth_token', clientToken);
      localStorage.setItem('pixiu_auth_user', JSON.stringify(clientUser));
      return { success: true, user: clientUser };
    }

    return { success: false, error: 'Invalid Username / Student ID or Password.' };
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pixiu_auth_token');
    localStorage.removeItem('pixiu_auth_user');
  };

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!user,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
