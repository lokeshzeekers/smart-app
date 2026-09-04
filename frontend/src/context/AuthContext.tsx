import React, { createContext, useContext, useEffect, useState } from 'react';
import { connectSocket, disconnectSocket } from '../api/socket';

export type Role = 'trainee' | 'trainer' | 'admin';

export interface SmartUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  institution_id: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: SmartUser | null;
  token: string | null;
  login: (token: string, user: SmartUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SmartUser | null>(() => {
    const stored = localStorage.getItem('smart_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('smart_token'));

  useEffect(() => {
    if (token) connectSocket(token);
    return () => disconnectSocket();
  }, [token]);

  const login = (newToken: string, newUser: SmartUser) => {
    localStorage.setItem('smart_token', newToken);
    localStorage.setItem('smart_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('smart_token');
    localStorage.removeItem('smart_user');
    disconnectSocket();
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
