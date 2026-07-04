import React, { useState, useCallback } from 'react';
import api from '../services/api';
import './SmartRecommendationWizard.css';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)
      ? d.map((p, i) => <path key={i} d={p} />)
      : <path d={d} />}
  </svg>
);

const I = {
  x:       'M18 6L6 18M6 6l12 12',
  check:   'M20 6L9 17l-5-5',
  arrow_r: 'M5 12h14M12 5l7 7-7 7',
  arrow_l: 'M19 12H5M12 19l-7-7 7-7',
  sparkle: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
  wand:    ['M15 4V2','M15 16v-2','M8 9h2','M20 9h2','M17.8 11.8L19 13','M15 9h0','M17.8 6.2L19 5','M3 21l9-9','M12.2 6.2L11 5'],
};

// ── Step config ────────────────────────────────────────────────────────────────
const OCCASIONS = [
  { value: 'college',   label: 'College',          emoji: '🎓' },
  { value: 'office',    label: 'Office / Work',     emoji: '💼' },
  { value: 'date',      label: 'Date Night',        emoji: '💕' },
  { value: 'party',     label: 'Party',             emoji: '🎉' },
  { value: 'wedding',   label: 'Wedding / Formal',  emoji: '💐' },
  { value: 'festival',  label: 'Festival / Pooja',  emoji: '🪔' },
  { value: 'cafe',      label: 'Café / Brunch',     emoji: '☕' },
  { value: 'travel',    label: 'Travel',            emoji: '✈️' },
  { value: 'gym',       label: 'Gym / Sports',      emoji: '💪' },
  { value: 'trekking',  label: 'Trekking',          emoji: '🥾' },
  { value: 'daily',     label: 'Everyday Casual',   emoji: '👟' },
  { value: 'interview', label: 'Interview',         emoji: '🤝' },
];

const VIBES = [
  'Elegant',  'Bold',     'Minimal',  'Bohemian',
  'Street',   'Classic',  'Romantic', 'Power',
  'Playful',  'Edgy',     'Cozy',     'Sporty',
];

const STYLES = [
  'Modern Nepali', 'Western Fusion', 'Traditional',
  'Indo-Western',  'Minimalist',     'Maximalist',
  'Athleisure',    'Smart Casual',
];

const BUDGETS = [
  { value: 'budget',    label: 'Budget',     sub: 'Affordable picks' },
  { value: 'mid-range', label: 'Mid Range',  sub: 'Best value' },
  { value: 'premium',   label: 'Premium',    sub: 'Elevated quality' },
  { value: 'luxury',    label: 'Luxury',     sub: 'No limits' },
];

const COLORS = [
  'Black', 'White', 'Navy', 'Beige', 'Olive', 'Blush', 'Burgundy', 'Forest Green',
  'Mustard', 'Rust', 'Cobalt', 'Lavender', 'Coral', 'Terracotta', 'Cream',
];

const WIZARD_CATEGORIES = [
  { key: 'wizard_option_1', label: 'Classic Pick',   emoji: '⭐', desc: 'Timeless, effortlessly sophisticated' },
  { key: 'wizard_option_2', label: 'Modern Edge',    emoji: '✨', desc: 'Contemporary, trend-forward' },
  { key: 'wizard_option_3', label: 'Local Fusion',   emoji: '🌸', desc: 'Nepali aesthetic with modern flair' },
];

const SLOT_META = {
  top:            { label: 'Top',            emoji: '👕' },
  bottom:         { label: 'Bottom',         emoji: '👖' },
  dress:          { label: 'Dress',          emoji: '👗' },
  outerwear:      { label: 'Outerwear',      emoji: '🧥' },
  footwear:       { label: 'Footwear',       emoji: '👟' },
  accessory:      { label: 'Accessory',      emoji: '💍' },
  jewelry:        { label: 'Jewelry',        emoji: '💎' },
  bag:            { label: 'Bag',            emoji: '👜' },
  belt:           { label: 'Belt',           emoji: '🎀' },
  watch:          { label: 'Watch',          emoji: '⌚' },
  scarf:          { label: 'Scarf',          emoji: '🧣' },
  sunglasses:     { label: 'Sunglasses',     emoji: '🕶️' },
  hair_accessory: { label: 'Hair',           emoji: '📌' },
};

