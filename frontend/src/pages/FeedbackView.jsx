import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './FeedbackView.css';

const Ic = ({ d, size = 18, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const I = {
  sparkle: "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z",
  check:   "M20 6L9 17l-5-5",
  send:    "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  message: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  bulb:    "M9 21h6m-6-4h6m-9-5a6 6 0 1112 0c0 2.22-1.2 4.17-3 5.2V17H9v-1.83C7.2 14.17 6 12.22 6 10z",
  alert:   "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zm1.71 4.14v4m0 4h.01",
  tool:    "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  star:    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  clock:   "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14v4l3 3",
  heart:   "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  thumb:   "M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zm-7 11H4a2 2 0 01-2-2v-7a2 2 0 012-2h3v11z",
  refresh: "M23 4v6h-6M1 20v-6h6m16.73-7A10 10 0 0013.93 3.6a10 10 0 00-8.87 8.33A10 10 0 0010 21.4",
  x:       "M18 6L6 18M6 6l12 12",
};

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: 'Suggestion',  icon: I.bulb,  color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', desc: 'Share ideas to make StyleAI better' },
  { id: 'complaint',  label: 'Complaint',   icon: I.alert, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', desc: 'Tell us what went wrong' },
  { id: 'improvement',label: 'Improvement', icon: I.tool,  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', desc: 'Help us improve existing features' },
];

const SATISFACTION_LEVELS = [
  { val: 1, label: 'Very Dissatisfied', color: '#EF4444' },
  { val: 2, label: 'Dissatisfied',      color: '#F97316' },
  { val: 3, label: 'Neutral',           color: '#EAB308' },
  { val: 4, label: 'Satisfied',         color: '#22C55E' },
  { val: 5, label: 'Very Satisfied',    color: '#0D9488' },
];

const REC_LABELS = ['', 'Very Inaccurate', 'Inaccurate', 'Neutral', 'Accurate', 'Very Accurate'];

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  reviewed: { label: 'Reviewed', color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
  resolved: { label: 'Resolved', color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
};

const TYPE_CONFIG = {
  suggestion:  { color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
  complaint:   { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  improvement: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
};

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)   return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AICharacter() {
  return (
    <div className="fv-ai-wrap">
      <svg className="fv-ai-svg" viewBox="0 0 220 260" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fv-grad-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="fv-grad-screen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0FDFA" />
            <stop offset="100%" stopColor="#CCFBF1" />
          </linearGradient>
          <radialGradient id="fv-grad-glow" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor="rgba(13,148,136,0.16)" />
            <stop offset="100%" stopColor="rgba(13,148,136,0)" />
          </radialGradient>
          <linearGradient id="fv-grad-ear" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>

        {/* Ambient glow */}
        <ellipse cx="110" cy="180" rx="95" ry="65" fill="url(#fv-grad-glow)" />

        {/* Orbiting dots */}
        <circle cx="30" cy="80"  r="5" fill="#99F6E4" className="fv-orbit-a" />
        <circle cx="190" cy="60" r="7" fill="#FDE68A" className="fv-orbit-b" />
        <circle cx="185" cy="195" r="5" fill="#CFFAFE" />
        <circle cx="25" cy="200"  r="4" fill="#A5F3FC" />

        {/* Antenna pole */}
        <rect x="105" y="12" width="10" height="32" rx="5" fill="#0D9488" />
        {/* Antenna ball */}
        <circle cx="110" cy="10" r="12" fill="url(#fv-grad-body)" />
        <circle cx="114" cy="7" r="3.5" fill="rgba(255,255,255,0.4)" />

        {/* Head */}
        <rect x="30" y="42" width="160" height="140" rx="40" fill="url(#fv-grad-body)" />

        {/* Inner screen */}
        <rect x="48" y="60" width="124" height="104" rx="26" fill="url(#fv-grad-screen)" />

        {/* Eyes whites */}
        <circle cx="85"  cy="105" r="16" fill="white" opacity="0.96" />
        <circle cx="135" cy="105" r="16" fill="white" opacity="0.96" />
        {/* Pupils */}
        <circle cx="88"  cy="102" r="7" fill="#115E59" />
        <circle cx="138" cy="102" r="7" fill="#115E59" />
        {/* Eye shine */}
        <circle cx="91"  cy="99" r="2.5" fill="white" />
        <circle cx="141" cy="99" r="2.5" fill="white" />
        {/* Pupil inner */}
        <circle cx="88"  cy="102" r="3" fill="#042F2E" />
        <circle cx="138" cy="102" r="3" fill="#042F2E" />

        {/* Cheeks */}
        <ellipse cx="60"  cy="120" rx="11" ry="8" fill="#2DD4BF" opacity="0.22" />
        <ellipse cx="160" cy="120" rx="11" ry="8" fill="#2DD4BF" opacity="0.22" />

        {/* Smile */}
        <path d="M76 136 Q110 158 144 136" stroke="#0D9488" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* Ears */}
        <rect x="8"  y="88" width="24" height="38" rx="12" fill="url(#fv-grad-ear)" />
        <rect x="188" y="88" width="24" height="38" rx="12" fill="url(#fv-grad-ear)" />
        <rect x="13" y="95" width="14" height="24" rx="7" fill="rgba(255,255,255,0.25)" />
        <rect x="193" y="95" width="14" height="24" rx="7" fill="rgba(255,255,255,0.25)" />

        {/* Neck */}
        <rect x="82" y="178" width="56" height="28" rx="14" fill="#0D9488" />

        {/* Chest indicator */}
        <circle cx="110" cy="168" r="7" fill="#FDE68A" />
        <circle cx="110" cy="168" r="3.5" fill="#F59E0B" />

        {/* Feet */}
        <rect x="68" y="202" width="36" height="44" rx="16" fill="#0D9488" />
        <rect x="116" y="202" width="36" height="44" rx="16" fill="#0D9488" />

        {/* Shoe shine */}
        <ellipse cx="86"  cy="240" rx="14" ry="4" fill="rgba(255,255,255,0.15)" />
        <ellipse cx="134" cy="240" rx="14" ry="4" fill="rgba(255,255,255,0.15)" />

        {/* Sparkle decorations */}
        <text x="170" y="48"  fontSize="16" fill="#FDE68A">✦</text>
        <text x="22"  y="55"  fontSize="11" fill="#A5F3FC">✦</text>
        <text x="178" y="210" fontSize="10" fill="#CFFAFE">✦</text>
        <text x="18"  y="215" fontSize="9"  fill="#99F6E4">✦</text>
      </svg>

      <div className="fv-float-star fv-float-star--1">✦</div>
      <div className="fv-float-star fv-float-star--3">✦</div>
    </div>
  );
}

function StarRating({ value, onChange, size = 32 }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="fv-stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          className={`fv-star ${active >= n ? 'fv-star--filled' : ''}`}
          style={{ fontSize: size }}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}>
          ★
        </button>
      ))}
    </div>
  );
}

