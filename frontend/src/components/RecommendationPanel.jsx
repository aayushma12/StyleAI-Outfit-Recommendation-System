import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import api from '../services/api';
import { DislikeReasonModal } from './DislikeReasonModal';
import { XAIPanel } from './XAIPanel';
import { getMatchBadge } from '../utils/confidenceScale';
import './RecommendationPanel.css';
const SmartRecommendationWizard = lazy(() => import('./SmartRecommendationWizard'));

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  sparkle:   'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
  refresh:   'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  check:     'M20 6L9 17l-5-5',
  heart:     'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  x:         'M18 6L6 18M6 6l12 12',
  skip:      'M5 4l10 8-10 8V4zm11 0h2v16h-2z',
  sun:       'M12 17a5 5 0 100-10 5 5 0 000 10zm0-15v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  cloud:     'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  info:      'M12 16v-4m0-4h.01M22 12A10 10 0 1112 2a10 10 0 0110 10z',
  palette:   'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14.5v-9l7 4.5-7 4.5z',
  tag:       'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z',
  star:      'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  wardrobe:  'M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z',
  chev_down: 'M6 9l6 6 6-6',
  chev_up:   'M18 15l-6-6-6 6',
  wand:      'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h0M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5',
};

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
  hair_accessory: { label: 'Hair Accessory', emoji: '📌' },
};

const OCCASION_OPTIONS = [
  { value: 'daily',    label: 'Daily Wear' },
  { value: 'college',  label: 'College' },
  { value: 'office',   label: 'Office / Work' },
  { value: 'casual',   label: 'Casual Outing' },
  { value: 'cafe',     label: 'Café / Brunch' },
  { value: 'date',     label: 'Date Night' },
  { value: 'party',    label: 'Party' },
  { value: 'festival', label: 'Festival / Pooja' },
  { value: 'wedding',  label: 'Wedding' },
  { value: 'gym',      label: 'Gym / Sports' },
  { value: 'travel',   label: 'Travel' },
  { value: 'formal',   label: 'Formal Event' },
];

function StarRating({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="rp-stars" aria-label="Rate this outfit">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n}
          className={`rp-star${(hover || value) >= n ? ' rp-star--on' : ''}`}
          onClick={() => !disabled && onChange(n)}
          onMouseEnter={() => !disabled && setHover(n)}
          onMouseLeave={() => setHover(0)}
          disabled={disabled}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          ★
        </button>
      ))}
    </div>
  );
}

function OutfitSlotRow({ slot, data }) {
  if (!data) return null;
  const hasName = !!(data.name || data.item || data.suggestion);
  if (!hasName) return null;

  const meta        = SLOT_META[slot] || { label: slot, emoji: '✨' };
  const isOwned     = !!data.item;
  const isSuggested = !isOwned && !!data.suggestion;
  const displayName = data.name || data.item?.name || data.suggestion;

  return (
    <div className={`rp-slot${isSuggested ? ' rp-slot--ext' : ''}`}>
      <div className="rp-slot-icon">
        <span className="rp-slot-emoji">{meta.emoji}</span>
      </div>
      <div className="rp-slot-body">
        <div className="rp-slot-row1">
          <span className="rp-slot-cat">{meta.label}</span>
          {isOwned    && <span className="rp-badge rp-badge--owned"><Ic d={I.check} size={9} /> In your wardrobe</span>}
          {isSuggested && <span className="rp-badge rp-badge--ext">💡 Suggested</span>}
        </div>
        <div className="rp-slot-name">{displayName}</div>
        {data.reason && <div className="rp-slot-reason">{data.reason}</div>}
      </div>
      {data.item?.imageUrl && (
        <img src={data.item.imageUrl} alt={displayName} className="rp-slot-img" />
      )}
    </div>
  );
}