const CLOTHING_SLOTS  = ['top', 'bottom', 'dress', 'outerwear', 'footwear'];
const ACCESSORY_SLOTS = ['jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory', 'accessory'];

// ── Initial form state ────────────────────────────────────────────────────────
const INIT = {
  occasion:     '',
  vibe:         '',
  style:        '',
  budget:       'mid-range',
  indoorOutdoor:'both',
  dayNight:     'day',
  accessories:  true,
  colors:       [],
  dresscode:    '',
  extraNotes:   '',
};

// ── Pill selector ─────────────────────────────────────────────────────────────
function PillGroup({ options, value, onChange, multi = false }) {
  const selected = multi ? (Array.isArray(value) ? value : []) : value;
  const toggle = (v) => {
    if (!multi) { onChange(v); return; }
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else if (selected.length < 5) onChange([...selected, v]);
  };
  return (
    <div className="wiz-pills">
      {options.map(opt => {
        const v   = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        const em  = opt.emoji;
        const on  = multi ? selected.includes(v) : selected === v;
        return (
          <button key={v} type="button"
            className={`wiz-pill${on ? ' wiz-pill--on' : ''}`}
            onClick={() => toggle(v)}>
            {em && <span>{em}</span>}
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

// ── Outfit result card ────────────────────────────────────────────────────────
function WizardResultCard({ rec, catMeta }) {
  const [open, setOpen] = useState(false);
  const outfit   = rec?.outfit || {};
  const styling  = rec?.stylingNotes || {};
  const exp      = rec?.explanation || {};

  const clothingItems  = CLOTHING_SLOTS.map(s => outfit[s]).filter(Boolean).filter(d => d.name || d.suggestion);
  const accessoryItems = ACCESSORY_SLOTS.map(s => outfit[s]).filter(Boolean).filter(d => d.name || d.suggestion);

  return (
    <div className="wiz-result">
      <div className="wiz-result-head">
        <span className="wiz-result-emoji">{catMeta.emoji}</span>
        <div>
          <div className="wiz-result-label">{catMeta.label}</div>
          <div className="wiz-result-name">{rec?.outfitName}</div>
          <div className="wiz-result-desc">{catMeta.desc}</div>
        </div>
        {rec?.confidence && (
          <div className="wiz-result-conf">{rec.confidence}<span>%</span></div>
        )}
      </div>

      {exp.summary && (
        <div className="wiz-result-exp">
          <Ic d={I.sparkle} size={11} />
          <p>{exp.summary}</p>
        </div>
      )}

      <div className="wiz-result-clothes">
        {clothingItems.map((data, i) => {
          const slot = CLOTHING_SLOTS.find(s => outfit[s] === data) || CLOTHING_SLOTS[i];
          const meta = SLOT_META[slot] || { emoji: '✨', label: slot };
          return (
            <div key={slot} className={`wiz-slot${data.item ? ' wiz-slot--owned' : ''}`}>
              <span className="wiz-slot-emoji">{meta.emoji}</span>
              <div className="wiz-slot-body">
                <div className="wiz-slot-name">{data.name || data.suggestion}</div>
                {data.reason && <div className="wiz-slot-why">{data.reason}</div>}
              </div>
              {data.item && <span className="wiz-slot-badge">Owned</span>}
              {!data.item && <span className="wiz-slot-badge wiz-slot-badge--sug">Suggested</span>}
            </div>
          );
        })}
      </div>

      {accessoryItems.length > 0 && (
        <div className="wiz-result-acc">
          {accessoryItems.map((data, i) => {
            const slot = ACCESSORY_SLOTS.find(s => outfit[s] === data) || ACCESSORY_SLOTS[i];
            const meta = SLOT_META[slot] || { emoji: '✨' };
            return (
              <span key={slot} className="wiz-acc-chip">
                {meta.emoji} {data.name || data.suggestion}
              </span>
            );
          })}
        </div>
      )}

      <button className="wiz-toggle" onClick={() => setOpen(p => !p)}>
        {open ? 'Hide styling details ↑' : 'Styling, hair & makeup ↓'}
      </button>

      {open && (styling.colorCombination || styling.hairstyleSuggestion || styling.makeupNote || styling.layeringAdvice) && (
        <div className="wiz-styling">
          {styling.colorCombination    && <div className="wiz-srow"><span>🎨</span><div><b>Colors</b><p>{styling.colorCombination}</p></div></div>}
          {styling.hairstyleSuggestion && <div className="wiz-srow"><span>💆</span><div><b>Hair</b><p>{styling.hairstyleSuggestion}</p></div></div>}
          {styling.makeupNote          && <div className="wiz-srow"><span>💄</span><div><b>Makeup</b><p>{styling.makeupNote}</p></div></div>}
          {styling.layeringAdvice      && <div className="wiz-srow"><span>🧥</span><div><b>Layering</b><p>{styling.layeringAdvice}</p></div></div>}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SmartRecommendationWizard({ onClose, onSessionReady }) {
  const [step,    setStep]    = useState(0);
  const [form,    setForm]    = useState(INIT);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState(null); // wizard session

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/recommendations/wizard', {
        ...form,
        colors: form.colors.join(', '),
      });
      setResult(data.session);
      setStep(4); // results step
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const steps = [
    { title: 'Occasion & Vibe',     sub: 'What are you dressing for?' },
    { title: 'Style & Aesthetic',   sub: 'How do you want to look?' },
    { title: 'Preferences',         sub: 'Budget, setting & extras' },
    { title: 'Color & Final Notes', sub: 'Personal touches' },
  ];

  const canNext = [
    !!form.occasion,
    !!form.vibe,
    true,
    true,
  ];

  const isLastStep = step === 3;
  const isResult   = step === 4;

  return (
    <div className="wiz-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wiz-modal" role="dialog" aria-modal="true">

        {/* ── Modal header ──────────────────────────────────────────────── */}
        <div className="wiz-mhead">
          <div className="wiz-mhead-title">
            <Ic d={I.wand} size={18} />
            AI Style Wizard
          </div>
          <button className="wiz-close" onClick={onClose} aria-label="Close wizard">
            <Ic d={I.x} size={18} />
          </button>
        </div>

        {/* ── Progress bar ──────────────────────────────────────────────── */}
        {!isResult && (
          <div className="wiz-progress">
            {steps.map((s, i) => (
              <div key={i} className={`wiz-step${i < step ? ' done' : i === step ? ' active' : ''}`}>
                <div className="wiz-step-dot">{i < step ? <Ic d={I.check} size={10} /> : i + 1}</div>
                <span className="wiz-step-lbl">{s.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Step body ─────────────────────────────────────────────────── */}
        <div className="wiz-body">

          {/* Step 0 — Occasion & Vibe */}
          {step === 0 && (
            <div className="wiz-section">
              <div className="wiz-field">
                <label>What's the occasion? <span className="wiz-req">*</span></label>
                <PillGroup options={OCCASIONS} value={form.occasion} onChange={v => set('occasion', v)} />
              </div>
              <div className="wiz-field">
                <label>What's your vibe? <span className="wiz-req">*</span></label>
                <PillGroup options={VIBES} value={form.vibe} onChange={v => set('vibe', v)} />
              </div>
            </div>
          )}

          {/* Step 1 — Style */}
          {step === 1 && (
            <div className="wiz-section">
              <div className="wiz-field">
                <label>Aesthetic / Style</label>
                <PillGroup options={STYLES} value={form.style} onChange={v => set('style', v)} />
              </div>
              <div className="wiz-field">
                <label>Indoor or Outdoor?</label>
                <PillGroup
                  options={[
                    { value: 'indoor',  label: '🏠 Indoor' },
                    { value: 'outdoor', label: '🌳 Outdoor' },
                    { value: 'both',    label: '🔄 Both' },
                  ]}
                  value={form.indoorOutdoor}
                  onChange={v => set('indoorOutdoor', v)} />
              </div>
              <div className="wiz-field">
                <label>Day or Night?</label>
                <PillGroup
                  options={[
                    { value: 'day',   label: '☀️ Day' },
                    { value: 'night', label: '🌙 Night' },
                    { value: 'both',  label: '🔄 Both' },
                  ]}
                  value={form.dayNight}
                  onChange={v => set('dayNight', v)} />
              </div>
            </div>
          )}

          {/* Step 2 — Budget & Settings */}
          {step === 2 && (
            <div className="wiz-section">
              <div className="wiz-field">
                <label>Budget</label>
                <div className="wiz-budget-grid">
                  {BUDGETS.map(b => (
                    <button key={b.value} type="button"
                      className={`wiz-budget-card${form.budget === b.value ? ' active' : ''}`}
                      onClick={() => set('budget', b.value)}>
                      <div className="wiz-budget-label">{b.label}</div>
                      <div className="wiz-budget-sub">{b.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="wiz-field">
                <label>Include accessories & jewelry?</label>
                <PillGroup
                  options={[
                    { value: true,  label: '💎 Yes, everything' },
                    { value: false, label: '👕 Clothing only' },
                  ]}
                  value={form.accessories}
                  onChange={v => set('accessories', v)} />
              </div>
              <div className="wiz-field">
                <label>Dress code or theme <span className="wiz-opt">(optional)</span></label>
                <input className="wiz-input" type="text" placeholder="e.g. semi-formal, all-white, corporate…"
                  value={form.dresscode} onChange={e => set('dresscode', e.target.value)} maxLength={100} />
              </div>
            </div>
          )}

          {/* Step 3 — Colors & Notes */}
          {step === 3 && (
            <div className="wiz-section">
              <div className="wiz-field">
                <label>Preferred colors <span className="wiz-opt">(pick up to 5)</span></label>
                <PillGroup options={COLORS} value={form.colors} onChange={v => set('colors', v)} multi />
              </div>
              <div className="wiz-field">
                <label>Any extra notes for StyleAI? <span className="wiz-opt">(optional)</span></label>
                <textarea className="wiz-textarea" rows={3} maxLength={500}
                  placeholder="e.g. I want to look professional but not boring. I avoid synthetic fabrics. I'm attending an outdoor ceremony..."
                  value={form.extraNotes}
                  onChange={e => set('extraNotes', e.target.value)} />
                <div className="wiz-char-count">{form.extraNotes.length}/500</div>
              </div>
            </div>
          )}

          {/* Step 4 — Results */}
          {step === 4 && result && (
            <div className="wiz-results">
              <div className="wiz-results-head">
                <Ic d={I.sparkle} size={20} />
                <h3>Your 3 AI-Curated Outfits</h3>
                <p>For <strong>{form.occasion}</strong> · <strong>{form.vibe}</strong> vibe · <strong>{form.style || form.budget}</strong></p>
              </div>

              {WIZARD_CATEGORIES.map(cat => {
                const rec = result.recommendations?.find(r => r.category === cat.key);
                return rec ? <WizardResultCard key={cat.key} rec={rec} catMeta={cat} /> : null;
              })}
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="wiz-loading">
              <div className="wiz-loading-inner">
                <div className="wiz-spinner" />
                <p>StyleAI is crafting your 3 outfits…</p>
                <p className="wiz-loading-sub">Analysing style parameters, wardrobe, weather &amp; trends</p>
              </div>
            </div>
          )}

          {error && <div className="wiz-error">{error}</div>}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="wiz-footer">
          {!isResult ? (
            <>
              <button className="wiz-btn wiz-btn--ghost"
                onClick={() => step === 0 ? onClose() : setStep(p => p - 1)}>
                <Ic d={I.arrow_l} size={14} />
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              <div className="wiz-footer-info">
                Step {step + 1} of {steps.length}
              </div>
              {isLastStep ? (
                <button className="wiz-btn wiz-btn--primary"
                  onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Generating…' : <><Ic d={I.sparkle} size={14} /> Generate 3 Outfits</>}
                </button>
              ) : (
                <button className="wiz-btn wiz-btn--primary"
                  onClick={() => setStep(p => p + 1)}
                  disabled={!canNext[step]}>
                  Next <Ic d={I.arrow_r} size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              <button className="wiz-btn wiz-btn--ghost" onClick={() => { setStep(0); setResult(null); setForm(INIT); }}>
                Start Over
              </button>
              <button className="wiz-btn wiz-btn--primary"
                onClick={() => onSessionReady(result)}>
                <Ic d={I.check} size={14} /> View in Full Panel
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
