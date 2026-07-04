import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import GuestModal from '../components/GuestModal';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  // loading = true while the startup session check is in flight.
  // Route guards block rendering until this resolves so there are no flashes
  // or premature redirects to /login on a valid-cookie page refresh.
  const [loading, setLoading] = useState(true);

  const [guestModal, setGuestModal] = useState({ isOpen: false, message: '' });

  // ── Startup session restore ────────────────────────────────────────────────
  // On every page load / refresh, ask the backend whether the httpOnly cookie
  // is still valid.  A 401 means "no active session" — stay null, no redirect.
  // The api.js interceptor already skips session-expired events for /auth/me
  // (it's an auth endpoint), so there is no risk of an infinite redirect loop.
  useEffect(() => {
    let active = true;
    api.get('/auth/me')
      .then(res => { if (active) setUser(res.data.user); })
      .catch(() => {}) // 401 = not logged in; stay null
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Mid-session expiry ─────────────────────────────────────────────────────
  // When a protected API call returns 401 (token expired or revoked mid-session),
  // api.js dispatches this event so we can clear state without a full-page reload.
  useEffect(() => {
    const handleExpired = () => setUser(null);
    window.addEventListener('auth:session-expired', handleExpired);
    return () => window.removeEventListener('auth:session-expired', handleExpired);
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  const login = async (email, password, rememberMe = false) => {
    const res = await api.post('/auth/login', { email, password, rememberMe });
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', {
      name, email, password, consentGiven: 'true',
    });
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token');
    sessionStorage.clear();
    setUser(null);
  };

  // Call after a user action that changes profile data (e.g. completing onboarding).
  // Only safe to call when a session is already active.
  const refreshUser = async () => {
    const res = await api.get('/auth/me');
    setUser(res.data.user);
    return res.data.user;
  };

  // ── Role helpers ──────────────────────────────────────────────────────────────
  const isGuest = !user;
  const isUser  = user?.role === 'user';
  const isAdmin = user?.role === 'admin';

  // ── Guest modal helpers ───────────────────────────────────────────────────────
  const showGuestModal = useCallback((message = '') => {
    setGuestModal({ isOpen: true, message });
  }, []);

  const hideGuestModal = useCallback(() => {
    setGuestModal({ isOpen: false, message: '' });
  }, []);

  const requireAuth = useCallback((message = '') => {
    if (user) return true;
    showGuestModal(message);
    return false;
  }, [user, showGuestModal]);

  return (
    <AuthContext.Provider value={{
      user, setUser, loading,
      login, register, logout, refreshUser,
      isGuest, isUser, isAdmin,
      showGuestModal, hideGuestModal, requireAuth,
    }}>
      {children}

      {/* Global guest prompt — triggered by requireAuth() from any component */}
      <GuestModal
        isOpen={guestModal.isOpen}
        onClose={hideGuestModal}
        message={guestModal.message}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
