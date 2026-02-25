import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      api.get('/admin/auth/me')
        .then(data => { if (data.success) setUser(data.user); })
        .catch(() => localStorage.removeItem('admin_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Auto-refresh token every 12 hours
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.post('/admin/auth/refresh');
        if (data.success && data.token) {
          localStorage.setItem('admin_token', data.token);
        }
      } catch {
        logout();
      }
    }, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (username, password) => {
    const data = await api.post('/admin/auth/login', { username, password });
    if (data.success) {
      localStorage.setItem('admin_token', data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    await api.post('/admin/auth/logout').catch(() => {});
    localStorage.removeItem('admin_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
