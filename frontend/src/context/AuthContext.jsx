import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { withApiBase } from '../utils/api';

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL = 10000; // check every 10 seconds
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
const SESSION_KEY = 'mrmhub_session';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const intervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const loggedInRef = useRef(false);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // On mount: if no session marker, tab was closed — force re-login
  useEffect(() => {
    if (token && !sessionStorage.getItem(SESSION_KEY)) {
      setSessionExpired(true);
      logout();
    }
  }, []);

  // Inactivity tracker — only active when user is logged in
  useEffect(() => {
    loggedInRef.current = !!user;

    if (!user) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    sessionStorage.setItem(SESSION_KEY, '1');
    lastActivityRef.current = Date.now();
    localStorage.setItem('lastActivity', String(Date.now()));

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
      localStorage.setItem('lastActivity', String(Date.now()));
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

    // Periodically check if inactive too long
    intervalRef.current = setInterval(() => {
      if (!loggedInRef.current) return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT) {
        setSessionExpired(true);
        logout();
      }
    }, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, recordActivity));
    };
  }, [user, logout]);

  // On mount, validate existing token
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(withApiBase('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setLoading(false);
      });
  }, [token]);

  const login = async (email, password, otp) => {
    const body = { email, password };
    if (otp) body.otp = otp;
    const res = await fetch(withApiBase('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    if (data.requireOtp) return { requireOtp: true };
    localStorage.setItem('token', data.token);
    sessionStorage.setItem(SESSION_KEY, '1');
    setToken(data.token);
    setUser(data.user);
    setSessionExpired(false);
    return data.user;
  };

  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(withApiBase(url), { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Session expired');
    }
    return res;
  };

  const dismissSessionExpired = () => setSessionExpired(false);

  const isAdmin = user?.roles?.includes('admin') || false;
  const isLead = user?.roles?.includes('lead') || false;
  const isFullAccess = isAdmin || isLead;
  const hasRole = (role) => user?.roles?.includes(role) || false;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch, isAdmin, isLead, isFullAccess, hasRole, sessionExpired, dismissSessionExpired }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
