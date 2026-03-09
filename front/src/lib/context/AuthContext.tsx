'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { login as apiLogin, getProfile, UserProfile, ROLE_IDS } from '@/lib/api/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isMerchant: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      setToken(stored);
      getProfile()
        .then((profile) => setUser(profile))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const accessToken = await apiLogin(email, password);
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    const profile = await getProfile();
    setUser(profile);
  };

  const isAdmin = user?.roleIds?.includes(ROLE_IDS.Admin) ?? false;
  const isMerchant = user?.roleIds?.includes(ROLE_IDS.Merchant) ?? false;

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAdmin, isMerchant, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
