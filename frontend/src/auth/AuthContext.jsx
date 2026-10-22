import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearAuthSession, getAuthToken, setAuthSession } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getAuthToken()));

  useEffect(() => {
    // Never trust client-side role keys; always verify token against /api/auth/me
    try {
      sessionStorage.removeItem('dairytrace.demoRole');
    } catch {
      // Ignore
    }

    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    api
      .getMe()
      .then((verifiedUser) => {
        if (!active) return;
        setAuthSession(token, verifiedUser);
        setUser(verifiedUser);
      })
      .catch(() => {
        if (!active) return;
        clearAuthSession();
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthSession();
      setUser(null);
    };
    window.addEventListener('dairytrace:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('dairytrace:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.login(email, password);
    const verifiedUser = response?.user || (await api.getMe());
    setAuthSession(response.access_token, verifiedUser);
    setUser(verifiedUser);
    return verifiedUser;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const role = user?.role || '';
    const isInspector = role === 'INSPECTOR';
    const isQA = role === 'QA_OFFICER';
    const isStaff = isInspector || isQA;
    return {
      user,
      role,
      loading,
      isAuthenticated: Boolean(user && isStaff),
      isInspector,
      isQA,
      isStaff,
      login,
      logout,
    };
  }, [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
