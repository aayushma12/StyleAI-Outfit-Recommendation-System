import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { getMatchBadge } from '../utils/confidenceScale';
import './DailyOutfitCard.css';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const I = {
  sparkle:  'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
  sun:      'M12 17a5 5 0 100-10 5 5 0 000 10zm0-15v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  cloud:    'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  rain:     ['M16 13v8','M8 13v8','M12 15v8','M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25'],
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  check:    'M20 6L9 17l-5-5',
  heart:    'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  x:        'M18 6L6 18M6 6l12 12',
  refresh:  'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  arrow:    'M5 12h14M12 5l7 7-7 7',
  shirt:    'M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z',
  wand:     ['M15 4V2','M15 16v-2','M8 9h2','M20 9h2','M17.8 11.8L19 13','M15 9h0','M17.8 6.2L19 5','M3 21l9-9','M12.2 6.2L11 5'],
  chev:     'M6 9l6 6 6-6',
  chevUp:   'M18 15l-6-6-6 6',
};

const PRIMARY_SLOTS = ['top', 'bottom', 'dress', 'footwear'];
const ACCENT_SLOTS  = ['jewelry', 'bag', 'watch', 'scarf', 'outerwear'];

const SLOT_EMOJI = {
  top: '👕', bottom: '👖', dress: '👗', outerwear: '🧥',
  footwear: '👟', accessory: '💍', jewelry: '💎', bag: '👜',
  belt: '🎀', watch: '⌚', scarf: '🧣', sunglasses: '🕶️', hair_accessory: '📌',
};

function DailyCardSkeleton() {
  return (
    <div className="doc-root doc-root--loading">
      <div className="doc-header">
        <div className="doc-header-left">
          <div className="doc-skel doc-skel--title" />
          <div className="doc-skel doc-skel--sub" />
        </div>
        <div className="doc-skel doc-skel--ring" />
      </div>
      <div className="doc-skel doc-skel--pill" />
      <div className="doc-items">
        {[1,2,3].map(i => <div key={i} className="doc-skel doc-skel--item" />)}
      </div>
      <div className="doc-skel doc-skel--text" />
      <div className="doc-generating">
        <div className="doc-gen-spinner" />
        <span>StyleAI is choosing your outfit for today…</span>
      </div>
    </div>
  );
}

