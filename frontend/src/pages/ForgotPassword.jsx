import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './AuthExtra.css';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  mail:  'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm8 7L2 6m20 0l-10 5',
  back:  'M19 12H5m0 0l7 7m-7-7l7-7',
  check: 'M20 6L9 17l-5-5',
  lock:  'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7 4v4M12 3a4 4 0 014 4v4H8V7a4 4 0 014-4z',
};

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      const msg = err.response?.data?.message;
      // 500 means email delivery failed — surface a specific message
      if (err.response?.status === 500) {
        setError(msg || 'We could not send the email right now. Please try again in a few minutes.');
      } else {
        // For all other errors, still show generic to avoid leaking info
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ax-page">
      <div className="ax-card">

        {/* Logo */}
        <div className="ax-logo">
          <div className="ax-logo-icon"><Ic d={I.lock} size={22} /></div>
          <div>
            <span className="ax-brand">StyleAI</span>
            <span className="ax-brand-sub"> · Password Reset</span>
          </div>
        </div>

        {sent ? (
          <div className="ax-success">
            <div className="ax-success-icon"><Ic d={I.check} size={26} /></div>
            <h2 className="ax-title">Check Your Email</h2>
            <p className="ax-desc">
              If an account is registered with <strong>{email}</strong>, you'll receive a
              password reset link shortly. The link expires in <strong>15 minutes</strong>.
            </p>
            <p className="ax-hint">
              Didn't receive it? Check your spam folder, or try a different email address.
            </p>
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
              <h2 className="ax-title">Forgot Password?</h2>
              <p className="ax-desc">
                Enter your email address and we'll send you a link to reset your password.
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
                  : <><Ic d={I.mail} size={15} />Send Reset Link</>
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
