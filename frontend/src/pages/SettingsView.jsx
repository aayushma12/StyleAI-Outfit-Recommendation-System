import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import useScrollSpy from '../hooks/useScrollSpy';
import './SettingsView.css';

const Ic = ({ d, size = 18, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const I = {
  user:    "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  lock:    "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7 4v3M12 7a4 4 0 00-4 4h8a4 4 0 00-4-4z",
  bell:    "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9m-4.27 13a2 2 0 01-3.46 0",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11 3a3 3 0 100-6 3 3 0 000 6z",
  eye_off: "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
  brain:   "M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7H4a2 2 0 00-2 2v0a2 2 0 002 2h.5A2.5 2.5 0 017 13.5v0A2.5 2.5 0 019.5 16v0A2.5 2.5 0 0112 18.5v0A2.5 2.5 0 0114.5 16v0A2.5 2.5 0 0117 13.5v0A2.5 2.5 0 0119.5 11H20a2 2 0 002-2v0a2 2 0 00-2-2h-.5A2.5 2.5 0 0117 4.5v0A2.5 2.5 0 0114.5 2v0a2 2 0 00-4 0",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  database:"M12 2C8.13 2 5 3.34 5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5c0-1.66-3.13-3-7-3zm0 2c3.31 0 5 1.01 5 1.5S15.31 7 12 7 7 5.99 7 5.5 8.69 4 12 4zm0 14c-3.31 0-5-1.01-5-1.5v-1.09C8.21 15.78 10.05 16 12 16s3.79-.22 5-0.59V17.5c0 .49-1.69 1.5-5 1.5z",
  trash:   "M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2",
  check:   "M20 6L9 17l-5-5",
  x:       "M18 6L6 18M6 6l12 12",
  chevron: "M9 18l6-6-6-6",
  camera:  "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  save:    "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zm-7-1v-8H7v8m5-14h3.5L17 8H9",
  sparkle: "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z",
  link:    "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  mail:    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2l-8 5-8-5",
  phone:   "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z",
  info:    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14v4m0 4h.01",
  alert:   "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
};

function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`sv-toast sv-toast--${type}`}>
      <Ic d={type === 'success' ? I.check : I.x} size={15} />
      <span>{msg}</span>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={`sv-toggle ${checked ? 'sv-toggle--on' : ''} ${disabled ? 'sv-toggle--disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="sv-toggle-knob" />
    </button>
  );
}

const SECTIONS = [
  { id: 'profile',        label: 'Profile',          icon: I.user },
  { id: 'password',       label: 'Password',         icon: I.lock },
  { id: 'notifications',  label: 'Notifications',    icon: I.bell },
  { id: 'privacy',        label: 'Privacy',          icon: I.eye },
  { id: 'ai',             label: 'AI Personalization', icon: I.brain },
  { id: 'data',           label: 'Data & Consent',   icon: I.database },
  { id: 'danger',         label: 'Account',          icon: I.trash },
];

const STYLE_OPTIONS     = ['casual','formal','traditional','western','fusion','sporty','bohemian','minimalist'];
const OCCASION_OPTIONS  = ['daily','college','office','festival','wedding','party','casual_outing','religious'];
const COLOR_OPTIONS     = ['Black','White','Red','Blue','Green','Yellow','Pink','Purple','Orange','Beige','Brown','Navy','Maroon'];
const BODY_TYPES        = ['hourglass','pear','apple','rectangle','inverted_triangle'];
const SKIN_TONES        = ['Fair','Light','Medium','Olive','Brown','Dark'];

export default function SettingsView() {
  const { user, setUser, logout } = useAuth();
  const [toast, setToast] = useState(null);
  const { active: activeSection, refFor, scrollTo } = useScrollSpy({
    initialId: 'profile', datasetKey: 'section', threshold: 0.25, rootMargin: '-80px 0px -60% 0px',
  });

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  return (
    <div className="sv-root">
      {toast && (
        <Toast key={toast.key} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Page header */}
      <div className="sv-header">
        <div className="sv-header-left">
          <h1 className="sv-header-title">Account Settings</h1>
          <p className="sv-header-sub">Manage your profile, security, and preferences</p>
        </div>
        <div className="sv-header-avatar">
          <div className="sv-avatar-ring">
            <div className="sv-avatar-inner">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
          <div className="sv-header-user-info">
            <p className="sv-hu-name">{user?.name}</p>
            <p className="sv-hu-email">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="sv-layout">
        {/* Sticky sidebar nav */}
        <aside className="sv-sidenav">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`sv-sidenav-item ${activeSection === s.id ? 'active' : ''} ${s.id === 'danger' ? 'sv-sidenav-item--danger' : ''}`}
              onClick={() => scrollTo(s.id)}
            >
              <span className="sv-sni-icon"><Ic d={s.icon} size={16} /></span>
              <span className="sv-sni-label">{s.label}</span>
              <span className="sv-sni-chevron"><Ic d={I.chevron} size={14} /></span>
            </button>
          ))}
        </aside>

        {/* Sections */}
        <div className="sv-content">

          <section ref={refFor('profile')} data-section="profile" className="sv-section">
            <ProfileSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('password')} data-section="password" className="sv-section">
            <PasswordSection showToast={showToast} />
          </section>

          <section ref={refFor('notifications')} data-section="notifications" className="sv-section">
            <NotificationsSection showToast={showToast} />
          </section>

          <section ref={refFor('privacy')} data-section="privacy" className="sv-section">
            <PrivacySection showToast={showToast} />
          </section>

          <section ref={refFor('ai')} data-section="ai" className="sv-section">
            <AISection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('data')} data-section="data" className="sv-section">
            <DataSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('danger')} data-section="danger" className="sv-section">
            <DangerSection logout={logout} showToast={showToast} />
          </section>

        </div>
      </div>
    </div>
  );
}

const GENDER_OPTIONS = [
  { value: 'female',           label: 'Female' },
  { value: 'male',             label: 'Male' },
  { value: 'other',            label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const COMPLETION_CHECKS = [
  { key: 'name',                  label: 'Full name',           check: u => !!u.name },
  { key: 'age',                   label: 'Age',                 check: u => !!u.age },
  { key: 'gender',                label: 'Gender',              check: u => !!u.gender },
  { key: 'bodyType',              label: 'Body type',           check: u => !!u.bodyType },
  { key: 'skinTone',              label: 'Skin tone',           check: u => !!u.skinTone },
  { key: 'culturalBackground',    label: 'Cultural background', check: u => !!u.culturalBackground },
  { key: 'stylePreferences',      label: 'Style preferences',   check: u => (u.stylePreferences?.length || 0) > 0 },
  { key: 'colorPreferences',      label: 'Color preferences',   check: u => (u.colorPreferences?.length || 0) > 0 },
  { key: 'occasionPreferences',   label: 'Occasion preferences',check: u => (u.occasionPreferences?.length || 0) > 0 },
  { key: 'onboardingCompleted',   label: 'Onboarding',          check: u => !!u.onboardingCompleted },
];

function ProfileCompletion({ user }) {
  const done    = COMPLETION_CHECKS.filter(c => c.check(user));
  const missing = COMPLETION_CHECKS.filter(c => !c.check(user));
  const pct     = Math.round((done.length / COMPLETION_CHECKS.length) * 100);

  const color = pct === 100 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';
  const emoji = pct === 100 ? '🎉' : pct >= 60 ? '✨' : '📝';

  return (
    <div className="sv-completion">
      <div className="sv-completion-hd">
        <span className="sv-completion-emoji">{emoji}</span>
        <div style={{ flex: 1 }}>
          <div className="sv-completion-title">
            Profile Completion — <span style={{ color }}>{pct}%</span>
          </div>
          <div className="sv-completion-bar">
            <div className="sv-completion-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
        <span className="sv-completion-frac">{done.length}/{COMPLETION_CHECKS.length}</span>
      </div>
      {missing.length > 0 && (
        <div className="sv-completion-missing">
          <span className="sv-completion-ml">To do:</span>
          {missing.map(c => (
            <span key={c.key} className="sv-completion-chip">{c.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileSection({ user, setUser, showToast }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || '',
    skinTone: user?.skinTone || '',
    bodyType: user?.bodyType || '',
    culturalBackground: user?.culturalBackground || '',
    location: user?.location || 'Kathmandu',
  });
  const [loading, setLoading] = useState(false);
  const [changed, setChanged] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setChanged(true); };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.put('/users/profile', {
        name: form.name,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        bodyType: form.bodyType || undefined,
        skinTone: form.skinTone || undefined,
        culturalBackground: form.culturalBackground || undefined,
        location: form.location || undefined,
      });
      setUser(data.user);
      setChanged(false);
      showToast('Profile updated successfully!');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Failed to update profile.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="sv-card">
      <SectionHead icon={I.user} title="Profile Settings" sub="Update your personal information" color="#0D9488" />

      {/* Avatar row */}
      <div className="sv-avatar-row">
        <div className="sv-profile-avatar">
          <span>{user?.name?.[0]?.toUpperCase() || 'A'}</span>
          <div className="sv-avatar-cam"><Ic d={I.camera} size={13} /></div>
        </div>
        <div>
          <p className="sv-avatar-name">{user?.name}</p>
          <p className="sv-avatar-since">Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          <span className="sv-avatar-badge">✦ StyleAI Member</span>
        </div>
      </div>

      <ProfileCompletion user={user} />

      <div className="sv-divider" />

      {/* Form grid */}
      <div className="sv-form-grid">
        <FieldGroup label="Full Name" required icon={I.user}>
          <input className="sv-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
        </FieldGroup>

        <FieldGroup label="Email Address" icon={I.mail}>
          <input className="sv-input sv-input--readonly" value={user?.email || ''} readOnly />
          <p className="sv-field-hint">Email cannot be changed</p>
        </FieldGroup>

        <FieldGroup label="Age" icon={I.info}>
          <input className="sv-input" type="number" min="13" max="80" value={form.age}
            onChange={e => set('age', e.target.value)} placeholder="Your age" />
        </FieldGroup>

        <FieldGroup label="Gender" icon={I.user}>
          <select className="sv-input sv-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
            <option value="">Select gender…</option>
            {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </FieldGroup>

        <FieldGroup label="Cultural Background" icon={I.sparkle}>
          <input className="sv-input" value={form.culturalBackground}
            onChange={e => set('culturalBackground', e.target.value)} placeholder="e.g. Nepali, South Asian…" />
        </FieldGroup>

        <FieldGroup label="Location / City" icon={I.info}>
          <input className="sv-input" value={form.location}
            onChange={e => set('location', e.target.value)} placeholder="e.g. Kathmandu" />
        </FieldGroup>

        <FieldGroup label="Skin Tone" fullWidth icon={I.eye}>
          <div className="sv-chip-row">
            {SKIN_TONES.map(t => (
              <button key={t} className={`sv-chip ${form.skinTone === t ? 'sv-chip--active' : ''}`}
                onClick={() => set('skinTone', t)}>{t}</button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup label="Body Type" fullWidth icon={I.user}>
          <div className="sv-chip-row">
            {BODY_TYPES.map(b => (
              <button key={b} className={`sv-chip ${form.bodyType === b ? 'sv-chip--active' : ''}`}
                onClick={() => set('bodyType', b)}>{b.replace('_', ' ')}</button>
            ))}
          </div>
        </FieldGroup>
      </div>

      <div className="sv-card-footer">
        {changed && <span className="sv-unsaved-badge">Unsaved changes</span>}
        <button className="sv-btn sv-btn--primary" onClick={handleSave} disabled={loading || !changed}>
          {loading ? <span className="sv-spinner" /> : <Ic d={I.save} size={15} />}
          {loading ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

function PasswordSection({ showToast }) {
  const [form, setForm]     = useState({ current: '', next: '', confirm: '' });
  const [show, setShow]     = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.current) e.current = 'Required';
    if (!form.next || form.next.length < 6) e.next = 'Minimum 6 characters';
    if (form.next !== form.confirm) e.confirm = "Passwords don't match";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const strength = () => {
    const p = form.next;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const str = strength();
  const strLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][str];
  const strColor = ['', '#EF4444', '#F59E0B', '#22C55E', '#0D9488'][str];

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.put('/users/password', { currentPassword: form.current, newPassword: form.next });
      setForm({ current: '', next: '', confirm: '' });
      showToast('Password changed successfully!');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Failed to change password.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="sv-card">
      <SectionHead icon={I.lock} title="Password Management" sub="Keep your account secure with a strong password" color="#0D9488" />

      <div className="sv-security-tips">
        {['Use at least 8 characters', 'Mix letters, numbers & symbols', 'Never reuse old passwords'].map(t => (
          <div key={t} className="sv-tip">
            <span className="sv-tip-dot" />
            <span>{t}</span>
          </div>
        ))}
      </div>

      <div className="sv-form-grid">
        <FieldGroup label="Current Password" icon={I.lock} error={errors.current} fullWidth>
          <PasswordInput value={form.current} onChange={v => set('current', v)}
            show={show.current} onToggle={() => setShow(s => ({ ...s, current: !s.current }))}
            placeholder="Enter current password" error={errors.current} />
        </FieldGroup>

        <FieldGroup label="New Password" icon={I.lock} error={errors.next} fullWidth>
          <PasswordInput value={form.next} onChange={v => set('next', v)}
            show={show.next} onToggle={() => setShow(s => ({ ...s, next: !s.next }))}
            placeholder="Enter new password" error={errors.next} />
          {form.next && (
            <div className="sv-strength">
              <div className="sv-strength-bars">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`sv-strength-bar ${i <= str ? 'active' : ''}`}
                    style={{ '--sc': i <= str ? strColor : '#E5E7EB' }} />
                ))}
              </div>
              <span className="sv-strength-label" style={{ color: strColor }}>{strLabel}</span>
            </div>
          )}
        </FieldGroup>

        <FieldGroup label="Confirm New Password" icon={I.lock} error={errors.confirm} fullWidth>
          <PasswordInput value={form.confirm} onChange={v => set('confirm', v)}
            show={show.confirm} onToggle={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
            placeholder="Confirm new password" error={errors.confirm} />
        </FieldGroup>
      </div>

      <div className="sv-card-footer">
        <button className="sv-btn sv-btn--primary" onClick={handleSave} disabled={loading}>
          {loading ? <span className="sv-spinner" /> : <Ic d={I.lock} size={15} />}
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder, error }) {
  return (
    <div className={`sv-pw-wrap ${error ? 'sv-pw-wrap--error' : ''}`}>
      <input className="sv-input sv-pw-input" type={show ? 'text' : 'password'}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      <button className="sv-pw-eye" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>
        <Ic d={show ? I.eye_off : I.eye} size={16} />
      </button>
    </div>
  );
}

const DEFAULT_NOTIFS = {
  emailRecommendations: true,
  emailWeeklyDigest: true,
  emailNewFeatures: false,
  pushSavedOutfit: true,
  pushTrending: false,
  pushReminders: true,
  smsAlerts: false,
};

function NotificationsSection({ showToast }) {
  const LS_KEY = 'sv_notif_prefs';
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULT_NOTIFS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
    catch { return DEFAULT_NOTIFS; }
  });

  const toggle = (k) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    showToast('Notification preferences saved!');
  };

  const GROUPS = [
    {
      label: 'Email Notifications', icon: I.mail, color: '#0D9488',
      items: [
        { key: 'emailRecommendations', label: 'AI Outfit Recommendations', sub: 'New personalized picks based on your style' },
        { key: 'emailWeeklyDigest',    label: 'Weekly Style Digest',        sub: 'A curated roundup of trending outfits' },
        { key: 'emailNewFeatures',     label: 'Product Updates',            sub: "What's new in StyleAI" },
      ],
    },
    {
      label: 'Push Notifications', icon: I.bell, color: '#06B6D4',
      items: [
        { key: 'pushSavedOutfit',  label: 'Saved Outfit Reminders', sub: "You haven't worn this in a while" },
        { key: 'pushTrending',     label: 'Trending Alerts',        sub: 'When a style you like is trending' },
        { key: 'pushReminders',    label: 'Daily Style Prompt',     sub: "Get today's outfit suggestion in the morning" },
      ],
    },
    {
      label: 'SMS Notifications', icon: I.phone, color: '#0891B2',
      items: [
        { key: 'smsAlerts', label: 'Critical Account Alerts', sub: 'Security alerts and important account info only' },
      ],
    },
  ];

  return (
    <div className="sv-card">
      <SectionHead icon={I.bell} title="Notification Preferences" sub="Choose how and when StyleAI contacts you" color="#06B6D4" />
      <div className="sv-notif-groups">
        {GROUPS.map(g => (
          <div key={g.label} className="sv-notif-group">
            <div className="sv-notif-group-head">
              <span className="sv-notif-group-icon" style={{ '--ic': g.color }}><Ic d={g.icon} size={15} /></span>
              <span className="sv-notif-group-label">{g.label}</span>
            </div>
            {g.items.map(item => (
              <div key={item.key} className="sv-toggle-row">
                <div className="sv-toggle-info">
                  <p className="sv-toggle-label">{item.label}</p>
                  <p className="sv-toggle-sub">{item.sub}</p>
                </div>
                <Toggle checked={prefs[item.key]} onChange={() => toggle(item.key)} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="sv-card-footer">
        <button className="sv-btn sv-btn--primary" onClick={save}>
          <Ic d={I.save} size={15} />Save Preferences
        </button>
      </div>
    </div>
  );
}

const DEFAULT_PRIVACY = {
  profileVisible: true,
  showSavedOutfits: false,
  showLikedOutfits: false,
  allowStyleAnalytics: true,
  shareAnonymousData: true,
};

function PrivacySection({ showToast }) {
  const LS_KEY = 'sv_privacy_prefs';
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULT_PRIVACY, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
    catch { return DEFAULT_PRIVACY; }
  });

  const toggle = (k) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    showToast('Privacy settings saved!');
  };

  const ITEMS = [
    { key: 'profileVisible',      label: 'Public Profile',             sub: 'Allow StyleAI to show your style profile in community features', icon: I.eye },
    { key: 'showSavedOutfits',    label: 'Show Saved Outfits',         sub: 'Let others see outfits you have saved to your wardrobe', icon: I.shield },
    { key: 'showLikedOutfits',    label: 'Show Liked Outfits',         sub: 'Display your liked outfits on your public profile', icon: I.shield },
    { key: 'allowStyleAnalytics', label: 'Style Analytics',            sub: 'Let StyleAI analyze your interactions to improve recommendations', icon: I.brain },
    { key: 'shareAnonymousData',  label: 'Anonymous Usage Data',       sub: 'Share anonymized data to help improve the AI for all users', icon: I.database },
  ];

  return (
    <div className="sv-card">
      <SectionHead icon={I.eye} title="Privacy Settings" sub="Control who sees your activity and how your data is used" color="#0891B2" />
      <div className="sv-privacy-note">
        <Ic d={I.info} size={15} />
        <span>Your personal information is never sold. These settings only affect feature visibility within StyleAI.</span>
      </div>
      <div className="sv-toggle-list">
        {ITEMS.map(item => (
          <div key={item.key} className="sv-toggle-row">
            <div className="sv-toggle-icon-wrap"><Ic d={item.icon} size={15} /></div>
            <div className="sv-toggle-info">
              <p className="sv-toggle-label">{item.label}</p>
              <p className="sv-toggle-sub">{item.sub}</p>
            </div>
            <Toggle checked={prefs[item.key]} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>
      <div className="sv-card-footer">
        <button className="sv-btn sv-btn--primary" onClick={save}>
          <Ic d={I.save} size={15} />Save Privacy Settings
        </button>
      </div>
    </div>
  );
}

function AISection({ user, setUser, showToast }) {
  const [styles, setStyles]     = useState(user?.stylePreferences || []);
  const [occasions, setOccasions] = useState(user?.occasionPreferences || []);
  const [colors, setColors]     = useState(user?.colorPreferences || []);
  const [budget, setBudget]     = useState({ min: user?.budgetRange?.min || 0, max: user?.budgetRange?.max || 10000 });
  const [aiMode, setAiMode]     = useState(() => localStorage.getItem('sv_ai_mode') || 'balanced');
  const [loading, setLoading]   = useState(false);

  const toggleArr = (arr, setArr, val) =>
    setArr(a => a.includes(val) ? a.filter(x => x !== val) : [...a, val]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.put('/users/profile', {
        stylePreferences: styles,
        occasionPreferences: occasions,
        colorPreferences: colors,
        budgetRange: budget,
      });
      setUser(data.user);
      localStorage.setItem('sv_ai_mode', aiMode);
      showToast('AI preferences updated!');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Update failed.', 'error');
    } finally { setLoading(false); }
  };

  const AI_MODES = [
    { id: 'conservative', label: 'Safe & Familiar',  desc: 'Stick to styles you already love', emoji: '🛡️' },
    { id: 'balanced',     label: 'Balanced',          desc: 'Mix of familiar and new suggestions', emoji: '⚖️' },
    { id: 'adventurous',  label: 'Adventurous',       desc: 'Push boundaries with bold new styles', emoji: '🚀' },
  ];

  return (
    <div className="sv-card">
      <SectionHead icon={I.brain} title="AI Personalization" sub="Fine-tune how StyleAI learns and recommends for you" color="#0D9488" />

      {/* AI Mode */}
      <div className="sv-ai-section">
        <p className="sv-sub-label">Recommendation Mode</p>
        <div className="sv-ai-modes">
          {AI_MODES.map(m => (
            <button key={m.id} className={`sv-ai-mode-btn ${aiMode === m.id ? 'active' : ''}`}
              onClick={() => setAiMode(m.id)}>
              <span className="sv-aim-emoji">{m.emoji}</span>
              <span className="sv-aim-label">{m.label}</span>
              <span className="sv-aim-desc">{m.desc}</span>
              {aiMode === m.id && <span className="sv-aim-check"><Ic d={I.check} size={12} /></span>}
            </button>
          ))}
        </div>
      </div>

      <div className="sv-divider" />

      {/* Style preferences */}
      <div className="sv-ai-section">
        <p className="sv-sub-label">Style Preferences <span className="sv-count-badge">{styles.length}</span></p>
        <div className="sv-chip-row">
          {STYLE_OPTIONS.map(s => (
            <button key={s} className={`sv-chip ${styles.includes(s) ? 'sv-chip--active' : ''}`}
              onClick={() => toggleArr(styles, setStyles, s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Occasion preferences */}
      <div className="sv-ai-section">
        <p className="sv-sub-label">Occasion Preferences <span className="sv-count-badge">{occasions.length}</span></p>
        <div className="sv-chip-row">
          {OCCASION_OPTIONS.map(o => (
            <button key={o} className={`sv-chip ${occasions.includes(o) ? 'sv-chip--active' : ''}`}
              onClick={() => toggleArr(occasions, setOccasions, o)}>
              {o.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Color preferences */}
      <div className="sv-ai-section">
        <p className="sv-sub-label">Color Preferences <span className="sv-count-badge">{colors.length}</span></p>
        <div className="sv-color-row">
          {COLOR_OPTIONS.map(c => (
            <button key={c} title={c}
              className={`sv-color-dot ${colors.includes(c) ? 'sv-color-dot--active' : ''}`}
              style={{ '--col': c.toLowerCase() === 'beige' ? '#F5F5DC' : c.toLowerCase() }}
              onClick={() => toggleArr(colors, setColors, c)}>
              {colors.includes(c) && <Ic d={I.check} size={10} fill="white" />}
            </button>
          ))}
        </div>
        <div className="sv-color-labels">
          {colors.map(c => <span key={c} className="sv-color-tag">{c}</span>)}
        </div>
      </div>

      {/* Budget */}
      <div className="sv-ai-section">
        <p className="sv-sub-label">Budget Range</p>
        <div className="sv-budget-row">
          <div className="sv-budget-field">
            <label className="sv-budget-label">Min (₹)</label>
            <input className="sv-input sv-input--sm" type="number" min="0" value={budget.min}
              onChange={e => setBudget(b => ({ ...b, min: Number(e.target.value) }))} />
          </div>
          <div className="sv-budget-dash">—</div>
          <div className="sv-budget-field">
            <label className="sv-budget-label">Max (₹)</label>
            <input className="sv-input sv-input--sm" type="number" min="0" value={budget.max}
              onChange={e => setBudget(b => ({ ...b, max: Number(e.target.value) }))} />
          </div>
          <div className="sv-budget-preview">
            <span className="sv-budget-chip">₹{budget.min.toLocaleString()} – ₹{budget.max.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="sv-card-footer">
        <button className="sv-btn sv-btn--primary" onClick={handleSave} disabled={loading}>
          {loading ? <span className="sv-spinner" /> : <Ic d={I.sparkle} size={15} />}
          {loading ? 'Saving…' : 'Update AI Preferences'}
        </button>
      </div>
    </div>
  );
}

function DataSection({ user, setUser, showToast }) {
  const [consent, setConsent] = useState(user?.consentGiven ?? false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.put('/users/consent', { consentGiven: consent });
      setUser(data.user);
      showToast('Data preferences saved!');
    } catch (e) {
      showToast('Failed to save.', 'error');
    } finally { setLoading(false); }
  };

  const DATA_ITEMS = [
    { icon: '📊', title: 'Usage Analytics', desc: 'We collect anonymized app usage data to improve features and fix bugs.' },
    { icon: '🤖', title: 'AI Training Data', desc: 'Your style interactions help train our recommendation model for better accuracy.' },
    { icon: '🔒', title: 'Data Security', desc: 'All personal data is encrypted at rest and in transit using industry-standard protocols.' },
    { icon: '🗑️', title: 'Data Deletion', desc: 'You can request full data deletion at any time. Processing takes up to 30 days.' },
  ];

  return (
    <div className="sv-card">
      <SectionHead icon={I.database} title="Data & Consent Settings" sub="Understand and control how your data is used" color="#0891B2" />

      <div className="sv-data-grid">
        {DATA_ITEMS.map(d => (
          <div key={d.title} className="sv-data-card">
            <span className="sv-dc-icon">{d.icon}</span>
            <div>
              <p className="sv-dc-title">{d.title}</p>
              <p className="sv-dc-desc">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="sv-divider" />

      <div className="sv-consent-toggle-row">
        <div>
          <p className="sv-toggle-label">Data Processing Consent</p>
          <p className="sv-toggle-sub">
            I agree to the collection and processing of my style data to enable AI recommendations.
            {user?.consentDate && (
              <span className="sv-consent-date"> Consented on {new Date(user.consentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            )}
          </p>
        </div>
        <Toggle checked={consent} onChange={setConsent} />
      </div>

      {!consent && (
        <div className="sv-consent-warning">
          <Ic d={I.alert} size={15} />
          <span>Without data consent, AI recommendations may be limited or unavailable.</span>
        </div>
      )}

      <div className="sv-card-footer">
        <button className="sv-btn sv-btn--outline" onClick={() => window.open('/legal#privacy', '_blank', 'noopener,noreferrer')}>
          <Ic d={I.link} size={15} />Privacy Policy
        </button>
        <button className="sv-btn sv-btn--primary" onClick={handleSave} disabled={loading}>
          {loading ? <span className="sv-spinner" /> : <Ic d={I.save} size={15} />}
          {loading ? 'Saving…' : 'Save Consent'}
        </button>
      </div>
    </div>
  );
}

function DangerSection({ logout, showToast }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

  const handleDelete = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setLoading(true);
    try {
      await api.delete('/users/account');
      showToast('Account deleted. Goodbye!');
      setTimeout(logout, 1500);
    } catch (e) {
      showToast('Failed to delete account.', 'error');
      setLoading(false);
    }
  };

  const ACCOUNT_ACTIONS = [
    {
      icon: I.save,
      label: 'Export My Data',
      sub: 'Download a copy of all your StyleAI data in JSON format',
      btnLabel: 'Export Data',
      color: '#0891B2',
      onClick: () => showToast('Data export will be emailed to you within 24 hours.'),
    },
    {
      icon: I.link,
      label: 'Deactivate Account',
      sub: 'Temporarily disable your account. You can reactivate anytime by logging back in.',
      btnLabel: 'Deactivate',
      color: '#D97706',
      onClick: () => showToast('Contact support to deactivate your account.'),
    },
  ];

  return (
    <div className="sv-card sv-card--danger-zone">
      <SectionHead icon={I.trash} title="Account Management" sub="Irreversible actions — proceed with care" color="#DC2626" />

      {/* Safe account actions */}
      <div className="sv-account-actions">
        {ACCOUNT_ACTIONS.map(a => (
          <div key={a.label} className="sv-account-action-row">
            <div className="sv-aa-icon" style={{ '--ac': a.color }}><Ic d={a.icon} size={16} /></div>
            <div className="sv-aa-info">
              <p className="sv-aa-label">{a.label}</p>
              <p className="sv-aa-sub">{a.sub}</p>
            </div>
            <button className="sv-btn sv-btn--outline sv-btn--sm" style={{ '--bc': a.color }} onClick={a.onClick}>
              {a.btnLabel}
            </button>
          </div>
        ))}
      </div>

      <div className="sv-divider" />

      {/* Delete zone */}
      <div className="sv-danger-box">
        <div className="sv-danger-head">
          <div className="sv-danger-icon"><Ic d={I.trash} size={20} /></div>
          <div>
            <p className="sv-danger-title">Delete Account Permanently</p>
            <p className="sv-danger-sub">This will permanently erase your profile, saved outfits, recommendations, and all associated data. This action cannot be undone.</p>
          </div>
        </div>

        {!confirmOpen ? (
          <button className="sv-btn sv-btn--danger" onClick={() => setConfirmOpen(true)}>
            <Ic d={I.trash} size={15} />Delete My Account
          </button>
        ) : (
          <div className="sv-confirm-zone">
            <p className="sv-confirm-instruction">
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm deletion:
            </p>
            <input
              className={`sv-input sv-input--danger ${confirmText === CONFIRM_PHRASE ? 'sv-input--confirmed' : ''}`}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
            />
            <div className="sv-confirm-btns">
              <button className="sv-btn sv-btn--ghost" onClick={() => { setConfirmOpen(false); setConfirmText(''); }}>
                Cancel
              </button>
              <button className="sv-btn sv-btn--danger"
                disabled={confirmText !== CONFIRM_PHRASE || loading}
                onClick={handleDelete}>
                {loading ? <span className="sv-spinner sv-spinner--white" /> : <Ic d={I.trash} size={15} />}
                {loading ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHead({ icon, title, sub, color }) {
  return (
    <div className="sv-section-head">
      <div className="sv-sh-icon" style={{ '--ic': color }}><Ic d={icon} size={20} /></div>
      <div>
        <h2 className="sv-sh-title">{title}</h2>
        <p className="sv-sh-sub">{sub}</p>
      </div>
    </div>
  );
}

function FieldGroup({ label, icon, children, fullWidth, required, error }) {
  return (
    <div className={`sv-field ${fullWidth ? 'sv-field--full' : ''} ${error ? 'sv-field--error' : ''}`}>
      <label className="sv-label">
        {icon && <span className="sv-label-icon"><Ic d={icon} size={13} /></span>}
        {label}
        {required && <span className="sv-required">*</span>}
      </label>
      {children}
      {error && <p className="sv-field-error">{error}</p>}
    </div>
  );
}
