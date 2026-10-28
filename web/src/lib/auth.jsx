import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { session } from './session.js';

const AuthContext = createContext(null);

// Restores the user from a stored token on load; the token itself is never shown in the UI.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!session.get()) {
      setReady(true);
      return;
    }
    api.auth
      .me()
      .then((data) => setUser(data))
      .catch(() => session.clear())
      .finally(() => setReady(true));
  }, []);

  const start = useCallback((data) => {
    session.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback((values) => api.auth.login(values).then(start), [start]);
  const register = useCallback((values) => api.auth.register(values).then(start), [start]);

  const updateUser = useCallback((next) => setUser(next), []);

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, updateUser }),
    [user, ready, login, register, logout, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
