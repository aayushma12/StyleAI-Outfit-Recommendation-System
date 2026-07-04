import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ColorPreferencePicker from '../components/ColorPreferencePicker';
import useScrollSpy from '../hooks/useScrollSpy';
import './StyleProfileView.css';

/* ── Icon helper ──────────────────────────────────────────────────────── */
const Ic = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const I = {
  user:      "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  body:      "M12 2a5 5 0 015 5v2a5 5 0 01-10 0V7a5 5 0 015-5zM4 20c0-4 3.6-7 8-7s8 3 8 7",
  palette:   "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.54-.21-1.04-.57-1.43a.993.993 0 01.83-1.57H16c3.31 0 6-2.69 6-6C22 6.04 17.52 2 12 2z",
  hanger:    "M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z",
  shopping:  "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18m-5 4a4 4 0 01-8 0",
  star:      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  sparkle:   "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z",
  camera:    "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  save:      "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zm-7-1v-8H7v8m5-14h3.5L17 8H9",
  check:     "M20 6L9 17l-5-5",
  x:         "M18 6L6 18M6 6l12 12",
  chevron:   "M9 18l6-6-6-6",
  heart:     "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  globe:     "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
  lifestyle: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  tag:       "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01",
  info:      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14v4m0 4h.01",
  edit:      "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  refresh:   "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
};


/* ── Profile completion score ─────────────────────────────────────────── */
const SCALAR_FIELDS  = ['name','email','bio','dateOfBirth','gender','age','location','occupation','phoneNumber','height','weight','bodyType','skinTone','clothingSize','hairColor','lifestyle','shoppingFrequency','preferredShoppingLocation'];
const ARRAY_FIELDS   = ['fashionStyles','stylePreferences','colorPreferences','fabricPreferences','favoriteOutfitTypes','occasionPreferences','fashionInspiration'];

function calcCompletion(user) {
  if (!user) return 0;
  let filled = 0;
  const total = SCALAR_FIELDS.length + ARRAY_FIELDS.length;
  SCALAR_FIELDS.forEach(f => { if (user[f]) filled++; });
  ARRAY_FIELDS.forEach(f => { if (user[f]?.length > 0) filled++; });
  return Math.round((filled / total) * 100);
}

/* ── AI summary generator ─────────────────────────────────────────────── */
function generateSummary(user) {
  if (!user) return '';
  const parts = [];
  const name = user.name?.split(' ')[0] || 'You';
  const styles = (user.fashionStyles || []).slice(0, 2).map(s => s.replace('_', ' '));
  const colors = (user.colorPreferences || []).slice(0, 3);
  const occasions = (user.occasionPreferences || []).slice(0, 2).map(s => s.replace('_', ' '));

  parts.push(`${name} is a ${user.lifestyle?.replace('_', ' ') || 'style-conscious'} individual`);
  if (styles.length) parts.push(`with a ${styles.join(' & ')} aesthetic`);
  if (colors.length) parts.push(`drawn to ${colors.join(', ')} tones`);
  if (occasions.length) parts.push(`dressing for ${occasions.join(' and ')} occasions`);
  if (user.comfortPriority >= 4) parts.push('who values comfort above all');
  if (user.fashionAdventurousness >= 7) parts.push('and loves experimenting with bold new looks');
  if (user.modestyLevel === 'conservative') parts.push('with a preference for modest, covered styles');
  const budget = user.budgetRange;
  if (budget?.max <= 2000) parts.push('shopping on a budget');
  else if (budget?.max >= 15000) parts.push('open to premium fashion');

  return parts.join(', ') + '.';
}

/* ── Toast ─────────────────────────────────────────────────────────────── */
function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`sp-toast sp-toast--${type}`}>
      <Ic d={type === 'success' ? I.check : I.x} size={14} />
      <span>{msg}</span>
    </div>
  );
}

