import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AuthExtra.css';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  mail:   'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm8 7L2 6m20 0l-10 5',
  back:   'M19 12H5m0 0l7 7m-7-7l7-7',
  check:  'M20 6L9 17l-5-5',
  lock:   'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7 4v4M12 3a4 4 0 014 4v4H8V7a4 4 0 014-4z',
  eye:    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11 3a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  login:  'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-5-4l5-5-5-5m5 5H3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const REQS = [
  { id: 'len',     label: 'At least 8 characters',          test: (v) => v.length >= 8 },
  { id: 'upper',   label: 'At least one uppercase letter',  test: (v) => /[A-Z]/.test(v) },
  { id: 'lower',   label: 'At least one lowercase letter',  test: (v) => /[a-z]/.test(v) },
  { id: 'digit',   label: 'At least one number',            test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'At least one special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
const STRENGTH_COLOR = ['', '#DC2626', '#D97706', '#2563EB', '#059669', '#059669'];

function PasswordInput({ value, onChange, placeholder, hasError, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="ax-input-wrap">
      <span className="ax-input-icon"><Ic d={I.lock} size={15} /></span>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`ax-input${hasError ? ' ax-input--err' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
      />
      <button type="button" className="ax-eye" onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}>
        <Ic d={show ? I.eyeOff : I.eye} size={15} />
      </button>
    </div>
  );
}

// ── Step 1: email ────────────────────────────────────────────────────────────
function EmailStep({ email, setEmail, onSubmit, loading, error }) {
  return (
    <>
      <div className="ax-header">
        <div className="ax-hd-icon"><Ic d={I.mail} size={20} /></div>
        <h2 className="ax-title">Forgot Password?</h2>
        <p className="ax-desc">
          Enter your email address and we'll send you a 6-digit code to reset your password.
        </p>
      </div>

      <form className="ax-form" onSubmit={onSubmit} noValidate>
        <div className="ax-field">
          <label className="ax-label">Email Address</label>
          <div className="ax-input-wrap">
            <span className="ax-input-icon"><Ic d={I.mail} size={15} /></span>
            <input
              type="email"
              className={`ax-input${error ? ' ax-input--err' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
            />
          </div>
          {error && <span className="ax-err">{error}</span>}
        </div>

        <button type="submit" className="ax-btn ax-btn--primary" disabled={loading}>
          {loading
            ? <><span className="ax-spin" />Sending Code…</>
            : <><Ic d={I.mail} size={15} />Send Reset Code</>
          }
        </button>
      </form>

      <div className="ax-footer">
        <Link to="/login" className="ax-back-link">
          <Ic d={I.back} size={14} />Back to Login
        </Link>
      </div>
    </>
  );
}

// ── Step 2: OTP + new password ───────────────────────────────────────────────
function OtpStep({ email, onBack, onSubmit, onResend, loading, resending, apiError, resendMsg }) {
  const [otp,      setOtp]      = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [errors,   setErrors]   = useState({});

  const reqStatus = REQS.map((r) => ({ ...r, met: r.test(password) }));
  const metCount  = reqStatus.filter((r) => r.met).length;
  const allMet    = metCount === REQS.length;

  const validate = () => {
    const e = {};
    if (!/^\d{6}$/.test(otp)) e.otp = 'Enter the 6-digit code from your email.';
    if (!password)  e.password = 'Password is required.';
    else if (!allMet) e.password = 'Password does not meet all requirements.';
    if (!confirm)   e.confirm  = 'Please confirm your password.';
    else if (password !== confirm) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ otp, password });
  };

  return (
    <>
      <div className="ax-header">
        <div className="ax-hd-icon ax-hd-icon--green"><Ic d={I.shield} size={20} /></div>
        <h2 className="ax-title">Enter Reset Code</h2>
        <p className="ax-desc">
          We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
        </p>
      </div>

      {apiError && <div className="ax-api-err"><span>{apiError}</span></div>}
      {resendMsg && !apiError && <div className="ax-api-err" style={{ background: 'var(--clr-primary-50, #F0FDFA)', borderColor: 'var(--clr-primary-200, #CCFBF1)', color: 'var(--clr-primary-700, #0F766E)' }}><span>{resendMsg}</span></div>}

      <form className="ax-form" onSubmit={handleSubmit} noValidate>
        <div className="ax-field">
          <label className="ax-label" htmlFor="fp-otp">6-Digit Code</label>
          <div className="ax-input-wrap">
            <span className="ax-input-icon"><Ic d={I.shield} size={15} /></span>
            <input
              id="fp-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={`ax-input${errors.otp ? ' ax-input--err' : ''}`}
              placeholder="123456"
              style={{ letterSpacing: '6px', fontWeight: 700 }}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors((er) => ({ ...er, otp: '' })); }}
              autoFocus
              autoComplete="one-time-code"
            />
          </div>
          {errors.otp && <span className="ax-err">{errors.otp}</span>}
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="fp-pwd">New Password</label>
          <PasswordInput
            id="fp-pwd"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: '' })); }}
            placeholder="Create a strong password"
            hasError={!!errors.password}
          />

          {password && (
            <div className="ax-strength">
              <div className="ax-str-bars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="ax-str-bar"
                    style={{ background: n <= metCount ? STRENGTH_COLOR[metCount] : 'var(--border-default)' }} />
                ))}
              </div>
              <span className="ax-str-label" style={{ color: STRENGTH_COLOR[metCount] }}>
                {STRENGTH_LABEL[metCount]}
              </span>
            </div>
          )}

          {password && (
            <ul className="ax-reqs">
              {reqStatus.map((r) => (
                <li key={r.id} className={`ax-req${r.met ? ' ax-req--met' : ''}`}>
                  <span className="ax-req-dot" />
                  {r.label}
                </li>
              ))}
            </ul>
          )}

          {errors.password && <span className="ax-err">{errors.password}</span>}
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="fp-confirm">Confirm Password</label>
          <PasswordInput
            id="fp-confirm"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setErrors((er) => ({ ...er, confirm: '' })); }}
            placeholder="Repeat your password"
            hasError={!!errors.confirm}
          />
          {errors.confirm && <span className="ax-err">{errors.confirm}</span>}
        </div>

        <button type="submit" className="ax-btn ax-btn--primary" disabled={loading}>
          {loading
            ? <><span className="ax-spin" />Resetting Password…</>
            : <><Ic d={I.lock} size={15} />Reset Password</>
          }
        </button>
      </form>

      <div className="ax-acts" style={{ marginTop: 4 }}>
        <button type="button" className="ax-link-btn" onClick={onResend} disabled={resending}>
          {resending ? 'Sending…' : 'Resend code'}
        </button>
        <button type="button" className="ax-link-btn" onClick={onBack}>
          Use a different email
        </button>
      </div>

      <div className="ax-footer">
        <Link to="/login" className="ax-back-link">
          <Ic d={I.back} size={14} />Back to Login
        </Link>
      </div>
    </>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();

  // step: 'email' | 'otp' | 'success'
  const [step,      setStep]      = useState('email');
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState('');
  const [apiError,  setApiError]  = useState('');
  const [resendMsg, setResendMsg] = useState('');

  const requestCode = async (e) => {
    e.preventDefault();
    if (!email.trim())        { setError('Please enter your email address.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setStep('otp');
    } catch (err) {
      if (err.response?.status === 500) {
        setError(err.response?.data?.message || 'We could not send the email right now. Please try again in a few minutes.');
      } else {
        // Generic success even on unexpected errors — avoid leaking account existence.
        setStep('otp');
      }
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    setResendMsg('');
    setApiError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setResendMsg('A new code has been sent to your email.');
    } catch {
      setResendMsg('A new code has been sent to your email.');
    } finally {
      setResending(false);
    }
  };

  const submitReset = async ({ otp, password }) => {
    setLoading(true);
    setApiError('');
    try {
      await api.post('/auth/reset-password-otp', { email: email.trim(), otp, password });
      setStep('success');
      setTimeout(() => navigate('/login'), 3500);
    } catch (err) {
      setApiError(err.response?.data?.message || 'This code is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ax-page">
      <div className="ax-card">
        <div className="ax-logo">
          <div className="ax-logo-icon"><Ic d={I.lock} size={22} /></div>
          <div>
            <span className="ax-brand">StyleAI</span>
            <span className="ax-brand-sub"> · Password Reset</span>
          </div>
        </div>

        {step === 'success' ? (
          <div className="ax-success">
            <div className="ax-success-icon"><Ic d={I.check} size={26} /></div>
            <h2 className="ax-title">Password Reset!</h2>
            <p className="ax-desc">
              Your password has been updated successfully. Redirecting you to the login page…
            </p>
            <Link to="/login" className="ax-btn ax-btn--primary" style={{ marginTop: 16 }}>
              <Ic d={I.login} size={15} />Go to Login
            </Link>
          </div>
        ) : step === 'otp' ? (
          <OtpStep
            email={email}
            onBack={() => { setStep('email'); setApiError(''); setResendMsg(''); }}
            onSubmit={submitReset}
            onResend={resendCode}
            loading={loading}
            resending={resending}
            apiError={apiError}
            resendMsg={resendMsg}
          />
        ) : (
          <EmailStep
            email={email}
            setEmail={(v) => { setEmail(v); setError(''); }}
            onSubmit={requestCode}
            loading={loading}
            error={error}
          />
        )}
      </div>

      <div className="ax-deco ax-deco--1" />
      <div className="ax-deco ax-deco--2" />
    </div>
  );
}
