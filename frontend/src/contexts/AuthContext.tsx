import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  login: (token: string, user?: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('leadflow_token');
    const u = localStorage.getItem('leadflow_user');
    if (t) {
      setToken(t);
      (api.defaults.headers as any).Authorization = `Bearer ${t}`;
    }
    if (u) {
      try { setUser(JSON.parse(u)); } catch {}
    }
  }, []);

  const login = (newToken: string, newUser?: any) => {
    setToken(newToken);
    localStorage.setItem('leadflow_token', newToken);
    (api.defaults.headers as any).Authorization = `Bearer ${newToken}`;
    if (newUser) {
      setUser(newUser);
      localStorage.setItem('leadflow_user', JSON.stringify(newUser));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('leadflow_token');
    localStorage.removeItem('leadflow_user');
    delete (api.defaults.headers as any).Authorization;
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: Boolean(token), token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