/* ── Chip multi-select ─────────────────────────────────────────────────── */
function ChipSelect({ options, value = [], onChange, max }) {
  const toggle = (v) => {
    if (value.includes(v)) { onChange(value.filter(x => x !== v)); return; }
    if (max && value.length >= max) return;
    onChange([...value, v]);
  };
  return (
    <div className="sp-chip-wrap">
      {options.map(o => {
        const id = typeof o === 'string' ? o : o.id;
        const label = typeof o === 'string' ? o.replace(/_/g,' ') : o.label;
        const emoji = typeof o === 'object' ? o.emoji : null;
        const isActive = value.includes(id);
        return (
          <button key={id} type="button"
            className={`sp-chip ${isActive ? 'sp-chip--on' : ''}`}
            onClick={() => toggle(id)}>
            {emoji && <span>{emoji}</span>}
            <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
            {isActive && <span className="sp-chip-check">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Legacy color name migration (old simple names → new descriptive names) */
const LEGACY_COLOR_MAP = {
  red: 'Red', pink: 'Baby Pink', orange: 'Orange', yellow: 'Yellow',
  green: 'Green', teal: 'Teal', blue: 'Blue', purple: 'Purple',
  black: 'Black', white: 'White', beige: 'Beige', maroon: 'Maroon',
  navy: 'Navy', olive: 'Olive', gold: 'Gold', rose: 'Rose',
  brown: 'Brown', gray: 'Gray',
};
function migrateColors(arr = []) {
  return arr.map(c => LEGACY_COLOR_MAP[c] || c);
}

/* ── Range slider ──────────────────────────────────────────────────────── */
function RangeSlider({ label, value, onChange, min = 1, max = 10, lowLabel, highLabel, color = '#0D9488' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sp-slider-wrap">
      <div className="sp-slider-header">
        <span className="sp-field-label">{label}</span>
        <span className="sp-slider-val" style={{ color }}>{value}<span>/{max}</span></span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="sp-range"
        style={{ '--pct': `${pct}%`, '--clr': color }} />
      <div className="sp-slider-labels">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/* ── Section sidebar items ────────────────────────────────────────────── */
const SECTIONS = [
  { id: 'identity',    label: 'Personal Info',       icon: I.user },
  { id: 'physical',    label: 'Physical Profile',    icon: I.body },
  { id: 'personality', label: 'Fashion Personality', icon: I.sparkle },
  { id: 'colors',      label: 'Colors & Style',      icon: I.palette },
  { id: 'wardrobe',    label: 'Wardrobe Prefs',      icon: I.hanger },
  { id: 'lifestyle',   label: 'Lifestyle',           icon: I.lifestyle },
  { id: 'shopping',    label: 'Shopping Habits',     icon: I.shopping },
  { id: 'inspiration', label: 'Inspiration',         icon: I.star },
  { id: 'summary',     label: 'AI Summary',          icon: I.sparkle },
];

/* ══════════════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════════════ */
export default function StyleProfileView() {
  const { user, setUser } = useAuth();
  const [toast,  setToast]    = useState(null);
  const [score,  setScore]    = useState(0);
  const { active, refFor, scrollTo } = useScrollSpy({ initialId: 'identity', datasetKey: 'sec' });

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  useEffect(() => { setScore(calcCompletion(user)); }, [user]);

  const scoreColor = score >= 80 ? '#0D9488' : score >= 50 ? '#D97706' : '#EF4444';
  const firstName = user?.name?.split(' ')[0] || 'You';
  const summary = generateSummary(user);

  return (
    <div className="sp-root">
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Profile banner ── */}
      <div className="sp-banner">
        <div className="sp-banner-left">
          <div className="sp-banner-avatar">
            {user?.profilePhoto
              ? <img src={user.profilePhoto} alt="avatar" className="sp-avatar-img" />
              : <span className="sp-avatar-initials">{firstName[0]}</span>
            }
            <label className="sp-avatar-cam" htmlFor="sp-photo-input" title="Change photo">
              <Ic d={I.camera} size={14} />
            </label>
            <input id="sp-photo-input" type="file" accept="image/*" className="sp-hidden"
              onChange={e => handlePhotoUpload(e, setUser, showToast)} />
          </div>
          <div className="sp-banner-info">
            <h1 className="sp-banner-name">{user?.name}</h1>
            <p className="sp-banner-sub">
              {user?.occupation || 'Style enthusiast'} &middot; {user?.location || 'Kathmandu'}
            </p>
            {user?.bio && <p className="sp-banner-bio">{user.bio}</p>}
            <div className="sp-banner-chips">
              {(user?.fashionStyles || []).slice(0, 3).map(s => (
                <span key={s} className="sp-banner-chip">{s.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="sp-banner-score">
          <div className="sp-score-ring" style={{ '--score': score, '--clr': scoreColor }}>
            <svg viewBox="0 0 80 80" className="sp-score-svg">
              <circle cx="40" cy="40" r="34" className="sp-score-bg" />
              <circle cx="40" cy="40" r="34" className="sp-score-fill"
                style={{ stroke: scoreColor, strokeDashoffset: `${213.6 - (213.6 * score) / 100}` }} />
            </svg>
            <div className="sp-score-val">
              <span style={{ color: scoreColor }}>{score}%</span>
              <small>Complete</small>
            </div>
          </div>
          <p className="sp-score-label">
            {score >= 80 ? 'Excellent profile!' : score >= 50 ? 'Getting there…' : 'Add more info'}
          </p>
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="sp-layout">

        {/* Sidebar nav */}
        <aside className="sp-sidebar">
          {SECTIONS.map(s => (
            <button key={s.id}
              className={`sp-nav-item ${active === s.id ? 'sp-nav-item--on' : ''}`}
              onClick={() => scrollTo(s.id)}>
              <span className="sp-nav-icon"><Ic d={s.icon} size={16} /></span>
              <span className="sp-nav-label">{s.label}</span>
              <span className="sp-nav-arrow"><Ic d={I.chevron} size={13} /></span>
            </button>
          ))}
        </aside>

        {/* Sections */}
        <div className="sp-content">

          <section ref={refFor('identity')} data-sec="identity" className="sp-section">
            <IdentitySection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('physical')} data-sec="physical" className="sp-section">
            <PhysicalSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('personality')} data-sec="personality" className="sp-section">
            <PersonalitySection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('colors')} data-sec="colors" className="sp-section">
            <ColorsSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('wardrobe')} data-sec="wardrobe" className="sp-section">
            <WardrobeSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('lifestyle')} data-sec="lifestyle" className="sp-section">
            <LifestyleSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('shopping')} data-sec="shopping" className="sp-section">
            <ShoppingSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('inspiration')} data-sec="inspiration" className="sp-section">
            <InspirationSection user={user} setUser={setUser} showToast={showToast} />
          </section>

          <section ref={refFor('summary')} data-sec="summary" className="sp-section">
            <SummarySection user={user} setUser={setUser} showToast={showToast} summary={summary} score={score} />
          </section>

        </div>
      </div>
    </div>
  );
}

/* ── Photo upload helper ─────────────────────────────────────────────── */
async function handlePhotoUpload(e, setUser, showToast) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { showToast('Photo must be under 3 MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const { data } = await api.put('/users/profile', { profilePhoto: ev.target.result });
      setUser(data.user);
      showToast('Profile photo updated!');
    } catch { showToast('Failed to upload photo.', 'error'); }
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

/* ── Reusable section header ─────────────────────────────────────────── */
function SecHead({ icon, title, sub, color = '#0D9488' }) {
  return (
    <div className="sp-sec-head">
      <div className="sp-sh-icon" style={{ '--ic': color }}><Ic d={icon} size={20} /></div>
      <div>
        <h2 className="sp-sh-title">{title}</h2>
        <p className="sp-sh-sub">{sub}</p>
      </div>
    </div>
  );
}

function SaveBtn({ loading, disabled, label = 'Save Changes' }) {
  return (
    <button className="sp-save-btn" disabled={loading || disabled}>
      {loading ? <span className="sp-spinner" /> : <Ic d={I.save} size={15} />}
      {loading ? 'Saving…' : label}
    </button>
  );
}

/* ── save helper ────────────────────────────────────────────────────────── */
async function saveFields(payload, setUser, setLoading, showToast, msg = 'Saved!') {
  setLoading(true);
  try {
    const { data } = await api.put('/users/profile', payload);
    setUser(data.user);
    showToast(msg);
  } catch (e) {
    showToast(e?.response?.data?.message || 'Failed to save.', 'error');
  } finally { setLoading(false); }
}

/* ════════════════════════ SECTION COMPONENTS ═══════════════════════════ */

/* ── 1. Identity ─────────────────────────────────────────────────────── */
function IdentitySection({ user, setUser, showToast }) {
  const [form, setForm] = useState({
    name:              user?.name || '',
    username:          user?.username || '',
    bio:               user?.bio || '',
    dateOfBirth:       user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
    gender:            user?.gender || '',
    age:               user?.age || '',
    location:          user?.location || 'Kathmandu',
    occupation:        user?.occupation || '',
    collegeUniversity: user?.collegeUniversity || '',
    phoneNumber:       user?.phoneNumber || '',
  });
  const [loading, setLoading] = useState(false);
  const [changed, setChanged] = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setChanged(true); };

  const handleSave = () => saveFields({
    name:              form.name,
    username:          form.username || undefined,
    bio:               form.bio || undefined,
    dateOfBirth:       form.dateOfBirth || undefined,
    gender:            form.gender || undefined,
    age:               form.age ? Number(form.age) : undefined,
    location:          form.location || undefined,
    occupation:        form.occupation || undefined,
    collegeUniversity: form.collegeUniversity || undefined,
    phoneNumber:       form.phoneNumber || undefined,
  }, setUser, setLoading, showToast, 'Personal info saved!');

  return (
    <div className="sp-card">
      <SecHead icon={I.user} title="Personal Information" sub="Your basic identity and contact details" />
      <div className="sp-grid-2">
        <Field label="Full Name" required>
          <input className="sp-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
        </Field>
        <Field label="Username">
          <div className="sp-input-prefix-wrap">
            <span className="sp-input-prefix">@</span>
            <input className="sp-input sp-input--prefix" value={form.username} onChange={e => set('username', e.target.value)} placeholder="yourhandle" />
          </div>
        </Field>
        <Field label="Email Address">
          <input className="sp-input sp-input--readonly" value={user?.email || ''} readOnly />
          <p className="sp-hint">Email cannot be changed</p>
        </Field>
        <Field label="Phone Number">
          <input className="sp-input" value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} placeholder="+977 98XXXXXXXX" />
        </Field>
        <Field label="Date of Birth">
          <input className="sp-input" type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} max={new Date().toISOString().slice(0,10)} />
        </Field>
        <Field label="Gender">
          <select className="sp-input sp-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
            <option value="">Select…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </Field>
        <Field label="Location / City">
          <input className="sp-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Kathmandu" />
        </Field>
        <Field label="Occupation">
          <input className="sp-input" value={form.occupation} onChange={e => set('occupation', e.target.value)} placeholder="e.g. Student, Software Engineer…" />
        </Field>
        <Field label="College / University" fullWidth>
          <input className="sp-input" value={form.collegeUniversity} onChange={e => set('collegeUniversity', e.target.value)} placeholder="e.g. Softwarica College of IT" />
        </Field>
        <Field label="Bio" fullWidth>
          <textarea className="sp-input sp-textarea" rows={3} maxLength={300}
            value={form.bio} onChange={e => set('bio', e.target.value)}
            placeholder="A short introduction about your style…" />
          <p className="sp-hint">{form.bio.length}/300 characters</p>
        </Field>
      </div>
      <div className="sp-card-footer">
        {changed && <span className="sp-unsaved">Unsaved changes</span>}
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} disabled={!changed} />
        </form>
      </div>
    </div>
  );
}

/* ── 2. Physical ─────────────────────────────────────────────────────── */
const BODY_TYPES  = ['hourglass','pear','apple','rectangle','inverted_triangle'];
const SKIN_TONES  = ['Fair','Light','Medium','Olive','Brown','Dark'];
const HAIR_COLORS = ['black','brown','blonde','red','gray','white','auburn','other'];
const HAIR_LENS   = ['short','medium','long','very_long'];
const EYE_COLORS  = ['black','brown','hazel','green','blue','gray','other'];
const SIZES       = ['XS','S','M','L','XL','XXL','XXXL'];

function PhysicalSection({ user, setUser, showToast }) {
  const [form, setForm] = useState({
    height:      user?.height || '',
    weight:      user?.weight || '',
    bodyType:    user?.bodyType || '',
    skinTone:    user?.skinTone || '',
    hairColor:   user?.hairColor || '',
    hairLength:  user?.hairLength || '',
    eyeColor:    user?.eyeColor || '',
    clothingSize:user?.clothingSize || '',
    shoeSize:    user?.shoeSize || '',
  });
  const [loading, setLoading] = useState(false);
  const [changed, setChanged] = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setChanged(true); };

  const handleSave = () => saveFields({
    height:      form.height ? Number(form.height) : undefined,
    weight:      form.weight ? Number(form.weight) : undefined,
    bodyType:    form.bodyType    || undefined,
    skinTone:    form.skinTone    || undefined,
    hairColor:   form.hairColor   || undefined,
    hairLength:  form.hairLength  || undefined,
    eyeColor:    form.eyeColor    || undefined,
    clothingSize:form.clothingSize || undefined,
    shoeSize:    form.shoeSize    || undefined,
  }, setUser, setLoading, showToast, 'Physical profile saved!');

  return (
    <div className="sp-card">
      <SecHead icon={I.body} title="Physical Profile" sub="Your body measurements and physical attributes for better fit recommendations" color="#7C3AED" />
      <div className="sp-grid-2">
        <Field label="Height (cm)">
          <input className="sp-input" type="number" min="120" max="220" value={form.height}
            onChange={e => set('height', e.target.value)} placeholder="e.g. 163" />
        </Field>
        <Field label="Weight (kg)">
          <input className="sp-input" type="number" min="30" max="200" value={form.weight}
            onChange={e => set('weight', e.target.value)} placeholder="e.g. 55" />
        </Field>
        <Field label="Clothing Size">
          <div className="sp-size-row">
            {SIZES.map(s => (
              <button key={s} type="button"
                className={`sp-size-btn ${form.clothingSize === s ? 'sp-size-btn--on' : ''}`}
                onClick={() => set('clothingSize', s)}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="Shoe Size">
          <input className="sp-input" value={form.shoeSize} onChange={e => set('shoeSize', e.target.value)} placeholder="e.g. 38 EU / 6 UK" />
        </Field>
      </div>

      <div className="sp-sub-section">
        <p className="sp-sub-label">Body Type</p>
        <div className="sp-chip-wrap">
          {BODY_TYPES.map(b => (
            <button key={b} type="button"
              className={`sp-chip ${form.bodyType === b ? 'sp-chip--on' : ''}`}
              onClick={() => set('bodyType', form.bodyType === b ? '' : b)}>
              {b.replace('_', ' ')}
              {form.bodyType === b && <span className="sp-chip-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-sub-section">
        <p className="sp-sub-label">Skin Tone</p>
        <div className="sp-skin-row">
          {SKIN_TONES.map(t => (
            <button key={t} type="button"
              className={`sp-skin-btn ${form.skinTone === t ? 'sp-skin-btn--on' : ''}`}
              data-tone={t.toLowerCase()}
              onClick={() => set('skinTone', form.skinTone === t ? '' : t)}>
              <span className="sp-skin-dot" />
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sp-three-col">
        <div className="sp-sub-section">
          <p className="sp-sub-label">Hair Color</p>
          <div className="sp-chip-wrap">
            {HAIR_COLORS.map(h => (
              <button key={h} type="button"
                className={`sp-chip ${form.hairColor === h ? 'sp-chip--on' : ''}`}
                onClick={() => set('hairColor', form.hairColor === h ? '' : h)}>
                {h.charAt(0).toUpperCase() + h.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="sp-sub-section">
          <p className="sp-sub-label">Hair Length</p>
          <div className="sp-chip-wrap">
            {HAIR_LENS.map(h => (
              <button key={h} type="button"
                className={`sp-chip ${form.hairLength === h ? 'sp-chip--on' : ''}`}
                onClick={() => set('hairLength', form.hairLength === h ? '' : h)}>
                {h.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="sp-sub-section">
          <p className="sp-sub-label">Eye Color</p>
          <div className="sp-chip-wrap">
            {EYE_COLORS.map(e => (
              <button key={e} type="button"
                className={`sp-chip ${form.eyeColor === e ? 'sp-chip--on' : ''}`}
                onClick={() => set('eyeColor', form.eyeColor === e ? '' : e)}>
                {e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sp-card-footer">
        {changed && <span className="sp-unsaved">Unsaved changes</span>}
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} disabled={!changed} />
        </form>
      </div>
    </div>
  );
}

/* ── 3. Personality ──────────────────────────────────────────────────── */
const FASHION_STYLES = [
  { id: 'minimalist',   label: 'Minimalist',    emoji: '🤍' },
  { id: 'streetwear',   label: 'Streetwear',    emoji: '🔥' },
  { id: 'smart_casual', label: 'Smart Casual',  emoji: '👔' },
  { id: 'korean',       label: 'Korean',        emoji: '🌸' },
  { id: 'vintage',      label: 'Vintage',       emoji: '🪞' },
  { id: 'preppy',       label: 'Preppy',        emoji: '🎀' },
  { id: 'athleisure',   label: 'Athleisure',    emoji: '🏃' },
  { id: 'romantic',     label: 'Romantic',      emoji: '🌹' },
  { id: 'edgy',         label: 'Edgy',          emoji: '⚡' },
  { id: 'boho',         label: 'Boho',          emoji: '🌿' },
  { id: 'classic',      label: 'Classic',       emoji: '💎' },
  { id: 'grunge',       label: 'Grunge',        emoji: '🎸' },
  { id: 'cottagecore',  label: 'Cottagecore',   emoji: '🌼' },
  { id: 'y2k',          label: 'Y2K',           emoji: '✨' },
  { id: 'modest_chic',  label: 'Modest Chic',   emoji: '🧕' },
];
const STYLE_PREFS   = ['casual','formal','traditional','western','fusion','sporty','bohemian','minimalist'];
const FIT_OPTIONS   = ['fitted','regular','relaxed','oversized','mix'];
const MODESTY_OPT   = ['conservative','moderate','open'];

function PersonalitySection({ user, setUser, showToast }) {
  const [fashionStyles, setFashionStyles] = useState(user?.fashionStyles || []);
  const [stylePrefs,    setStylePrefs]    = useState(user?.stylePreferences || []);
  const [clothingFit,   setClothingFit]   = useState(user?.clothingFit || '');
  const [modestyLevel,  setModestyLevel]  = useState(user?.modestyLevel || '');
  const [loading, setLoading] = useState(false);

  const handleSave = () => saveFields({
    fashionStyles,
    stylePreferences: stylePrefs,
    clothingFit:   clothingFit  || undefined,
    modestyLevel:  modestyLevel || undefined,
  }, setUser, setLoading, showToast, 'Fashion personality saved!');

  return (
    <div className="sp-card">
      <SecHead icon={I.sparkle} title="Fashion Personality" sub="Pick the styles that define your fashion identity" color="#7C3AED" />

      <div className="sp-sub-section">
        <p className="sp-sub-label">My Style Vibes <span className="sp-count">({fashionStyles.length} selected)</span></p>
        <p className="sp-field-hint">Choose all that resonate with your fashion identity</p>
        <ChipSelect options={FASHION_STYLES} value={fashionStyles} onChange={setFashionStyles} />
      </div>

      <div className="sp-sub-section">
        <p className="sp-sub-label">General Style Preferences</p>
        <ChipSelect options={STYLE_PREFS} value={stylePrefs} onChange={setStylePrefs} />
      </div>

      <div className="sp-two-col">
        <div className="sp-sub-section">
          <p className="sp-sub-label">Preferred Clothing Fit</p>
          <div className="sp-chip-wrap">
            {FIT_OPTIONS.map(f => (
              <button key={f} type="button"
                className={`sp-chip ${clothingFit === f ? 'sp-chip--on' : ''}`}
                onClick={() => setClothingFit(clothingFit === f ? '' : f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="sp-sub-section">
          <p className="sp-sub-label">Modesty Preference</p>
          <div className="sp-chip-wrap">
            {MODESTY_OPT.map(m => (
              <button key={m} type="button"
                className={`sp-chip ${modestyLevel === m ? 'sp-chip--on' : ''}`}
                onClick={() => setModestyLevel(modestyLevel === m ? '' : m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sp-card-footer">
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} />
        </form>
      </div>
    </div>
  );
}

/* ── 4. Colors ───────────────────────────────────────────────────────── */
function ColorsSection({ user, setUser, showToast }) {
  const [liked,    setLiked]    = useState(() => migrateColors(user?.colorPreferences || []));
  const [disliked, setDisliked] = useState(() => migrateColors(user?.dislikedColors   || []));
  const [loading,  setLoading]  = useState(false);

  const handleSave = () => saveFields({
    colorPreferences: liked,
    dislikedColors:   disliked,
  }, setUser, setLoading, showToast, 'Color preferences saved!');

  return (
    <div className="sp-card">
      <SecHead
        icon={I.palette}
        title="Colors & Palette"
        sub="Define your signature colour story — the AI uses these to tailor every outfit recommendation"
        color="#EC4899"
      />

      <div className="sp-colors-grid">
        <ColorPreferencePicker
          label="Colours I Love"
          mode="love"
          value={liked}
          disallowed={disliked}
          onChange={v => setLiked(v)}
        />

        <ColorPreferencePicker
          label="Colours to Avoid"
          mode="avoid"
          value={disliked}
          disallowed={liked}
          onChange={v => setDisliked(v)}
        />
      </div>

      <div className="sp-card-footer">
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} />
        </form>
      </div>
    </div>
  );
}

/* ── 5. Wardrobe Preferences ─────────────────────────────────────────── */
const FABRICS = [
  { id: 'cotton',    label: 'Cotton',    emoji: '🌿' },
  { id: 'denim',     label: 'Denim',     emoji: '👖' },
  { id: 'silk',      label: 'Silk',      emoji: '✨' },
  { id: 'linen',     label: 'Linen',     emoji: '🌾' },
  { id: 'wool',      label: 'Wool',      emoji: '🧶' },
  { id: 'leather',   label: 'Leather',   emoji: '🖤' },
  { id: 'polyester', label: 'Polyester', emoji: '⚡' },
  { id: 'velvet',    label: 'Velvet',    emoji: '💜' },
  { id: 'chiffon',   label: 'Chiffon',   emoji: '🌸' },
  { id: 'georgette', label: 'Georgette', emoji: '🌺' },
  { id: 'rayon',     label: 'Rayon',     emoji: '💧' },
  { id: 'satin',     label: 'Satin',     emoji: '💎' },
  { id: 'jersey',    label: 'Jersey',    emoji: '👕' },
];
const OUTFIT_TYPES = [
  { id: 'jeans',      label: 'Jeans',      emoji: '👖' },
  { id: 'skirts',     label: 'Skirts',     emoji: '👗' },
  { id: 'dresses',    label: 'Dresses',    emoji: '👗' },
  { id: 'crop_tops',  label: 'Crop Tops',  emoji: '👚' },
  { id: 'shirts',     label: 'Shirts',     emoji: '👔' },
  { id: 't_shirts',   label: 'T-Shirts',   emoji: '👕' },
  { id: 'hoodies',    label: 'Hoodies',    emoji: '🧥' },
  { id: 'sweaters',   label: 'Sweaters',   emoji: '🧣' },
  { id: 'kurti',      label: 'Kurti',      emoji: '🪷' },
  { id: 'saree',      label: 'Saree',      emoji: '🥻' },
  { id: 'lehenga',    label: 'Lehenga',    emoji: '💃' },
  { id: 'jumpsuit',   label: 'Jumpsuit',   emoji: '🕴️' },
  { id: 'coord_set',  label: 'Coord Set',  emoji: '✨' },
  { id: 'oversized',  label: 'Oversized',  emoji: '🔲' },
  { id: 'ethnic',     label: 'Ethnic',     emoji: '🪔' },
  { id: 'western',    label: 'Western',    emoji: '🌟' },
];
const FOOTWEAR  = ['heels','flats','sneakers','boots','sandals','loafers','wedges','ethnic_footwear','slippers'];
const ACCESSORY = ['minimal','statement','traditional','layered','none'];

function WardrobeSection({ user, setUser, showToast }) {
  const [fabrics,      setFabrics]      = useState(user?.fabricPreferences     || []);
  const [outfitTypes,  setOutfitTypes]  = useState(user?.favoriteOutfitTypes   || []);
  const [footwear,     setFootwear]     = useState(user?.footwearPreferences   || []);
  const [accessory,    setAccessory]    = useState(user?.accessoryStyle || '');
  const [loading, setLoading] = useState(false);

  const handleSave = () => saveFields({
    fabricPreferences:    fabrics,
    favoriteOutfitTypes:  outfitTypes,
    footwearPreferences:  footwear,
    accessoryStyle:       accessory || undefined,
  }, setUser, setLoading, showToast, 'Wardrobe preferences saved!');

  return (
    <div className="sp-card">
      <SecHead icon={I.hanger} title="Wardrobe Preferences" sub="Tell the AI what you love to wear for spot-on recommendations" color="#D97706" />

      <div className="sp-sub-section">
        <p className="sp-sub-label">Favourite Fabrics <span className="sp-count">({fabrics.length})</span></p>
        <ChipSelect options={FABRICS} value={fabrics} onChange={setFabrics} />
      </div>

      <div className="sp-sub-section">
        <p className="sp-sub-label">Favourite Outfit Types <span className="sp-count">({outfitTypes.length})</span></p>
        <ChipSelect options={OUTFIT_TYPES} value={outfitTypes} onChange={setOutfitTypes} />
      </div>

      <div className="sp-two-col">
        <div className="sp-sub-section">
          <p className="sp-sub-label">Footwear Preferences</p>
          <ChipSelect options={FOOTWEAR} value={footwear} onChange={setFootwear} />
        </div>
        <div className="sp-sub-section">
          <p className="sp-sub-label">Accessory Style</p>
          <div className="sp-chip-wrap">
            {ACCESSORY.map(a => (
              <button key={a} type="button"
                className={`sp-chip ${accessory === a ? 'sp-chip--on' : ''}`}
                onClick={() => setAccessory(accessory === a ? '' : a)}>
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sp-card-footer">
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} />
        </form>
      </div>
    </div>
  );
}

/* ── 6. Lifestyle ────────────────────────────────────────────────────── */
const LIFESTYLE_OPTS = [
  { id: 'student',              label: 'Student',              emoji: '🎓' },
  { id: 'working_professional', label: 'Working Professional', emoji: '💼' },
  { id: 'homemaker',            label: 'Homemaker',            emoji: '🏡' },
  { id: 'entrepreneur',         label: 'Entrepreneur',         emoji: '🚀' },
  { id: 'mixed',                label: 'Mixed',                emoji: '🌀' },
];
const OCCASION_OPTS = [
  { id: 'daily',         label: 'Daily',         emoji: '☀️' },
  { id: 'college',       label: 'College',       emoji: '🎓' },
  { id: 'office',        label: 'Office',        emoji: '💼' },
  { id: 'festival',      label: 'Festival',      emoji: '🪔' },
  { id: 'wedding',       label: 'Wedding',       emoji: '💒' },
  { id: 'party',         label: 'Party',         emoji: '🎉' },
  { id: 'casual_outing', label: 'Casual Outing', emoji: '🌳' },
  { id: 'religious',     label: 'Religious',     emoji: '🛕' },
];

function LifestyleSection({ user, setUser, showToast }) {
  const [lifestyle,      setLifestyle]      = useState(user?.lifestyle || '');
  const [occasions,      setOccasions]      = useState(user?.occasionPreferences || []);
  const [comfort,        setComfort]        = useState(user?.comfortPriority   || 3);
  const [confidence,     setConfidence]     = useState(user?.fashionConfidence || 3);
  const [adventurousness,setAdventurousness]= useState(user?.fashionAdventurousness || 5);
  const [trendFollowing, setTrendFollowing] = useState(user?.trendFollowing || 5);
  const [loading, setLoading] = useState(false);

  const handleSave = () => saveFields({
    lifestyle:              lifestyle || undefined,
    occasionPreferences:    occasions,
    comfortPriority:        comfort,
    fashionConfidence:      confidence,
    fashionAdventurousness: adventurousness,
    trendFollowing,
  }, setUser, setLoading, showToast, 'Lifestyle saved!');

  return (
    <div className="sp-card">
      <SecHead icon={I.lifestyle} title="Lifestyle & Occasions" sub="Help the AI understand your daily life and confidence levels" color="#059669" />

      <div className="sp-sub-section">
        <p className="sp-sub-label">My Lifestyle</p>
        <div className="sp-chip-wrap">
          {LIFESTYLE_OPTS.map(l => (
            <button key={l.id} type="button"
              className={`sp-chip ${lifestyle === l.id ? 'sp-chip--on' : ''}`}
              onClick={() => setLifestyle(lifestyle === l.id ? '' : l.id)}>
              <span>{l.emoji}</span> {l.label}
              {lifestyle === l.id && <span className="sp-chip-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-sub-section">
        <p className="sp-sub-label">Occasions I Dress For <span className="sp-count">({occasions.length})</span></p>
        <ChipSelect options={OCCASION_OPTS} value={occasions} onChange={setOccasions} />
      </div>

      <div className="sp-sliders-grid">
        <RangeSlider label="Comfort Priority" value={comfort} onChange={setComfort}
          min={1} max={5} lowLabel="Style first" highLabel="Comfort always" color="#0D9488" />
        <RangeSlider label="Fashion Confidence" value={confidence} onChange={setConfidence}
          min={1} max={5} lowLabel="Still learning" highLabel="Total trendsetter" color="#7C3AED" />
        <RangeSlider label="Fashion Adventurousness" value={adventurousness} onChange={setAdventurousness}
          min={1} max={10} lowLabel="Play it safe" highLabel="Bold experimenter" color="#F97316" />
        <RangeSlider label="Trend Following" value={trendFollowing} onChange={setTrendFollowing}
          min={1} max={10} lowLabel="Own path" highLabel="Always on trend" color="#EC4899" />
      </div>

      <div className="sp-card-footer">
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} />
        </form>
      </div>
    </div>
  );
}

/* ── 7. Shopping ─────────────────────────────────────────────────────── */
const SHOP_FREQ  = ['weekly','monthly','quarterly','seasonal','rarely'];
const SHOP_LOC   = ['online','offline','both'];
const LUXURY_VS  = [
  { id: 'budget',    label: 'Budget',     emoji: '💚' },
  { id: 'mid_range', label: 'Mid-Range',  emoji: '💛' },
  { id: 'mix',       label: 'Mix',        emoji: '🎯' },
  { id: 'luxury',    label: 'Luxury',     emoji: '💎' },
];

function ShoppingSection({ user, setUser, showToast }) {
  const [freq,     setFreq]     = useState(user?.shoppingFrequency         || '');
  const [location, setLocation] = useState(user?.preferredShoppingLocation || '');
  const [lvb,      setLvb]      = useState(user?.luxuryVsBudget            || '');
  const [brands,   setBrands]   = useState((user?.preferredBrands || []).join(', '));
  const [budget,   setBudget]   = useState({ min: user?.budgetRange?.min || 0, max: user?.budgetRange?.max || 10000 });
  const [loading, setLoading]   = useState(false);

  const handleSave = () => saveFields({
    shoppingFrequency:         freq     || undefined,
    preferredShoppingLocation: location || undefined,
    luxuryVsBudget:            lvb      || undefined,
    preferredBrands:           brands.split(',').map(s => s.trim()).filter(Boolean),
    budgetRange:               budget,
  }, setUser, setLoading, showToast, 'Shopping preferences saved!');

  return (
    <div className="sp-card">
      <SecHead icon={I.shopping} title="Shopping Habits" sub="Your budget, frequency and brand preferences" color="#0891B2" />

      <div className="sp-sub-section">
        <p className="sp-sub-label">How Often Do You Shop?</p>
        <div className="sp-chip-wrap">
          {SHOP_FREQ.map(f => (
            <button key={f} type="button"
              className={`sp-chip ${freq === f ? 'sp-chip--on' : ''}`}
              onClick={() => setFreq(freq === f ? '' : f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-two-col">
        <div className="sp-sub-section">
          <p className="sp-sub-label">Where Do You Shop?</p>
          <div className="sp-chip-wrap">
            {SHOP_LOC.map(l => (
              <button key={l} type="button"
                className={`sp-chip ${location === l ? 'sp-chip--on' : ''}`}
                onClick={() => setLocation(location === l ? '' : l)}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="sp-sub-section">
          <p className="sp-sub-label">Budget Preference</p>
          <div className="sp-chip-wrap">
            {LUXURY_VS.map(l => (
              <button key={l.id} type="button"
                className={`sp-chip ${lvb === l.id ? 'sp-chip--on' : ''}`}
                onClick={() => setLvb(lvb === l.id ? '' : l.id)}>
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sp-sub-section">
        <p className="sp-sub-label">Budget Range (NPR)</p>
        <div className="sp-budget-row">
          <div className="sp-budget-field">
            <label className="sp-hint">Min</label>
            <input className="sp-input sp-input--sm" type="number" min="0" value={budget.min}
              onChange={e => setBudget(b => ({ ...b, min: Number(e.target.value) }))} />
          </div>
          <span className="sp-budget-dash">—</span>
          <div className="sp-budget-field">
            <label className="sp-hint">Max</label>
            <input className="sp-input sp-input--sm" type="number" min="0" value={budget.max}
              onChange={e => setBudget(b => ({ ...b, max: Number(e.target.value) }))} />
          </div>
          <span className="sp-budget-chip">NPR {budget.min.toLocaleString()} – {budget.max.toLocaleString()}</span>
        </div>
      </div>

      <Field label="Favourite Brands (comma-separated)" fullWidth>
        <input className="sp-input" value={brands} onChange={e => setBrands(e.target.value)}
          placeholder="e.g. Zara, H&M, Local Brands, Benetton…" />
      </Field>

      <div className="sp-card-footer">
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} />
        </form>
      </div>
    </div>
  );
}

/* ── 8. Inspiration ──────────────────────────────────────────────────── */
const INSP_SOURCES = [
  { id: 'instagram',        label: 'Instagram',         emoji: '📸' },
  { id: 'pinterest',        label: 'Pinterest',         emoji: '📌' },
  { id: 'tiktok',           label: 'TikTok',            emoji: '🎵' },
  { id: 'celebrities',      label: 'Celebrities',       emoji: '⭐' },
  { id: 'fashion_bloggers', label: 'Fashion Bloggers',  emoji: '✍️' },
  { id: 'local_influencers',label: 'Local Influencers', emoji: '🇳🇵' },
  { id: 'runway',           label: 'Runway / Fashion Week', emoji: '👑' },
  { id: 'friends',          label: 'Friends & Family',  emoji: '👥' },
  { id: 'magazines',        label: 'Magazines',         emoji: '📖' },
];

function InspirationSection({ user, setUser, showToast }) {
  const [inspiration,  setInspiration]  = useState(user?.fashionInspiration  || []);
  const [celebrities,  setCelebrities]  = useState((user?.favoriteCelebrities || []).join(', '));
  const [notes,        setNotes]        = useState(user?.additionalStyleNotes  || '');
  const [loading, setLoading] = useState(false);

  const handleSave = () => saveFields({
    fashionInspiration:  inspiration,
    favoriteCelebrities: celebrities.split(',').map(s => s.trim()).filter(Boolean),
    additionalStyleNotes:notes || undefined,
  }, setUser, setLoading, showToast, 'Inspiration saved!');

  return (
    <div className="sp-card">
      <SecHead icon={I.star} title="Style Inspiration" sub="Where you find your fashion ideas and who inspires your looks" color="#D97706" />

      <div className="sp-sub-section">
        <p className="sp-sub-label">Where I Find Inspiration <span className="sp-count">({inspiration.length})</span></p>
        <ChipSelect options={INSP_SOURCES} value={inspiration} onChange={setInspiration} />
      </div>

      <Field label="Favourite Celebrities / Influencers" fullWidth>
        <input className="sp-input" value={celebrities} onChange={e => setCelebrities(e.target.value)}
          placeholder="e.g. Deepika Padukone, Kendall Jenner, Priyanka Karki…" />
        <p className="sp-hint">Comma-separated</p>
      </Field>

      <Field label="Additional Style Notes" fullWidth>
        <textarea className="sp-input sp-textarea" rows={4} maxLength={500}
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Any extra details about your style… what you're looking for, occasions coming up, things you want to avoid…" />
        <p className="sp-hint">{notes.length}/500 characters</p>
      </Field>

      <div className="sp-card-footer">
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <SaveBtn loading={loading} />
        </form>
      </div>
    </div>
  );
}

/* ── 9. AI Summary ───────────────────────────────────────────────────── */
function SummarySection({ user, setUser, showToast, summary, score }) {
  const [saving, setSaving] = useState(false);

  const saveSummary = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/users/profile', { aiSummary: summary });
      setUser(data.user);
      showToast('AI summary saved to your profile!');
    } catch { showToast('Could not save summary.', 'error'); }
    finally { setSaving(false); }
  };

  const scoreColor = score >= 80 ? '#0D9488' : score >= 50 ? '#D97706' : '#EF4444';

  const MISSING = [
    { key: 'bio', label: 'Bio' },
    { key: 'dateOfBirth', label: 'Date of birth' },
    { key: 'height', label: 'Height' },
    { key: 'hairColor', label: 'Hair color' },
    { key: 'lifestyle', label: 'Lifestyle' },
    { key: 'fashionStyles', label: 'Fashion personality', isArr: true },
    { key: 'fabricPreferences', label: 'Fabric preferences', isArr: true },
    { key: 'fashionInspiration', label: 'Style inspiration', isArr: true },
  ].filter(f => f.isArr ? !(user?.[f.key]?.length > 0) : !user?.[f.key]);

  return (
    <div className="sp-card">
      <SecHead icon={I.sparkle} title="AI Style Summary" sub="Your auto-generated style profile summary" color="#7C3AED" />

      <div className="sp-summary-score-row">
        <div className="sp-summary-score-bar">
          <div className="sp-summary-bar-track">
            <div className="sp-summary-bar-fill" style={{ width: `${score}%`, background: scoreColor }} />
          </div>
          <div className="sp-summary-score-nums">
            <span style={{ color: scoreColor, fontWeight: 700 }}>{score}% complete</span>
            <span className="sp-hint">{MISSING.length === 0 ? 'Profile fully complete!' : `${MISSING.length} field${MISSING.length === 1 ? '' : 's'} remaining`}</span>
          </div>
        </div>
      </div>

      {MISSING.length > 0 && (
        <div className="sp-missing-list">
          <p className="sp-sub-label">To improve your score, complete:</p>
          <div className="sp-missing-chips">
            {MISSING.map(m => (
              <span key={m.key} className="sp-missing-chip">+ {m.label}</span>
            ))}
          </div>
        </div>
      )}

      <div className="sp-divider" />

      <div className="sp-ai-summary-box">
        <div className="sp-ai-summary-header">
          <div className="sp-ai-icon"><Ic d={I.sparkle} size={18} /></div>
          <span>AI-Generated Style Profile</span>
        </div>
        <p className="sp-ai-summary-text">{summary || 'Complete more of your profile to generate your AI style summary.'}</p>
      </div>

      {user?.aiSummary && (
        <div className="sp-saved-summary">
          <p className="sp-sub-label">Previously Saved Summary</p>
          <p className="sp-saved-summary-text">{user.aiSummary}</p>
        </div>
      )}

      <div className="sp-card-footer">
        <button className="sp-save-btn" onClick={saveSummary} disabled={saving || !summary}>
          {saving ? <span className="sp-spinner" /> : <Ic d={I.save} size={15} />}
          {saving ? 'Saving…' : 'Save This Summary'}
        </button>
      </div>
    </div>
  );
}

/* ── Field wrapper ────────────────────────────────────────────────────── */
function Field({ label, children, fullWidth, required }) {
  return (
    <div className={`sp-field ${fullWidth ? 'sp-field--full' : ''}`}>
      <label className="sp-field-label">
        {label}{required && <span className="sp-required"> *</span>}
      </label>
      {children}
    </div>
  );
}
