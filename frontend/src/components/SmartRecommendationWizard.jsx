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
  sparkle: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
  close:   'M18 6L6 18M6 6l12 12',
};

// ── Field config ─────────────────────────────────────────────────────────────
// The backend's canonical occasion vocabulary is just 5 broad groups
// (sports/daily/party/office/traditional — backend/constants/occasions.js),
// load-bearing for the compatibility engine's footwear/accessory rules. This
// question offers 11 friendlier, natural-language options that map onto
// those same 5 groups — the same collapsing already used by
// backend/scripts/migrateWardrobeCategoriesAndOccasions.js — rather than
// re-expanding what the backend understands.
const OCCASION_QUESTIONS = [
  { value: 'daily',       label: 'Daily',       emoji: '👟' },
  { value: 'daily',       label: 'College',     emoji: '🎒' },
  { value: 'office',      label: 'Office',      emoji: '💼' },
  { value: 'party',       label: 'Party',       emoji: '🎉' },
  { value: 'traditional', label: 'Traditional', emoji: '🥻' },
  { value: 'traditional', label: 'Wedding',     emoji: '💐' },
  { value: 'traditional', label: 'Festival',    emoji: '🪔' },
  { value: 'party',       label: 'Date',        emoji: '💕' },
  { value: 'daily',       label: 'Travel',      emoji: '✈️' },
  { value: 'sports',      label: 'Gym',         emoji: '💪' },
  { value: 'daily',       label: 'Other',       emoji: '✨' },
];

const STYLE_QUESTIONS = [
  'Casual', 'Formal', 'Traditional', 'Elegant',
  'Minimalist', 'Street Style', 'Smart Casual', 'No Preference',
];

const STEPS = ['occasion', 'style', 'notes'];
const STEP_LABEL = { occasion: 'Step 1 of 3', style: 'Step 2 of 3', notes: 'Step 3 of 3' };

const INIT = {
  occasionLabel: '',
  occasion:      '',
  style:         '',
  extraNotes:    '',
};

// ── Main component ────────────────────────────────────────────────────────────
// A focused 3-question modal: occasion → style → optional notes. Triggered
// from a single button on the Dashboard rather than living inline — the goal
// is a recommendation in well under a minute, not a form to fill out.
export default function SmartRecommendationWizard({ onClose, onSessionReady }) {
  const [step,    setStep]    = useState('occasion');
  const [form,    setForm]    = useState(INIT);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const stepIndex = STEPS.indexOf(step);
  const goNext = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);
  const goBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)]);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/recommendations/wizard', {
        occasion:   form.occasion,
        style:      form.style === 'No Preference' ? '' : form.style,
        extraNotes: form.extraNotes,
      });
      onSessionReady?.(data.session);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [form, onSessionReady, onClose]);

  return (
    <>
      <div className="wiz-overlay" onClick={onClose} />
      <div className="wiz-modal" role="dialog" aria-modal="true" aria-label="Generate Personalized Recommendation">

        <div className="wiz-chead">
          <div className="wiz-chead-left">
            <div className="wiz-chead-title">
              <Ic d={I.sparkle} size={17} />
              Generate Personalized Recommendation
            </div>
            <p className="wiz-chead-sub">{STEP_LABEL[step]}</p>
          </div>
          <button type="button" className="wiz-close" onClick={onClose} disabled={loading} aria-label="Close">
            <Ic d={I.close} size={16} />
          </button>
        </div>

        <div className="wiz-body">
          {step === 'occasion' && (
            <div className="wiz-step">
              <h3 className="wiz-question">What are you dressing for today?</h3>
              <div className="wiz-pills">
                {OCCASION_QUESTIONS.map(o => (
                  <button key={o.label} type="button"
                    className={`wiz-pill${form.occasionLabel === o.label ? ' wiz-pill--on' : ''}`}
                    onClick={() => { set('occasionLabel', o.label); set('occasion', o.value); }}>
                    <span>{o.emoji}</span>{o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'style' && (
            <div className="wiz-step">
              <h3 className="wiz-question">Which outfit style do you prefer today?</h3>
              <div className="wiz-pills">
                {STYLE_QUESTIONS.map(s => (
                  <button key={s} type="button"
                    className={`wiz-pill${form.style === s ? ' wiz-pill--on' : ''}`}
                    onClick={() => set('style', s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'notes' && (
            <div className="wiz-step">
              <h3 className="wiz-question">Anything else StyleAI should know? <span className="wiz-opt">(optional)</span></h3>
              <textarea className="wiz-textarea" rows={4} maxLength={300}
                placeholder="e.g. favourite colour, comfort level, anything specific for today…"
                value={form.extraNotes}
                onChange={e => set('extraNotes', e.target.value)} />
              <div className="wiz-char-count">{form.extraNotes.length}/300</div>
            </div>
          )}

          {error && <div className="wiz-error">{error}</div>}
        </div>

        <div className="wiz-footer">
          {stepIndex > 0
            ? <button type="button" className="wiz-btn wiz-btn--ghost" onClick={goBack} disabled={loading}>Back</button>
            : <button type="button" className="wiz-btn wiz-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>}

          {step === 'occasion' && (
            <button type="button" className="wiz-btn wiz-btn--primary" onClick={goNext} disabled={!form.occasion}>
              Next
            </button>
          )}
          {step === 'style' && (
            <button type="button" className="wiz-btn wiz-btn--primary" onClick={goNext} disabled={!form.style}>
              Next
            </button>
          )}
          {step === 'notes' && (
            <button type="button" className="wiz-btn wiz-btn--primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <><span className="wiz-spin" /> Generating…</> : <><Ic d={I.sparkle} size={14} /> Generate My Outfit</>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
