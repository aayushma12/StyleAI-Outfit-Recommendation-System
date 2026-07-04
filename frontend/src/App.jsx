import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded page chunks — only the code for the current route is downloaded.
const Landing        = lazy(() => import('./pages/Landing'));
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const Onboarding     = lazy(() => import('./pages/Onboarding'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail    = lazy(() => import('./pages/VerifyEmail'));
const NotFound       = lazy(() => import('./pages/NotFound'));
const Unauthorized   = lazy(() => import('./pages/Unauthorized'));
const LegalInfo      = lazy(() => import('./pages/LegalInfo'));

// Full-screen spinner shown while a lazy chunk is fetching OR while the startup
// auth check is in flight.  Uses the app's teal colour token so the brand
// palette is consistent even before any CSS bundles load.
const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--bg-base, #f9fafb)',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid var(--clr-primary-100, #CCFBF1)',
      borderTopColor: 'var(--clr-primary-600, #0D9488)',
      animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── Route guards ──────────────────────────────────────────────────────────────
//
// All three guards share the same rule: while the startup /auth/me check is
// running (loading = true), render PageLoader instead of making a routing
// decision.  Without this gate, route guards would always see user = null for
// the first render and incorrectly redirect authenticated users to /login on
// every page refresh.

// Routes that ONLY unauthenticated users should see: landing, login, register…
// An authenticated visitor is sent to their home page immediately.
// Wrapping the Landing ("/") route here also prevents the browser back-button
// from leaving an authenticated user stuck on the marketing page.
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return children;
  return user.role === 'admin'
    ? <Navigate to="/admin"     replace />
    : <Navigate to="/dashboard" replace />;
};

// Routes that require a logged-in regular user (role = "user").
// Saves the intended URL so Login can redirect back after sign-in.
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user)               return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
};

// Routes that require an administrator.
// Non-admins go to /unauthorized; unauthenticated users go to /login.
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user)                 return <Navigate to="/login"        state={{ from: location }} replace />;
  if (user.role !== 'admin') return <Navigate to="/unauthorized" replace />;
  return children;
};

// ── Route tree ────────────────────────────────────────────────────────────────

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>

      {/* ── Landing (PublicRoute): authenticated users are forwarded to dashboard) ── */}
      <Route path="/"
        element={<PublicRoute><Landing /></PublicRoute>} />

      {/* ── Always-public (no auth check needed) ── */}
      <Route path="/verify-email/:token"   element={<VerifyEmail />} />
      <Route path="/unauthorized"          element={<Unauthorized />} />
      <Route path="/legal"                 element={<LegalInfo />} />

      {/* ── Public-only (redirect authenticated users away) ── */}
      <Route path="/login"
        element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register"
        element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password"
        element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token"
        element={<PublicRoute><ResetPassword /></PublicRoute>} />

      {/* ── Authenticated user only ── */}
      <Route path="/onboarding"
        element={<PrivateRoute><Onboarding /></PrivateRoute>} />
      <Route path="/dashboard"
        element={<PrivateRoute><Dashboard /></PrivateRoute>} />

      {/* ── Administrator only ── */}
      <Route path="/admin"
        element={<AdminRoute><AdminDashboard /></AdminRoute>} />

      {/* ── 404 catch-all ── */}
      <Route path="*" element={<NotFound />} />

    </Routes>
  </Suspense>
);

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