export default function DailyOutfitCard({ userName, onNavigate }) {
  const [state,    setState]    = useState('idle');
  const [session,  setSession]  = useState(null);
  const [calEvent, setCalEvent] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [expanded, setExpanded] = useState(false);

  const bestMatch = session?.recommendations?.find(r => r.category === 'best_match')
    || session?.recommendations?.[0];

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { data } = await api.get('/recommendations/daily');
      setSession(data.session);
      if (data.calendarEvent?.hasEvent) setCalEvent(data.calendarEvent);
      setState('done');
    } catch (err) {
      setState(err.response?.status === 503 ? 'ai_unavailable' : 'error');
    }
  }, []);

  const regenerate = useCallback(async () => {
    setState('loading');
    setFeedback({});
    try {
      const { data } = await api.post('/recommendations/daily/regenerate');
      setSession(data.session);
      setCalEvent(data.calendarEvent?.hasEvent ? data.calendarEvent : null);
      setState('done');
    } catch (err) {
      setState(err.response?.status === 503 ? 'ai_unavailable' : 'error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendFeedback = async (status) => {
    if (!session?._id || !bestMatch) return;
    setFeedback(f => ({ ...f, [bestMatch.category]: status }));
    try {
      await api.post(`/recommendations/${session._id}/feedback`, {
        category: bestMatch.category,
        status,
      });
    } catch { /* non-critical */ }
  };

  const currentStatus = feedback[bestMatch?.category] || bestMatch?.status || 'pending';
  const isDone        = ['worn', 'liked', 'saved', 'disliked', 'skipped'].includes(currentStatus);

  if (state === 'loading' || state === 'idle') return <DailyCardSkeleton />;

  if (state === 'ai_unavailable') {
    return (
      <div className="doc-root doc-root--warn">
        <div className="doc-warn-icon"><Ic d={I.sparkle} size={22} /></div>
        <p className="doc-warn-title">Outfit is on its way</p>
        <p className="doc-warn-sub">StyleAI is warming up. Your outfit recommendation will appear shortly.</p>
        <button className="doc-btn-outline" onClick={load}>
          <Ic d={I.refresh} size={14} /> Try again
        </button>
      </div>
    );
  }

  if (state === 'error' || !session || !bestMatch) {
    return (
      <div className="doc-root doc-root--error">
        <p className="doc-warn-title">Couldn't load today's outfit</p>
        <button className="doc-btn-outline" onClick={load}>
          <Ic d={I.refresh} size={14} /> Retry
        </button>
      </div>
    );
  }

  const outfit      = bestMatch.outfit || {};
  const wx          = session.context?.weather;
  const season      = session.context?.season || '';
  const timeOfDay   = session.context?.timeOfDay || '';
  const explanation = bestMatch.explanation || {};
  const styling     = bestMatch.stylingNotes || {};
  const tips        = bestMatch.tips || [];
  const match       = getMatchBadge(bestMatch.confidence);

  const primaryItems = PRIMARY_SLOTS
    .map(slot => ({ slot, data: outfit[slot] }))
    .filter(({ data }) => data && (data.name || data.suggestion));

  const accentItems = ACCENT_SLOTS
    .map(slot => ({ slot, data: outfit[slot] }))
    .filter(({ data }) => data && (data.name || data.suggestion));

  const wxIcon = wx?.isRaining ? I.rain : wx?.temp > 28 ? I.sun : I.cloud;
  const wxStr  = wx?.temp != null
    ? `${wx.temp}°C · ${wx.condition}${wx.rainProb > 40 ? ` · ${wx.rainProb}% chance of rain` : ''}`
    : 'Kathmandu';

  // Plain-language reasons for the outfit choice
  const reasonNotes = [
    explanation.weatherNote,
    explanation.calendarReason,
    explanation.colorReason,
    explanation.behaviorReason,
    explanation.seasonalNote,
  ].filter(Boolean);

  return (
    <div className={`doc-root${isDone ? ' doc-root--done' : ''}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="doc-header">
        <div className="doc-header-left">
          <div className="doc-eyebrow">
            <span className="doc-eyebrow-dot" />
            Today's Outfit Pick for {userName?.split(' ')[0] || 'You'}
          </div>
          <h3 className="doc-outfit-name">{bestMatch.outfitName}</h3>
          {styling.overallLook && (
            <p className="doc-overall-look">{styling.overallLook}</p>
          )}
        </div>
        {/* Simple human-readable match badge instead of a confusing number ring */}
        <div className="doc-match-badge" style={{ background: match.bg, color: match.color, border: `1.5px solid ${match.border}` }}>
          <Ic d={I.check} size={13} />
          {match.text}
        </div>
      </div>

      {/* ── Context pills — tells user WHY this outfit ──────────────────── */}
      <div className="doc-pills">
        <span className="doc-pill doc-pill--wx">
          <Ic d={wxIcon} size={11} /> {wxStr}
        </span>
        {season && (
          <span className="doc-pill doc-pill--season">
            🍁 {season.split('(')[0].trim()}
          </span>
        )}
        {timeOfDay && (
          <span className="doc-pill doc-pill--time">
            {timeOfDay === 'morning' ? '🌅' : timeOfDay === 'afternoon' ? '☀️' : timeOfDay === 'evening' ? '🌆' : '🌙'} {timeOfDay}
          </span>
        )}
        {calEvent?.hasEvent && (
          <span className="doc-pill doc-pill--event">
            <Ic d={I.calendar} size={11} />
            {calEvent.eventType || 'Event'} · {calEvent.hoursAway}h away
          </span>
        )}
      </div>

      {/* ── Status ribbon ──────────────────────────────────────────────── */}
      {isDone && (
        <div className={`doc-ribbon doc-ribbon--${currentStatus}`}>
          {currentStatus === 'worn'     && <><Ic d={I.check} size={12} /> You wore this today</>}
          {currentStatus === 'liked'    && <><Ic d={I.heart} size={12} /> Liked</>}
          {currentStatus === 'saved'    && <><Ic d={I.heart} size={12} /> Saved to your outfits</>}
          {currentStatus === 'disliked' && <><Ic d={I.x}     size={12} /> Skipped — new outfit tomorrow</>}
          {currentStatus === 'skipped'  && <><Ic d={I.x}     size={12} /> Skipped</>}
        </div>
      )}

      {/* ── What to wear ───────────────────────────────────────────────── */}
      <div className="doc-section-label">What to wear</div>
      <div className="doc-items">
        {primaryItems.length === 0 && (
          <div className="doc-items-empty">
            Add items to your wardrobe to get clothing suggestions.
          </div>
        )}
        {primaryItems.map(({ slot, data }) => (
          <div key={slot} className={`doc-item${data.item ? ' doc-item--owned' : ''}`}>
            <span className="doc-item-emoji">{SLOT_EMOJI[slot] || '✨'}</span>
            <div className="doc-item-body">
              <div className="doc-item-name">{data.name || data.suggestion}</div>
              {data.reason && <div className="doc-item-reason">{data.reason}</div>}
            </div>
            {data.item  && <span className="doc-item-badge">In wardrobe</span>}
            {!data.item && data.suggestion && <span className="doc-item-badge doc-item-badge--sug">Suggested</span>}
          </div>
        ))}
      </div>

      {/* ── Accessories ────────────────────────────────────────────────── */}
      {accentItems.length > 0 && (
        <>
          <div className="doc-section-label">Accessories</div>
          <div className="doc-accents">
            {accentItems.map(({ slot, data }) => (
              <div key={slot} className="doc-accent">
                <span className="doc-accent-emoji">{SLOT_EMOJI[slot]}</span>
                <span className="doc-accent-name">{data.name || data.suggestion}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Why this outfit ─────────────────────────────────────────────── */}
      {(explanation.summary || reasonNotes.length > 0) && (
        <div className="doc-why-section">
          <div className="doc-section-label">Why this outfit?</div>
          {explanation.summary && (
            <div className="doc-explanation">
              <div className="doc-exp-icon"><Ic d={I.sparkle} size={12} /></div>
              <p className="doc-exp-text">{explanation.summary}</p>
            </div>
          )}
          {reasonNotes.length > 0 && (
            <div className="doc-reasons">
              {reasonNotes.map((note, i) => (
                <div key={i} className="doc-reason">
                  <span className="doc-reason-icon"><Ic d={I.check} size={10} /></span>
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Styling tips (collapsed by default) ─────────────────────────── */}
      {(tips.length > 0 || styling.colorCombination || styling.hairstyleSuggestion) && (
        <>
          <button className="doc-toggle" onClick={() => setExpanded(p => !p)}>
            <Ic d={expanded ? I.chevUp : I.chev} size={14} />
            {expanded ? 'Hide styling tips' : 'Show styling tips'}
          </button>
          {expanded && (
            <div className="doc-detail">
              {styling.colorCombination && (
                <div className="doc-detail-row">
                  <span className="doc-detail-icon">🎨</span>
                  <div>
                    <div className="doc-detail-head">Color Combination</div>
                    <div className="doc-detail-body">{styling.colorCombination}</div>
                  </div>
                </div>
              )}
              {styling.hairstyleSuggestion && (
                <div className="doc-detail-row">
                  <span className="doc-detail-icon">💆</span>
                  <div>
                    <div className="doc-detail-head">Hairstyle Tip</div>
                    <div className="doc-detail-body">{styling.hairstyleSuggestion}</div>
                  </div>
                </div>
              )}
              {styling.makeupNote && (
                <div className="doc-detail-row">
                  <span className="doc-detail-icon">💄</span>
                  <div>
                    <div className="doc-detail-head">Makeup</div>
                    <div className="doc-detail-body">{styling.makeupNote}</div>
                  </div>
                </div>
              )}
              {styling.layeringAdvice && (
                <div className="doc-detail-row">
                  <span className="doc-detail-icon">🧥</span>
                  <div>
                    <div className="doc-detail-head">Layering</div>
                    <div className="doc-detail-body">{styling.layeringAdvice}</div>
                  </div>
                </div>
              )}
              {tips.length > 0 && (
                <div className="doc-tips">
                  <div className="doc-tips-head">Quick Tips</div>
                  <ul>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      {!isDone && (
        <div className="doc-actions">
          <button className="doc-action doc-action--worn" onClick={() => sendFeedback('worn')}>
            <Ic d={I.check} size={14} /> I'm wearing this
          </button>
          <button className="doc-action doc-action--save" onClick={() => sendFeedback('saved')}>
            <Ic d={I.heart} size={14} /> Save outfit
          </button>
          <button className="doc-action doc-action--skip" onClick={() => sendFeedback('disliked')}>
            <Ic d={I.x} size={14} /> Not today
          </button>
        </div>
      )}

      <div className="doc-secondary-actions">
        <button className="doc-sec-btn" onClick={regenerate}>
          <Ic d={I.refresh} size={13} /> Try another outfit
        </button>
        <button className="doc-sec-btn" onClick={() => onNavigate('ai')}>
          <Ic d={I.wand} size={13} /> Ask AI stylist
        </button>
      </div>

    </div>
  );
}