function EmojiRating({ value, onChange }) {
  return (
    <div className="fv-emoji-row">
      {SATISFACTION_LEVELS.map(l => (
        <button key={l.val} type="button"
          className={`fv-emoji-btn ${value === l.val ? 'fv-emoji-btn--active' : ''}`}
          style={value === l.val ? { '--ec': l.color } : {}}
          onClick={() => onChange(l.val)}
          title={l.label}>
          <span className="fv-emoji">{l.emoji}</span>
          <span className="fv-emoji-lbl">{l.label.split(' ').pop()}</span>
        </button>
      ))}
    </div>
  );
}

function SuccessState({ onReset }) {
  return (
    <div className="fv-success-card">
      <div className="fv-success-ring">
        <div className="fv-success-check">
          <Ic d={I.check} size={28} />
        </div>
      </div>
      <h3 className="fv-success-title">Thank you for your feedback!</h3>
      <p className="fv-success-text">
        Your voice matters. StyleAI uses every piece of feedback to make smarter, more personalised recommendations for you.
      </p>
      <div className="fv-success-pills">
        <span className="fv-success-pill">✦ AI is learning</span>
        <span className="fv-success-pill">📊 Data recorded</span>
        <span className="fv-success-pill">🚀 Improving</span>
      </div>
      <button className="fv-success-btn" onClick={onReset}>
        <Ic d={I.refresh} size={15} /> Submit Another
      </button>
    </div>
  );
}

function HistoryCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const type   = TYPE_CONFIG[item.type] || TYPE_CONFIG.suggestion;
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const isLong = item.message.length > 140;

  return (
    <div className="fv-history-card">
      <div className="fv-hc-left">
        <div className="fv-hc-timeline-dot" style={{ background: type.color }} />
        <div className="fv-hc-timeline-line" />
      </div>

      <div className="fv-hc-body">
        <div className="fv-hc-head">
          <div className="fv-hc-badges">
            <span className="fv-type-badge" style={{ color: type.color, background: type.bg, borderColor: type.border }}>
              {type.emoji} {cap(item.type)}
            </span>
            <span className="fv-status-badge" style={{ color: status.color, background: status.bg, borderColor: status.border }}>
              {status.label}
            </span>
          </div>
          <span className="fv-hc-time">
            <Ic d={I.clock} size={12} /> {timeAgo(item.createdAt)}
          </span>
        </div>

        {item.subject && <div className="fv-hc-subject">{item.subject}</div>}

        <div className="fv-hc-message">
          {isLong && !expanded
            ? <>{item.message.slice(0, 140)}<span className="fv-hc-ellipsis">…</span></>
            : item.message
          }
          {isLong && (
            <button className="fv-hc-toggle" onClick={() => setExpanded(p => !p)}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {(item.recommendationRating || item.satisfactionRating) && (
          <div className="fv-hc-ratings">
            {item.recommendationRating && (
              <span className="fv-hc-rating-pill">
                {'★'.repeat(item.recommendationRating)}{'☆'.repeat(5 - item.recommendationRating)} Rec
              </span>
            )}
            {item.satisfactionRating && (
              <span className="fv-hc-rating-pill">
                {SATISFACTION_LEVELS.find(l => l.val === item.satisfactionRating)?.emoji} Sat.
              </span>
            )}
            {item.wouldRecommend !== undefined && item.wouldRecommend !== null && (
              <span className="fv-hc-rating-pill">
                {item.wouldRecommend ? '👍 Would recommend' : '👎 Would not recommend'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedbackView() {
  const { user } = useAuth();

  /* Form state */
  const [type,    setType]    = useState('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [recRating, setRecRating] = useState(0);
  const [satRating, setSatRating] = useState(0);
  const [wouldRec, setWouldRec] = useState(null);
  const [errors,  setErrors]  = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  /* History */
  const [history, setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  const formRef = useRef(null);

  useEffect(() => {
    api.get('/app-feedback')
      .then(res => setHistory(res.data.feedback || []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, []);

  const validate = () => {
    const e = {};
    if (!recRating) e.recRating = 'Please rate recommendation accuracy';
    if (!satRating) e.satRating = 'Please rate your satisfaction';
    if (!message.trim()) e.message = 'Please share your feedback';
    if (message.trim().length < 10) e.message = 'Please write at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/app-feedback', {
        type, subject, message,
        recommendationRating: recRating,
        satisfactionRating: satRating,
        wouldRecommend: wouldRec,
      });
      setHistory(prev => [res.data.feedback, ...prev]);
      setSubmitted(true);
    } catch {
      setErrors({ global: 'Failed to submit. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setType('suggestion');
    setSubject('');
    setMessage('');
    setRecRating(0);
    setSatRating(0);
    setWouldRec(null);
    setErrors({});
    setSubmitted(false);
  };

  const activeType = FEEDBACK_TYPES.find(t => t.id === type);

  /* Derived stats from history */
  const avgRec = history.length
    ? (history.reduce((s, f) => s + (f.recommendationRating || 0), 0) / history.filter(f => f.recommendationRating).length || 0).toFixed(1)
    : null;
  const avgSat = history.length
    ? (history.reduce((s, f) => s + (f.satisfactionRating || 0), 0) / history.filter(f => f.satisfactionRating).length || 0).toFixed(1)
    : null;

  return (
    <div className="fv-root">

      <div className="fv-hero">
        <div className="fv-hero-left">
          <div className="fv-hero-eyebrow">
            <span className="fv-eyebrow-dot" />
            StyleAI Feedback Portal
          </div>
          <h2 className="fv-hero-title">
            Your Voice <em>Shapes</em><br />Our AI
          </h2>
          <p className="fv-hero-text">
            Every suggestion, complaint and improvement idea you share helps StyleAI learn faster and recommend better outfits — just for you.
          </p>

          {/* Stat pills */}
          <div className="fv-hero-stats">
            <div className="fv-hero-stat">
              <span className="fv-hs-val">{history.length}</span>
              <span className="fv-hs-lbl">Submissions</span>
            </div>
            {avgRec && (
              <div className="fv-hero-stat">
                <span className="fv-hs-val">{avgRec}★</span>
                <span className="fv-hs-lbl">Avg Accuracy</span>
              </div>
            )}
            {avgSat && (
              <div className="fv-hero-stat">
                <span className="fv-hs-val">{SATISFACTION_LEVELS.find(l => Math.round(avgSat) === l.val)?.emoji || '🙂'}</span>
                <span className="fv-hs-lbl">Avg Satisfaction</span>
              </div>
            )}
            <div className="fv-hero-stat">
              <span className="fv-hs-val">AI</span>
              <span className="fv-hs-lbl">Learning</span>
            </div>
          </div>
        </div>

        <div className="fv-hero-right">
          <AICharacter />
          {/* Speech bubble */}
          <div className="fv-speech-bubble">
            <div className="fv-speech-text">How can I improve your style experience? ✦</div>
            <div className="fv-speech-tail" />
          </div>
        </div>
      </div>

      <div className="fv-rating-row">

        {/* Recommendation Accuracy */}
        <div className={`fv-rating-card ${errors.recRating ? 'fv-rating-card--error' : ''}`}>
          <div className="fv-rc-head">
            <div className="fv-rc-icon fv-rc-icon--purple">
              <Ic d={I.sparkle} size={20} />
            </div>
            <div>
              <div className="fv-rc-title">Recommendation Accuracy</div>
              <div className="fv-rc-sub">How accurate are the outfit suggestions?</div>
            </div>
          </div>
          <StarRating value={recRating} onChange={v => { setRecRating(v); setErrors(p => ({ ...p, recRating: null })); }} />
          <div className="fv-rc-labels">
            <span>Very Inaccurate</span>
            {recRating > 0 && <span className="fv-rc-selected">{REC_LABELS[recRating]}</span>}
            <span>Very Accurate</span>
          </div>
          {errors.recRating && <div className="fv-field-error">{errors.recRating}</div>}
        </div>

        {/* User Satisfaction */}
        <div className={`fv-rating-card ${errors.satRating ? 'fv-rating-card--error' : ''}`}>
          <div className="fv-rc-head">
            <div className="fv-rc-icon fv-rc-icon--pink">
              <Ic d={I.heart} size={20} />
            </div>
            <div>
              <div className="fv-rc-title">User Satisfaction</div>
              <div className="fv-rc-sub">How satisfied are you with StyleAI overall?</div>
            </div>
          </div>
          <EmojiRating value={satRating} onChange={v => { setSatRating(v); setErrors(p => ({ ...p, satRating: null })); }} />
          {satRating > 0 && (
            <div className="fv-sat-selected" style={{ color: SATISFACTION_LEVELS.find(l => l.val === satRating)?.color }}>
              {SATISFACTION_LEVELS.find(l => l.val === satRating)?.label}
            </div>
          )}
          {errors.satRating && <div className="fv-field-error">{errors.satRating}</div>}
        </div>
      </div>

      <div className="fv-form-card">
        {submitted ? (
          <SuccessState onReset={handleReset} />
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate>

            {/* Type selector */}
            <div className="fv-form-head">
              <div className="fv-form-title">Share Your Feedback</div>
              <div className="fv-form-sub">Choose the type that best describes your feedback</div>
            </div>

            <div className="fv-type-selector">
              {FEEDBACK_TYPES.map(t => (
                <button key={t.id} type="button"
                  className={`fv-type-btn ${type === t.id ? 'fv-type-btn--active' : ''}`}
                  style={type === t.id ? { '--tc': t.color, '--tbg': t.bg, '--tborder': t.border } : {}}
                  onClick={() => setType(t.id)}>
                  <span className="fv-type-emoji">{t.emoji}</span>
                  <span className="fv-type-label">{t.label}</span>
                  <span className="fv-type-desc">{t.desc}</span>
                  {type === t.id && <span className="fv-type-check"><Ic d={I.check} size={12} /></span>}
                </button>
              ))}
            </div>

            {/* Active type info bar */}
            <div className="fv-type-info-bar" style={{ borderColor: activeType?.border, background: activeType?.bg }}>
              <span style={{ color: activeType?.color }}>{activeType?.emoji}</span>
              <span style={{ color: activeType?.color, fontWeight: 600, fontSize: '0.84rem' }}>
                {activeType?.desc}
              </span>
            </div>

            {/* Subject */}
            <div className="fv-field">
              <label className="fv-label">Subject <span className="fv-optional">(optional)</span></label>
              <input
                className="fv-input"
                placeholder={`e.g. "${type === 'suggestion' ? 'Add outfit sharing feature' : type === 'complaint' ? 'Recommendations feel too generic' : 'Improve filter options'}"`}
                value={subject}
                onChange={e => setSubject(e.target.value)}
                maxLength={120}
              />
            </div>

            {/* Message */}
            <div className={`fv-field ${errors.message ? 'fv-field--error' : ''}`}>
              <div className="fv-label-row">
                <label className="fv-label">Your Feedback <span className="fv-required">*</span></label>
                <span className={`fv-char-count ${message.length > 450 ? 'fv-char-count--warn' : ''}`}>
                  {message.length}/500
                </span>
              </div>
              <textarea
                className="fv-textarea"
                placeholder={
                  type === 'suggestion'
                    ? "What feature or improvement would make StyleAI more useful for you? Be as specific as you like!"
                    : type === 'complaint'
                    ? "Tell us what went wrong. We take every complaint seriously and work to fix issues quickly."
                    : "What specific aspect could be improved? Your detailed input directly shapes our next update."
                }
                value={message}
                onChange={e => { setMessage(e.target.value); setErrors(p => ({ ...p, message: null })); }}
                rows={5}
                maxLength={500}
              />
              {errors.message && <div className="fv-field-error">{errors.message}</div>}
            </div>

            {/* Would recommend */}
            <div className="fv-field">
              <label className="fv-label">Would you recommend StyleAI to a friend?</label>
              <div className="fv-wr-row">
                {[
                  { val: true,  label: '👍 Yes, absolutely!', cls: 'fv-wr-yes' },
                  { val: false, label: '👎 Not yet',          cls: 'fv-wr-no'  },
                  { val: null,  label: '🤔 Not sure',          cls: 'fv-wr-maybe' },
                ].map(o => (
                  <button key={String(o.val)} type="button"
                    className={`fv-wr-btn ${wouldRec === o.val ? 'fv-wr-btn--active' : ''} ${o.cls}`}
                    onClick={() => setWouldRec(o.val)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error banner */}
            {errors.global && (
              <div className="fv-error-banner">⚠️ {errors.global}</div>
            )}

            {/* Submit */}
            <div className="fv-form-footer">
              <p className="fv-form-note">
                🔒 Your feedback is private and only visible to the StyleAI team.
              </p>
              <button type="submit" className="fv-submit-btn" disabled={submitting}>
                {submitting
                  ? <><span className="fv-btn-spinner" /> Submitting…</>
                  : <><Ic d={I.send} size={16} /> Send Feedback</>
                }
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="fv-history">
        <div className="fv-history-head">
          <div className="fv-history-title-row">
            <div className="fv-history-title">Previous Submissions</div>
            {history.length > 0 && (
              <span className="fv-history-count">{history.length} total</span>
            )}
          </div>
          <div className="fv-history-sub">A record of everything you've shared with StyleAI</div>
        </div>

        {histLoading ? (
          <div className="fv-hist-loading">
            <div className="fv-spinner" />
            <span>Loading your feedback history…</span>
          </div>
        ) : history.length === 0 ? (
          <div className="fv-hist-empty">
            <div className="fv-hist-empty-icon">💬</div>
            <div className="fv-hist-empty-title">No submissions yet</div>
            <p>You have not submitted any feedback. Use the form above to share your first thought!</p>
          </div>
        ) : (
          <div className="fv-history-list">
            {history.map((item, i) => (
              <HistoryCard key={item._id || i} item={item} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
