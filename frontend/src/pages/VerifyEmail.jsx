import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import './AuthExtra.css';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  mail:    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm8 7L2 6m20 0l-10 5',
  check:   'M20 6L9 17l-5-5',
  alert:   'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  back:    'M19 12H5m0 0l7 7m-7-7l7-7',
  lock:    'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7 4v4M12 3a4 4 0 014 4v4H8V7a4 4 0 014-4z',
};

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ── Resend form (shown when token param is "resend") ──────────────────────────
function ResendForm() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim())       { setError('Please enter your email address.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      setSent(true);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError('Please wait at least 2 minutes before requesting another link.');
      } else if (status === 500) {
        setError('We could not send the email right now. Please try again shortly.');
      } else {
        // Generic to avoid user-enumeration — same as success
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ax-page">
      <div className="ax-card">
        <div className="ax-logo">
          <div className="ax-logo-icon"><Ic d={I.mail} size={22} /></div>
          <div>
            <span className="ax-brand">StyleAI</span>
            <span className="ax-brand-sub"> · Email Verification</span>
          </div>
        </div>

        {sent ? (
          <div className="ax-success">
            <div className="ax-success-icon"><Ic d={I.check} size={26} /></div>
            <h2 className="ax-title">Check Your Inbox</h2>
            <p className="ax-desc">
              If an account exists for <strong>{email}</strong> and it hasn't been verified yet,
              we've sent a new verification link. It expires in <strong>24 hours</strong>.
            </p>
            <p className="ax-hint">Didn't get it? Check your spam folder.</p>
            <div className="ax-acts">
              <button className="ax-link-btn" onClick={() => { setSent(false); setError(''); }}>
                Try a different email
              </button>
              <Link to="/login" className="ax-btn ax-btn--secondary">Back to Login</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="ax-header">
              <div className="ax-hd-icon"><Ic d={I.mail} size={20} /></div>
              <h2 className="ax-title">Resend Verification Email</h2>
              <p className="ax-desc">
                Enter the email address you registered with and we'll send you a new verification link.
              </p>
            </div>

            <form className="ax-form" onSubmit={handleSubmit} noValidate>
              <div className="ax-field">
                <label className="ax-label">Email Address</label>
                <div className="ax-input-wrap">
                  <span className="ax-input-icon"><Ic d={I.mail} size={15} /></span>
                  <input
                    type="email"
                    className={`ax-input${error ? ' ax-input--err' : ''}`}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                {error && <span className="ax-err">{error}</span>}
              </div>

              <button type="submit" className="ax-btn ax-btn--primary" disabled={loading}>
                {loading
                  ? <><span className="ax-spin" />Sending Link…</>
                  : <><Ic d={I.mail} size={15} />Send Verification Link</>
                }
              </button>
            </form>

            <div className="ax-footer">
              <Link to="/login" className="ax-back-link">
                <Ic d={I.back} size={14} />Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
      <div className="ax-deco ax-deco--1" />
      <div className="ax-deco ax-deco--2" />
    </div>
  );
}

// ── Token verification page (hooks must not be called after an early return) ──
function TokenVerifier({ token }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    api.get(`/auth/verify-email/${token}`)
      .then(() => setStatus('success'))
      .catch((err) => {
        const msg = err.response?.data?.message || 'Verification failed. The link may be invalid.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="ax-page">
      <div className="ax-card">

        <div className="ax-logo">
          <div className="ax-logo-icon"><Ic d={I.lock} size={22} /></div>
          <div>
            <span className="ax-brand">StyleAI</span>
            <span className="ax-brand-sub"> · Email Verification</span>
          </div>
        </div>

        {status === 'checking' && (
          <div className="ax-success" style={{ textAlign: 'center' }}>
            <div className="ax-success-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#0D9488)' }}>
              <span className="ax-spin ax-spin--lg" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
            </div>
            <h2 className="ax-title">Verifying Your Email…</h2>
            <p className="ax-desc">Please wait while we confirm your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="ax-success">
            <div className="ax-success-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#0D9488)' }}>
              <Ic d={I.check} size={26} />
            </div>
            <h2 className="ax-title">Email Verified!</h2>
            <p className="ax-desc">
              Your email address has been successfully verified. You now have full access to all StyleAI features.
            </p>
            <div className="ax-acts">
              <Link to="/login" className="ax-btn ax-btn--primary">Sign In to StyleAI →</Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="ax-success">
            <div className="ax-success-icon" style={{ background: 'linear-gradient(135deg,#DC2626,#F59E0B)' }}>
              <Ic d={I.alert} size={26} />
            </div>
            <h2 className="ax-title">Verification Failed</h2>
            <p className="ax-desc">{errorMsg}</p>
            <p className="ax-hint">The link may have expired (links are valid for 24 hours) or already been used.</p>
            <div className="ax-acts">
              <Link to="/verify-email/resend" className="ax-btn ax-btn--primary">
                <Ic d={I.refresh} size={15} />Request New Link
              </Link>
              <Link to="/login" className="ax-btn ax-btn--secondary">Back to Login</Link>
            </div>
          </div>
        )}

      </div>
      <div className="ax-deco ax-deco--1" />
      <div className="ax-deco ax-deco--2" />
    </div>
  );
}

// ── Router component — no hooks here, safe to return early ────────────────────
export default function VerifyEmail() {
  const { token } = useParams();
  if (token === 'resend') return <ResendForm />;
  return <TokenVerifier token={token} />;
}
