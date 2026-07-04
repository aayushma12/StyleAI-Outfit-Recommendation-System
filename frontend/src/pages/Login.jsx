import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const TRUST = [
  { label: 'Secure Authentication', desc: '256-bit encrypted sign-in' },
  { label: 'Privacy Protected', desc: 'Your data is never shared or sold' },
  { label: 'Personalized Experience', desc: 'AI-curated outfits just for you' },
];

const ShieldIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

export default function Login() {
  const [form, setForm]   = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [error,   setError]     = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  // Where to send the user after login — respect a saved "from" location set by
  // PrivateRoute/AdminRoute when they redirected an unauthenticated user to /login.
  const from = location.state?.from?.pathname;

  const set = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
    setErrorCode('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email) { setError('Email address is required.'); return; }
    if (!form.password) { setError('Password is required.'); return; }
    setError('');
    setErrorCode('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password, remember);
      if (user.role === 'admin') {
        navigate(from || '/admin', { replace: true });
      } else {
        const dest = user.onboardingCompleted ? '/dashboard' : '/onboarding';
        navigate(from || dest, { replace: true });
      }
    } catch (err) {
      const msg  = err.response?.data?.message || 'Invalid email or password. Please try again.';
      const code = err.response?.data?.code || '';
      setError(msg);
      setErrorCode(code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-root">

      <div className="lg-left">
        <div className="lg-left-img" style={{ backgroundImage: 'url(/hero-bg.png)' }} />
        <div className="lg-left-overlay" />

        <div className="lg-left-content">
          {/* Brand */}
          <div className="lg-brand">
            <span className="lg-brand-icon">✦</span> StyleAI
          </div>

          {/* Headline */}
          <div className="lg-left-body">
            <div className="lg-left-eyebrow">AI-Powered Fashion · Kathmandu</div>
            <h2 className="lg-left-title">
              Your Style,<br />
              <span className="lg-left-title-em">Reinvented</span><br />
              with AI
            </h2>
            <p className="lg-left-sub">
              Join thousands of young women in Kathmandu
              discovering their perfect look every day.
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="lg-trust-list">
            {TRUST.map(t => (
              <div key={t.label} className="lg-trust-item">
                <span className="lg-trust-icon"><ShieldIcon /></span>
                <div>
                  <div className="lg-trust-label">{t.label}</div>
                  <div className="lg-trust-desc">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stat pill */}
          <div className="lg-left-stat">
            <div className="lg-stat-ring">95%</div>
            <div className="lg-stat-body">
              <div className="lg-stat-label">User Satisfaction Rate</div>
              <div className="lg-stat-sub">Based on StyleAI user feedback</div>
            </div>
          </div>
        </div>

        <div className="lg-deco-a" />
        <div className="lg-deco-b" />
      </div>

      <div className="lg-right">
        <div className="lg-right-inner">

          {/* Mobile-only brand */}
          <div className="lg-mobile-brand">
            <span className="lg-brand-icon">✦</span> StyleAI
          </div>

          <h2 className="lg-form-title">Welcome Back</h2>
          <p className="lg-form-sub">
            Sign in to your style profile and see what's been curated for you today.
          </p>

          {error && errorCode === 'ACCOUNT_LOCKED' && (
            <div className="lg-error lg-error--warn">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0,marginTop:1}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>
                <strong>Account temporarily locked.</strong><br />
                {error} Please wait and try again, or{' '}
                <Link to="/forgot-password" className="lg-error-link">reset your password</Link>.
              </span>
            </div>
          )}

          {error && errorCode === 'EMAIL_NOT_VERIFIED' && (
            <div className="lg-error lg-error--info">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0,marginTop:1}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>
                <strong>Email not verified.</strong><br />
                Check your inbox for the verification link, or{' '}
                <Link to="/verify-email/resend" className="lg-error-link">resend the verification email</Link>.
              </span>
            </div>
          )}

          {error && errorCode === 'ACCOUNT_SUSPENDED' && (
            <div className="lg-error lg-error--warn">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0,marginTop:1}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>
                <strong>Account suspended.</strong><br />
                Your account has been suspended. Please contact support if you believe this is an error.
              </span>
            </div>
          )}

          {error && !['ACCOUNT_LOCKED', 'EMAIL_NOT_VERIFIED', 'ACCOUNT_SUSPENDED'].includes(errorCode) && (
            <div className="lg-error">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{flexShrink:0,marginTop:1}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="lg-form" noValidate>

            {/* Email */}
            <div className="lg-field">
              <label htmlFor="lg-email">Email Address</label>
              <div className="lg-input-wrap">
                <span className="lg-input-icon">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  id="lg-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="lg-field">
              <div className="lg-field-row">
                <label htmlFor="lg-password">Password</label>
                <Link to="/forgot-password" className="lg-forgot">
                  Forgot password?
                </Link>
              </div>
              <div className="lg-input-wrap">
                <span className="lg-input-icon">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="lg-password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={set}
                  autoComplete="current-password"
                />
                <button type="button" className="lg-eye" onClick={() => setShowPwd(p => !p)} aria-label="Toggle password">
                  {showPwd
                    ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="lg-options">
              <div className="lg-remember" onClick={() => setRemember(p => !p)}>
                <div className={`lg-check ${remember ? 'lg-check--on' : ''}`}>{remember && '✓'}</div>
                <span>Remember me for 30 days</span>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" className="lg-btn-primary" disabled={loading}>
              {loading ? <span className="lg-spinner" /> : 'Sign In to StyleAI →'}
            </button>
          </form>

          {/* Divider */}
          <div className="lg-divider"><span>or</span></div>

          {/* Create account */}
          <Link to="/register" className="lg-btn-outline">
            Create New Account
          </Link>

          {/* Footer trust line */}
          <p className="lg-footer-trust">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Secured with 256-bit encryption · Your data is never sold
          </p>

        </div>
      </div>
    </div>
  );
}