function RecCard({ rec, sessionId, onFeedbackSent, weatherContext, weights }) {
  const [status,           setStatus]           = useState(rec.status || 'pending');
  const [rating,           setRating]           = useState(rec.userRating || 0);
  const [loading,          setLoading]          = useState('');
  const [showExp,          setShowExp]          = useState(true);
  const [showDislikeModal, setShowDislikeModal] = useState(false);

  const exp    = rec.explanation || {};
  const outfit = rec.outfit      || {};

  const activeSlots = Object.entries(outfit).filter(([, d]) => d && (d.name || d.item || d.suggestion));
  const ownedCount  = activeSlots.filter(([, d]) => d.item).length;
  const match       = getMatchBadge(rec.confidence);

  const sendFeedback = async (newStatus, newRating, reasons) => {
    if (loading) return;
    setLoading(newStatus || 'rating');
    try {
      await api.post(`/recommendations/${sessionId}/feedback`, {
        category: rec.category,
        status:   newStatus || status,
        rating:   newRating || rating,
        reasons:  reasons || [],
      });
      if (newStatus) setStatus(newStatus);
      if (newRating) setRating(newRating);
      onFeedbackSent?.(rec.category, newStatus || status);
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setLoading('');
    }
  };

  const handleDislike = (reasons) => {
    setShowDislikeModal(false);
    sendFeedback('disliked', null, reasons);
  };

  const isDone = ['worn', 'saved', 'liked', 'disliked', 'skipped'].includes(status);

  return (
    <div className={`rp-card${isDone ? ` rp-card--${status}` : ''}`}>

      {/* Card header: outfit name + match badge */}
      <div className="rp-card-hd">
        <div className="rp-card-hd-left">
          <div className="rp-card-emoji">{rec.categoryEmoji}</div>
          <div>
            <div className="rp-card-cat-label">{rec.categoryLabel}</div>
            <div className="rp-card-name">{rec.outfitName}</div>
            {rec.categoryBrief && <div className="rp-card-brief">{rec.categoryBrief}</div>}
          </div>
        </div>
        <div className="rp-match-badge" style={{ background: match.bg, color: match.color, border: `1.5px solid ${match.border}` }}>
          <Ic d={I.check} size={12} />
          {match.text}
        </div>
      </div>

      {/* Status ribbon */}
      {isDone && (
        <div className={`rp-ribbon rp-ribbon--${status}`}>
          {status === 'worn'     && <><Ic d={I.check} size={12} /> Wearing this today</>}
          {status === 'liked'    && <><Ic d={I.heart} size={12} /> Liked</>}
          {status === 'saved'    && <><Ic d={I.heart} size={12} /> Saved to your outfits</>}
          {status === 'disliked' && <><Ic d={I.x}     size={12} /> Passed on this one</>}
          {status === 'skipped'  && <><Ic d={I.skip}  size={12} /> Skipped</>}
        </div>
      )}

      {/* Context info */}
      <div className="rp-pills">
        {weatherContext?.temp && (
          <span className="rp-pill rp-pill--wx">
            <Ic d={I.sun} size={11} /> {weatherContext.temp}°C · {weatherContext.condition}
          </span>
        )}
        {ownedCount > 0 && (
          <span className="rp-pill rp-pill--wr">
            <Ic d={I.wardrobe} size={11} />
            {ownedCount} of {activeSlots.length} items from your wardrobe
          </span>
        )}
      </div>

      {/* What to wear */}
      <div className="rp-slots-label">What to wear</div>
      <div className="rp-slots">
        {activeSlots.map(([slot, data]) => (
          <OutfitSlotRow key={slot} slot={slot} data={data} />
        ))}
        {activeSlots.length === 0 && (
          <div className="rp-slots-empty">No outfit items available for this category.</div>
        )}
      </div>

      {/* Why this outfit — plain language explanation */}
      <div className="rp-explain-section">
        <button className="rp-exp-toggle" onClick={() => setShowExp(p => !p)}>
          <Ic d={I.info} size={13} />
          Why this outfit?
          <Ic d={showExp ? I.chev_up : I.chev_down} size={13} />
        </button>

        {showExp && (
          <div className="rp-explain">
            {exp.summary && (
              <div className="rp-explain-summary">
                <div className="rp-explain-sum-icon"><Ic d={I.sparkle} size={13} /></div>
                <p>{exp.summary}</p>
              </div>
            )}

            {/* Reasons in plain language — one per row, no jargon */}
            <div className="rp-reason-list">
              {exp.styleReason && (
                <div className="rp-reason-row">
                  <span className="rp-reason-icon"><Ic d={I.check} size={10} /></span>
                  <span><strong>Style:</strong> {exp.styleReason}</span>
                </div>
              )}
              {exp.colorReason && (
                <div className="rp-reason-row">
                  <span className="rp-reason-icon"><Ic d={I.check} size={10} /></span>
                  <span><strong>Colors:</strong> {exp.colorReason}</span>
                </div>
              )}
              {exp.occasionReason && (
                <div className="rp-reason-row">
                  <span className="rp-reason-icon"><Ic d={I.check} size={10} /></span>
                  <span><strong>Occasion:</strong> {exp.occasionReason}</span>
                </div>
              )}
              {exp.weatherReason && (
                <div className="rp-reason-row">
                  <span className="rp-reason-icon"><Ic d={I.check} size={10} /></span>
                  <span><strong>Weather:</strong> {exp.weatherReason}</span>
                </div>
              )}
              {exp.wardrobeReason && (
                <div className="rp-reason-row">
                  <span className="rp-reason-icon"><Ic d={I.check} size={10} /></span>
                  <span><strong>Your wardrobe:</strong> {exp.wardrobeReason}</span>
                </div>
              )}
              {exp.behaviorReason && (
                <div className="rp-reason-row">
                  <span className="rp-reason-icon"><Ic d={I.check} size={10} /></span>
                  <span><strong>Based on your taste:</strong> {exp.behaviorReason}</span>
                </div>
              )}
            </div>

            {rec.tips?.length > 0 && (
              <div className="rp-tips">
                <div className="rp-tips-head">Styling tips</div>
                <ul className="rp-tips-list">
                  {rec.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full explainability — 9-dimension radar, weighted contributions, ML/AI transparency */}
      <XAIPanel rec={rec} weights={weights} />

      <DislikeReasonModal
        isOpen={showDislikeModal}
        onClose={() => setShowDislikeModal(false)}
        onConfirm={handleDislike}
        outfitName={rec.outfitName}
      />

      {/* Rate & action buttons */}
      <div className="rp-actions">
        <div className="rp-actions-rating">
          <span className="rp-rating-label">Rate this outfit:</span>
          <StarRating value={rating} onChange={r => sendFeedback(null, r)} disabled={!!loading} />
        </div>

        {!isDone ? (
          <div className="rp-action-btns">
            <button className="rp-btn rp-btn--skip"    onClick={() => sendFeedback('skipped')}   disabled={!!loading}>
              {loading === 'skipped'  ? <span className="rp-spin" /> : <><Ic d={I.skip}  size={14} /> Skip</>}
            </button>
            <button className="rp-btn rp-btn--dislike" onClick={() => setShowDislikeModal(true)} disabled={!!loading}>
              {loading === 'disliked' ? <span className="rp-spin" /> : <><Ic d={I.x}     size={14} /> Not for me</>}
            </button>
            <button className="rp-btn rp-btn--save"    onClick={() => sendFeedback('saved')}     disabled={!!loading}>
              {loading === 'saved'    ? <span className="rp-spin" /> : <><Ic d={I.heart}  size={14} /> Save</>}
            </button>
            <button className="rp-btn rp-btn--wear"    onClick={() => sendFeedback('worn')}      disabled={!!loading}>
              {loading === 'worn'     ? <span className="rp-spin" /> : <><Ic d={I.check}  size={14} /> Wear Today</>}
            </button>
          </div>
        ) : (
          <button className="rp-btn rp-btn--undo" onClick={() => sendFeedback('pending')} disabled={!!loading}>
            {loading ? <span className="rp-spin" /> : 'Undo'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Skeleton loader ──────────────────────────────────────────────────────── */
function Skel({ w, h, r = 6 }) {
  return <div className="rp-skel-block" style={{ width: w, height: h, borderRadius: r }} />;
}

const SKEL_STEPS = [
  'Looking at your wardrobe…',
  'Checking today\'s weather in Kathmandu…',
  'Matching your style preferences…',
  'Putting together outfit options…',
  'Almost ready…',
];

function RecSkeleton() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % SKEL_STEPS.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rp-skel-wrap">
      <div className="rp-skel-tabs">
        {[92, 80, 88, 76, 84].map((w, i) => (
          <div key={i} className={`rp-skel-tab${i === 0 ? ' rp-skel-tab--active' : ''}`}>
            <Skel w={22} h={22} r={11} />
            <Skel w={w} h={9} />
          </div>
        ))}
      </div>
      <div className="rp-skel-card">
        <div className="rp-skel-card-hd">
          <Skel w={42} h={42} r={10} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skel w={80} h={10} />
            <Skel w={180} h={18} />
            <Skel w={130} h={9} />
          </div>
          <Skel w={90} h={28} r={20} />
        </div>
        <div className="rp-skel-pills">
          <Skel w={110} h={22} r={11} />
          <Skel w={170} h={22} r={11} />
        </div>
        <div className="rp-skel-slots">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rp-skel-slot">
              <Skel w={28} h={28} r={7} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skel w={50} h={9} />
                <Skel w="85%" h={13} />
                <Skel w="55%" h={9} />
              </div>
            </div>
          ))}
        </div>
        <div className="rp-skel-msg">
          <div className="rp-skel-spinner" />
          <span key={step} className="rp-skel-step">{SKEL_STEPS[step]}</span>
        </div>
      </div>
    </div>
  );
}

function GenerateForm({ onGenerate, loading }) {
  const [occasion,     setOccasion]     = useState('daily');
  const [mood,         setMood]         = useState('');
  const [wardrobeOnly, setWardrobeOnly] = useState(false);
  const [open,         setOpen]         = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate({ occasion, mood, wardrobeOnly });
    setOpen(false);
  };

  return (
    <div className="rp-genform">
      <button className="rp-genform-toggle" onClick={() => setOpen(p => !p)}>
        <Ic d={I.wand} size={14} />
        Customise my outfit
        <Ic d={open ? I.chev_up : I.chev_down} size={13} />
      </button>

      {open && (
        <form className="rp-genform-body" onSubmit={handleSubmit}>
          <div className="rp-gf-field">
            <label className="rp-gf-label">Where are you going?</label>
            <select className="rp-gf-select" value={occasion} onChange={e => setOccasion(e.target.value)}>
              {OCCASION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="rp-gf-field">
            <label className="rp-gf-label">Any vibe in mind? (optional)</label>
            <input className="rp-gf-input" type="text" value={mood}
              onChange={e => setMood(e.target.value)}
              placeholder="e.g. comfortable, bold, elegant…"
              maxLength={80} />
          </div>
          <label className="rp-gf-checkbox">
            <input type="checkbox" checked={wardrobeOnly} onChange={e => setWardrobeOnly(e.target.checked)} />
            Only use clothes I already own
          </label>
          <button type="submit" className="rp-gf-submit" disabled={loading}>
            {loading ? <><span className="rp-spin" /> Finding outfits…</> : <><Ic d={I.sparkle} size={14} /> Find Outfits</>}
          </button>
        </form>
      )}
    </div>
  );
}

export default function RecommendationPanel() {
  const [session,    setSession]    = useState(null);
  const [activeTab,  setActiveTab]  = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [wxContext,  setWxContext]   = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [weights,    setWeights]    = useState(null);

  useEffect(() => {
    api.get('/recommendations/latest')
      .then(r => { if (r.data.session) setSession(r.data.session); })
      .catch(() => {});
    api.get('/recommendations/kathmandu')
      .then(r => setWxContext(r.data))
      .catch(() => {});
    api.get('/recommendations/weights')
      .then(r => setWeights(r.data.weights))
      .catch(() => {});
  }, []);

  const handleGenerate = useCallback(async (opts = {}) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.post('/recommendations/generate', {
        occasion:     opts.occasion     || 'daily',
        mood:         opts.mood         || '',
        wardrobeOnly: opts.wardrobeOnly || false,
        requestedBy:  'user',
      });
      setSession(r.data.session);
      setActiveTab(0);
    } catch (err) {
      setError(err.response?.data?.message || 'Couldn\'t generate outfits. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const recs      = session?.recommendations || [];
  const activeRec = recs[activeTab];

  return (
    <div className="rp-panel">

      {/* Header */}
      <div className="rp-panel-hd">
        <div className="rp-panel-hd-left">
          <div className="rp-panel-icon"><Ic d={I.sparkle} size={17} /></div>
          <div>
            <div className="rp-panel-title">Your Outfit Recommendations</div>
            <div className="rp-panel-sub">
              5 outfit options personalised just for you
            </div>
          </div>
        </div>
        <div className="rp-panel-hd-right">
          {session?.context?.weather?.temp && (
            <div className="rp-pill rp-pill--wx" style={{ fontSize: '0.75rem' }}>
              <Ic d={I.sun} size={12} />
              {session.context.weather.temp}°C · {session.context.weather.condition}
            </div>
          )}
          <button className="rp-gen-btn rp-gen-btn--wizard" onClick={() => setShowWizard(true)} disabled={loading}
            title="Advanced wizard — describe exactly what you need">
            <Ic d={I.wand} size={14} /> Advanced
          </button>
          <button className="rp-gen-btn" onClick={() => handleGenerate()} disabled={loading}>
            {loading
              ? <><span className="rp-spin" /> Finding outfits…</>
              : session
                ? <><Ic d={I.refresh} size={14} /> New outfits</>
                : <><Ic d={I.sparkle} size={14} /> Get outfits</>
            }
          </button>
        </div>
      </div>

      {/* Festival notice — shown only when relevant */}
      {session?.kathmanduContext?.activeFestival && (
        <div className="rp-festival-bar">
          🎉 <strong>{session.kathmanduContext.activeFestival}</strong> is coming up — traditional style included in recommendations
        </div>
      )}

      {error && <div className="rp-error">{error}</div>}

      <GenerateForm onGenerate={handleGenerate} loading={loading} />

      {loading && <RecSkeleton />}

      {/* Empty state */}
      {!loading && !session && !error && (
        <div className="rp-empty">
          <div className="rp-empty-icon"><Ic d={I.sparkle} size={32} /></div>
          <div className="rp-empty-title">Get Your Outfit Ideas</div>
          <div className="rp-empty-text">
            Tap the button and StyleAI will suggest 5 different outfit options from your wardrobe,
            matched to today's weather and your personal style.
          </div>
          <button className="rp-empty-btn" onClick={() => handleGenerate()}>
            <Ic d={I.sparkle} size={15} /> Show me outfits
          </button>
        </div>
      )}

      {/* Recommendations */}
      {!loading && recs.length > 0 && (
        <>
          {/* Tabs — emoji + label only, no confusing % numbers */}
          <div className="rp-tabs">
            {recs.map((rec, i) => (
              <button
                key={rec.category}
                className={`rp-tab${activeTab === i ? ' rp-tab--active' : ''}${rec.status !== 'pending' ? ' rp-tab--done' : ''}`}
                onClick={() => setActiveTab(i)}>
                <span className="rp-tab-emoji">{rec.categoryEmoji}</span>
                <span className="rp-tab-label">{rec.categoryLabel}</span>
                {rec.status !== 'pending' && <span className="rp-tab-done-dot" />}
              </button>
            ))}
          </div>

          {activeRec && (
            <RecCard
              key={activeRec.category}
              rec={activeRec}
              sessionId={session._id}
              weatherContext={session.context?.weather}
              weights={weights}
              onFeedbackSent={(category, newStatus) => {
                setSession(s => ({
                  ...s,
                  recommendations: s.recommendations.map(r =>
                    r.category === category ? { ...r, status: newStatus } : r
                  ),
                }));
              }}
            />
          )}

          <div className="rp-session-footer">
            <span>Generated {new Date(session.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            {session.context?.occasion && <><span>·</span><span>{session.context.occasion}</span></>}
          </div>
        </>
      )}

      {showWizard && (
        <Suspense fallback={null}>
          <SmartRecommendationWizard
            onClose={() => setShowWizard(false)}
            onSessionReady={(wizardSession) => {
              setSession(wizardSession);
              setActiveTab(0);
              setShowWizard(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
