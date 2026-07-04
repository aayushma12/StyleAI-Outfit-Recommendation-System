import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AuthExtra.css';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  lock:   'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7 4v4M12 3a4 4 0 014 4v4H8V7a4 4 0 014-4z',
  eye:    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11 3a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  check:  'M20 6L9 17l-5-5',
  login:  'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-5-4l5-5-5-5m5 5H3',
  back:   'M19 12H5m0 0l7 7m-7-7l7-7',
  warn:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

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

function TokenChecking() {
  return (
    <div className="ax-page">
      <div className="ax-card" style={{ textAlign: 'center', padding: '56px 36px' }}>
        <div className="ax-logo" style={{ justifyContent: 'center', marginBottom: 32 }}>
          <div className="ax-logo-icon"><Ic d={I.lock} size={22} /></div>
          <span className="ax-brand">StyleAI</span>
        </div>
        <span className="ax-spin ax-spin--teal" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 20px' }} />
        <p className="ax-desc" style={{ marginTop: 8 }}>Verifying your reset link…</p>
      </div>
      <div className="ax-deco ax-deco--1" />
      <div className="ax-deco ax-deco--2" />
    </div>
  );
}

function TokenExpired({ message }) {
  return (
    <div className="ax-page">
      <div className="ax-card">
        <div className="ax-logo">
          <div className="ax-logo-icon"><Ic d={I.lock} size={22} /></div>
          <span className="ax-brand">StyleAI</span>
        </div>
        <div className="ax-success" style={{ paddingTop: 8 }}>
          <div className="ax-hd-icon ax-hd-icon--red" style={{ margin: '0 auto 20px', width: 64, height: 64, borderRadius: '50%' }}>
            <Ic d={I.warn} size={28} />
          </div>
          <h2 className="ax-title">Link Expired</h2>
          <p className="ax-desc" style={{ marginBottom: 24 }}>
            {message || 'This password reset link has expired or is invalid.'}
          </p>
          <div className="ax-acts">
            <Link to="/forgot-password" className="ax-btn ax-btn--primary">
              Request a New Link
            </Link>
            <Link to="/login" className="ax-back-link" style={{ justifyContent: 'center' }}>
              <Ic d={I.back} size={14} />Back to Login
            </Link>
          </div>
        </div>
      </div>
      <div className="ax-deco ax-deco--1" />
      <div className="ax-deco ax-deco--2" />
    </div>
  );
}

export default function ResetPassword() {
  const { token }  = useParams();
  const navigate   = useNavigate();

  // Token verification state: 'checking' | 'valid' | 'expired'
  const [tokenStatus, setTokenStatus]  = useState('checking');
  const [expiredMsg,  setExpiredMsg]   = useState('');

  const [password,    setPassword]     = useState('');
  const [confirm,     setConfirm]      = useState('');
  const [loading,     setLoading]      = useState(false);
  const [success,     setSuccess]      = useState(false);
  const [errors,      setErrors]       = useState({});
  const [apiError,    setApiError]     = useState('');

  /* Verify token on mount before showing the form */
  useEffect(() => {
    if (!token) { setTokenStatus('expired'); setExpiredMsg('No reset token found.'); return; }

    api.get(`/auth/verify-reset-token/${token}`)
      .then(() => setTokenStatus('valid'))
      .catch((err) => {
        setTokenStatus('expired');
        setExpiredMsg(err.response?.data?.message || '');
      });
  }, [token]);

  /* Derived: which requirements pass */
  const reqStatus = REQS.map((r) => ({ ...r, met: r.test(password) }));
  const metCount  = reqStatus.filter((r) => r.met).length;
  const allMet    = metCount === REQS.length;

  const validate = () => {
    const e = {};
    if (!password)  e.password = 'Password is required.';
    else if (!allMet) e.password = 'Password does not meet all requirements.';
    if (!confirm)   e.confirm  = 'Please confirm your password.';
    else if (password !== confirm) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Reset link expired or invalid.';
      // If the token expired between verify and submit, switch to expired state
      if (err.response?.status === 400) {
        setTokenStatus('expired');
        setExpiredMsg(msg);
      } else {
        setApiError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenStatus === 'checking') return <TokenChecking />;
  if (tokenStatus === 'expired')  return <TokenExpired message={expiredMsg} />;

  if (success) return (
    <div className="ax-page">
      <div className="ax-card">
        <div className="ax-logo">
          <div className="ax-logo-icon"><Ic d={I.lock} size={22} /></div>
          <div><span className="ax-brand">StyleAI</span></div>
        </div>
        <div className="ax-success">
          <div className="ax-success-icon"><Ic d={I.check} size={26} /></div>
          <h2 className="ax-title">Password Reset!</h2>
          <p className="ax-desc">
            Your password has been updated successfully.
            Redirecting you to the login page…
          </p>
          <Link to="/login" className="ax-btn ax-btn--primary" style={{ marginTop: 16 }}>
            <Ic d={I.login} size={15} />Go to Login
          </Link>
        </div>
      </div>
      <div className="ax-deco ax-deco--1" />
      <div className="ax-deco ax-deco--2" />
    </div>
  );

  return (
    <div className="ax-page">
      <div className="ax-card">
        <div className="ax-logo">
          <div className="ax-logo-icon"><Ic d={I.lock} size={22} /></div>
          <div>
            <span className="ax-brand">StyleAI</span>
            <span className="ax-brand-sub"> · Reset Password</span>
          </div>
        </div>

        <div className="ax-header">
          <div className="ax-hd-icon ax-hd-icon--green"><Ic d={I.lock} size={20} /></div>
          <h2 className="ax-title">Set New Password</h2>
          <p className="ax-desc">Choose a strong password for your StyleAI account.</p>
        </div>

        {apiError && (
          <div className="ax-api-err">
            <span>{apiError}</span>
            <Link to="/forgot-password" className="ax-api-link">Request new link</Link>
          </div>
        )}

        <form className="ax-form" onSubmit={handleSubmit} noValidate>

          {/* New password */}
          <div className="ax-field">
            <label className="ax-label" htmlFor="rp-pwd">New Password</label>
            <PasswordInput
              id="rp-pwd"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: '' })); setApiError(''); }}
              placeholder="Create a strong password"
              hasError={!!errors.password}
            />

            {/* Strength bar */}
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

            {/* Requirements checklist */}
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

          {/* Confirm password */}
          <div className="ax-field">
            <label className="ax-label" htmlFor="rp-confirm">Confirm Password</label>
            <PasswordInput
              id="rp-confirm"
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

        <div className="ax-footer">
          <Link to="/login" className="ax-back-link">
            <Ic d={I.back} size={14} />Back to Login
          </Link>
        </div>
      </div>

      <div className="ax-deco ax-deco--1" />
      <div className="ax-deco ax-deco--2" />
    </div>
  );
}
