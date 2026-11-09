import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [connection, setConnection] = useState('checking');

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'The request could not be completed.');
    }
    if (response.status === 204) return null;
    return response.json();
  }

  useEffect(() => {
    let cancelled = false;
    api('/health')
      .then(() => {
        if (!cancelled) setConnection('connected');
      })
      .catch(() => {
        if (!cancelled) setConnection('disconnected');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ connection, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
