import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Register.css';

// ── Password strength helpers ──────────────────────────────────────────────────
const PWD_REQS = [
  { id: 'len',     label: 'At least 8 characters',          test: v => v.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',     test: v => /[A-Z]/.test(v) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',     test: v => /[a-z]/.test(v) },
  { id: 'digit',   label: 'One number (0–9)',               test: v => /[0-9]/.test(v) },
  { id: 'special', label: 'One special character (!@#$…)',  test: v => /[^A-Za-z0-9]/.test(v) },
];

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
const STRENGTH_COLOR = ['', '#DC2626', '#D97706', '#2563EB', '#059669', '#059669'];

function PasswordStrengthMeter({ password }) {
  const reqs     = PWD_REQS.map(r => ({ ...r, met: r.test(password) }));
  const metCount = reqs.filter(r => r.met).length;

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      {/* Strength bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {[1,2,3,4,5].map(n => (
          <div key={n} style={{
            flex: 1, height: 4, borderRadius: 4,
            background: n <= metCount ? STRENGTH_COLOR[metCount] : '#E5E7EB',
            transition: 'background .2s',
          }} />
        ))}
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: STRENGTH_COLOR[metCount], minWidth: 44, textAlign: 'right' }}>
          {STRENGTH_LABEL[metCount]}
        </span>
      </div>
      {/* Requirements checklist */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {reqs.map(r => (
          <li key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.75rem', color: r.met ? '#059669' : '#9CA3AF',
            transition: 'color .15s',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: r.met ? '#059669' : '#E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: r.met ? '#fff' : 'transparent',
              flexShrink: 0, transition: 'all .15s',
            }}>✓</span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEP_META = [
  {
    title: 'Create Your Account',
    subtitle: 'Start your personalised style journey today.',
    quote: '"Style is a way to say who you are without having to speak."',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80',
    leftTitle: 'Your Style\nJourney\nStarts Here',
  },
  {
    title: 'Tell Us About You',
    subtitle: 'Help us understand your unique shape and features.',
    quote: '"Beauty begins the moment you decide to be yourself."',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
    leftTitle: 'Beautiful\nin Every\nForm',
  },
  {
    title: 'Your Fashion Sense',
    subtitle: 'Let us know what makes you feel most like yourself.',
    quote: '"Fashion is the armor to survive the reality of everyday life."',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
    leftTitle: 'Express\nYourself\nFreely',
  },
];

const COLORS = [
  { name: 'red', hex: '#EF4444' },
  { name: 'pink', hex: '#EC4899' },
  { name: 'orange', hex: '#F97316' },
  { name: 'yellow', hex: '#EAB308' },
  { name: 'green', hex: '#22C55E' },
  { name: 'teal', hex: '#14B8A6' },
  { name: 'blue', hex: '#3B82F6' },
  { name: 'purple', hex: '#A855F7' },
  { name: 'black', hex: '#1F2937' },
  { name: 'white', hex: '#F3F4F6', outline: true },
  { name: 'beige', hex: '#D4B896' },
  { name: 'maroon', hex: '#7F1D1D' },
  { name: 'navy', hex: '#1E3A5F' },
  { name: 'olive', hex: '#808000' },
];

const STYLE_OPTIONS = ['Casual', 'Traditional', 'Western', 'Fusion', 'Formal', 'Sporty', 'Bohemian', 'Minimalist'];

const SKIN_TONES = [
  { name: 'Fair', hex: '#FDDBB4' },
  { name: 'Light', hex: '#F5CBA7' },
  { name: 'Medium', hex: '#E8A882' },
  { name: 'Olive', hex: '#C8956C' },
  { name: 'Brown', hex: '#8D5524' },
  { name: 'Dark', hex: '#4A2912' },
];

const BODY_TYPES = [
  { value: 'hourglass', label: 'Hourglass', desc: 'Balanced bust & hips, defined waist' },
  { value: 'pear', label: 'Pear', desc: 'Hips wider than shoulders' },
  { value: 'apple', label: 'Apple', desc: 'Fuller midsection, slim legs' },
  { value: 'rectangle', label: 'Rectangle', desc: 'Similar width throughout' },
  { value: 'inverted_triangle', label: 'Inv. Triangle', desc: 'Broader shoulders, slim hips' },
];

const BUDGET_PRESETS = [
  { label: 'Budget', min: 500, max: 2000 },
  { label: 'Mid-range', min: 2000, max: 5000 },
  { label: 'Premium', min: 5000, max: 15000 },
  { label: 'Luxury', min: 15000, max: 99999 },
];

export default function Register() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', consentGiven: false,
    age: '', height: '', weight: '', skinTone: '', bodyType: '',
    favoriteColors: [], fashionStyles: [], budgetMin: 500, budgetMax: 5000,
  });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailVerifSent, setEmailVerifSent] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const toggleArr = (k, v) => setForm(p => ({
    ...p,
    [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v],
  }));

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Full name must be at least 2 characters';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required';
      const pwdReqsMet = PWD_REQS.every(r => r.test(form.password));
      if (!form.password) {
        e.password = 'Password is required';
      } else if (!pwdReqsMet) {
        e.password = 'Password does not meet all requirements below';
      }
      if (!form.confirmPassword) {
        e.confirmPassword = 'Please confirm your password';
      } else if (form.password !== form.confirmPassword) {
        e.confirmPassword = 'Passwords do not match';
      }
      if (!form.consentGiven) e.consent = 'You must agree to continue';
    }
    if (s === 1) {
      const age = Number(form.age);
      if (!form.age || age < 13 || age > 80) e.age = 'Please enter a valid age (13–80)';
      if (!form.bodyType) e.bodyType = 'Please select your body type';
      if (Number(form.budgetMin) > Number(form.budgetMax)) e.budget = 'Minimum budget cannot exceed maximum';
    }
    if (s === 2) {
      if (form.fashionStyles.length === 0) e.fashionStyles = 'Select at least one style';
    }
    return e;
  };

  const next = () => {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    if (step === 2) submit();
    else setStep(s => s + 1);
  };

  const back = () => { setErrors({}); setGlobalError(''); setStep(s => s - 1); };

  const submit = async () => {
    setLoading(true);
    setGlobalError('');
    try {
      const regRes = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        consentGiven: 'true',
      });
      // Backend sets an httpOnly cookie on registration — no localStorage needed.
      if (regRes.data.emailVerificationSent) setEmailVerifSent(true);

      await api.post('/users/onboarding', {
        age: parseInt(form.age, 10),
        ...(form.height && { height: parseFloat(form.height) }),
        ...(form.weight && { weight: parseFloat(form.weight) }),
        ...(form.skinTone && { skinTone: form.skinTone }),
        bodyType: form.bodyType,
        stylePreferences: form.fashionStyles.map(s => s.toLowerCase()),
        culturalBackground: 'Nepali',
        occasionPreferences: ['daily', 'college', 'festival'],
        colorPreferences: form.favoriteColors,
        budgetRange: { min: Number(form.budgetMin), max: Number(form.budgetMax) },
      });

      // Show step 3 WITHOUT authenticating in React context yet.
      // If we called setUser/refreshUser here, PublicRoute would immediately
      // redirect to /dashboard and the success screen would never render.
      setStep(3);
    } catch (err) {
      setGlobalError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const meta = step < 3 ? STEP_META[step] : null;
  const firstName = form.name.split(' ')[0];

  return (
    <div className="rg-root">

      <div className={`rg-left ${step === 3 ? 'rg-left--success' : ''}`}>
        {meta
          ? <div className="rg-left-img" style={{ backgroundImage: `url(${meta.image})` }} />
          : null
        }
        <div className={`rg-left-overlay ${step === 3 ? 'rg-left-overlay--success' : ''}`} />
        <div className="rg-left-content">
          <div className="rg-brand"><span className="rg-brand-icon">✦</span> StyleAI</div>
          <div className="rg-left-body">
            <div className={`rg-step-pill ${step === 3 ? 'rg-step-pill--done' : ''}`}>
              {step < 3 ? `Step ${step + 1} of 3` : 'Profile Complete ✓'}
            </div>
            <h2 className="rg-left-title" style={{ whiteSpace: 'pre-line' }}>
              {step < 3 ? meta.leftTitle : `Welcome\nto Your\nStyle Universe`}
            </h2>
            <blockquote className="rg-left-quote">
              {step < 3
                ? meta.quote
                : '"Every day is a fashion show and the world is your runway."'}
            </blockquote>
          </div>
          {step < 3 && (
            <div className="rg-left-dots">
              {[0, 1, 2].map(i => (
                <span key={i} className={`rg-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
              ))}
            </div>
          )}
        </div>
        <div className="rg-deco-a" />
        <div className="rg-deco-b" />
      </div>

      <div className="rg-right">
        <div className="rg-right-inner">

          {/* Progress indicator */}
          {step < 3 && (
            <>
              <div className="rg-progress">
                {['Account', 'About You', 'Style'].map((l, i) => (
                  <React.Fragment key={l}>
                    <div className={`rg-prog-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                      <div className="rg-prog-circle">{i < step ? '✓' : i + 1}</div>
                      <span className="rg-prog-label">{l}</span>
                    </div>
                    {i < 2 && <div className={`rg-prog-line ${i < step ? 'done' : ''}`} />}
                  </React.Fragment>
                ))}
              </div>
              <h2 className="rg-form-title">{meta.title}</h2>
              <p className="rg-form-sub">{meta.subtitle}</p>
            </>
          )}

          {globalError && <div className="rg-error-banner">{globalError}</div>}

          {step === 0 && (
            <div className="rg-fields">
              <Field label="Full Name" error={errors.name}>
                <input type="text" placeholder="Priya Sharma" value={form.name}
                  onChange={e => set('name', e.target.value)} className={errors.name ? 'rg-input-err' : ''} />
              </Field>
              <Field label="Email Address" error={errors.email}>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => set('email', e.target.value)} className={errors.email ? 'rg-input-err' : ''} />
              </Field>
              <Field label="Password" error={errors.password}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className={errors.password ? 'rg-input-err' : ''}
                    autoComplete="new-password"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex' }}>
                    {showPwd
                      ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
                <PasswordStrengthMeter password={form.password} />
              </Field>

              <Field label="Confirm Password" error={errors.confirmPassword}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    className={errors.confirmPassword ? 'rg-input-err' : ''}
                    autoComplete="new-password"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex' }}>
                    {showConfirm
                      ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </Field>
              <div className="rg-consent" onClick={() => set('consentGiven', !form.consentGiven)}>
                <div className={`rg-checkbox ${form.consentGiven ? 'rg-checkbox--checked' : ''}`}>
                  {form.consentGiven && '✓'}
                </div>
                <span>
                  I agree to StyleAI's{' '}
                  <a href="#!" onClick={e => e.stopPropagation()}>Privacy Policy</a>{' '}
                  and consent to my style data being used for personalised outfit recommendations.
                </span>
              </div>
              {errors.consent && <p className="rg-err-txt">{errors.consent}</p>}
            </div>
          )}

          {step === 1 && (
            <div className="rg-fields">
              <div className="rg-three-col">
                <Field label="Age" error={errors.age}>
                  <input type="number" min={18} max={25} placeholder="21" value={form.age}
                    onChange={e => set('age', e.target.value)} className={errors.age ? 'rg-input-err' : ''} />
                </Field>
                <Field label="Height (cm)" hint="Optional">
                  <input type="number" placeholder="162" value={form.height}
                    onChange={e => set('height', e.target.value)} />
                </Field>
                <Field label="Weight (kg)" hint="Optional">
                  <input type="number" placeholder="55" value={form.weight}
                    onChange={e => set('weight', e.target.value)} />
                </Field>
              </div>

              <Field label="Skin Tone" hint="Optional">
                <div className="rg-skin-tones">
                  {SKIN_TONES.map(s => (
                    <button key={s.name} type="button"
                      className={`rg-skin-btn ${form.skinTone === s.name ? 'active' : ''}`}
                      onClick={() => set('skinTone', form.skinTone === s.name ? '' : s.name)}>
                      <span className="rg-skin-swatch" style={{ background: s.hex }} />
                      <span>{s.name}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Body Type" error={errors.bodyType}>
                <div className="rg-body-types">
                  {BODY_TYPES.map(b => (
                    <button key={b.value} type="button"
                      className={`rg-body-btn ${form.bodyType === b.value ? 'active' : ''}`}
                      onClick={() => set('bodyType', b.value)}>
                      <span className="rg-body-label">{b.label}</span>
                      <span className="rg-body-desc">{b.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="rg-fields">
              <Field label="Favourite Colours" hint="Pick any that speak to you">
                <div className="rg-colors">
                  {COLORS.map(c => (
                    <button key={c.name} type="button"
                      className={`rg-color-btn ${form.favoriteColors.includes(c.name) ? 'active' : ''}`}
                      onClick={() => toggleArr('favoriteColors', c.name)}
                      title={c.name}>
                      <span className="rg-color-swatch"
                        style={{ background: c.hex, boxShadow: c.outline ? 'inset 0 0 0 1px #D1D5DB' : 'none' }} />
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Fashion Style" hint="Select all that apply" error={errors.fashionStyles}>
                <div className="rg-style-chips">
                  {STYLE_OPTIONS.map(s => (
                    <button key={s} type="button"
                      className={`rg-chip ${form.fashionStyles.includes(s) ? 'active' : ''}`}
                      onClick={() => toggleArr('fashionStyles', s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Budget Range (NPR)" hint="Per outfit">
                <div className="rg-budget-quick">
                  {BUDGET_PRESETS.map(p => (
                    <button key={p.label} type="button"
                      className={`rg-budget-preset ${form.budgetMin === p.min && form.budgetMax === p.max ? 'active' : ''}`}
                      onClick={() => { set('budgetMin', p.min); set('budgetMax', p.max); }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="rg-budget-inputs">
                  <div className="rg-budget-box">
                    <label>Min (NPR)</label>
                    <input type="number" value={form.budgetMin} min={0}
                      onChange={e => set('budgetMin', Number(e.target.value))} />
                  </div>
                  <span className="rg-budget-sep">—</span>
                  <div className="rg-budget-box">
                    <label>Max (NPR)</label>
                    <input type="number" value={form.budgetMax} min={0}
                      onChange={e => set('budgetMax', Number(e.target.value))} />
                  </div>
                </div>
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="rg-success">
              <div className="rg-success-ring">
                <div className="rg-success-check">✓</div>
              </div>
              <h2 className="rg-success-title">Your Style Journey<br />Begins Here</h2>
              <p className="rg-success-sub">
                Welcome, <strong>{firstName}</strong>! Your personalised style profile is ready.
                Let's discover outfits made just for you.
              </p>
              {emailVerifSent && (
                <div style={{
                  margin: '0 0 16px',
                  padding: '12px 16px',
                  background: '#F5F3FF',
                  border: '1.5px solid #DDD6FE',
                  borderRadius: 10,
                  fontSize: '0.82rem',
                  color: '#4C1D95',
                  lineHeight: 1.55,
                  textAlign: 'left',
                }}>
                  📧 <strong>Verify your email</strong> — We sent a verification link to <strong>{form.email}</strong>. Please check your inbox to activate full account features.
                </div>
              )}
              <div className="rg-success-stats">
                <div className="rg-success-stat">
                  <span>{form.fashionStyles.length || '—'}</span>
                  <small>Styles</small>
                </div>
                <div className="rg-success-divider" />
                <div className="rg-success-stat">
                  <span>{form.favoriteColors.length || '—'}</span>
                  <small>Colours</small>
                </div>
                <div className="rg-success-divider" />
                <div className="rg-success-stat">
                  <span>AI</span>
                  <small>Ready</small>
                </div>
              </div>
              <button className="rg-btn-primary rg-btn--full" onClick={async () => {
                // Authenticate into context now (httpOnly cookie is already set).
                // This is the explicit user action that grants access to protected routes.
                try { await refreshUser(); } catch { /* cookie still valid; proceed */ }
                navigate('/dashboard', { replace: true });
              }}>
                Discover My Outfits →
              </button>
              <p className="rg-success-note">Your personalised recommendations are waiting on the dashboard</p>
            </div>
          )}

          {step < 3 && (
            <div className="rg-actions">
              {step > 0
                ? <button className="rg-btn-back" onClick={back}>← Back</button>
                : <Link to="/login" className="rg-link">Already have an account?</Link>
              }
              <button className="rg-btn-primary" onClick={next} disabled={loading}>
                {loading
                  ? <span className="rg-spinner" />
                  : step === 2 ? 'Create My Profile' : 'Continue →'
                }
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div className="rg-field">
      <div className="rg-field-head">
        <label className="rg-label">{label}</label>
        {hint && <span className="rg-hint">{hint}</span>}
      </div>
      {children}
      {error && <p className="rg-err-txt">{error}</p>}
    </div>
  );
}
