import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getMeterColor } from '../utils/confidenceScale';
import './InsightsPanel.css';

const Ic = ({ d, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const I = {
  brain:    'M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7H4a2 2 0 00-2 2v0a2 2 0 002 2h.5A2.5 2.5 0 017 13.5v0A2.5 2.5 0 019.5 16H10a2 2 0 002-2v-4a2 2 0 00-2-2h-.5zM14.5 2A2.5 2.5 0 0117 4.5v0A2.5 2.5 0 0119.5 7H20a2 2 0 012 2v0a2 2 0 01-2 2h-.5A2.5 2.5 0 0117 13.5v0A2.5 2.5 0 0114.5 16H14a2 2 0 01-2-2v-4a2 2 0 012-2h.5z',
  sparkle:  'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
  trending: 'M23 6l-9.5 9.5-5-5L1 18',
  user:     ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2', 'M12 11a4 4 0 100-8 4 4 0 000 8z'],
  check:    'M20 6L9 17l-5-5',
  palette:  'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14.5v-9l7 4.5-7 4.5z',
  tag:      'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z',
  star:     'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  hanger:   'M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z',
  refresh:  'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  warning:  'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  lightbulb:'M9 21h6M12 3a6 6 0 016 6c0 2.97-2.17 5.43-5 5.91V17H11v-2.09C8.17 14.43 6 11.97 6 9a6 6 0 016-6z',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  wardrobe: 'M4 21V7c0-1.1.9-2 2-2h12a2 2 0 012 2v14M4 21h16M8 21v-4h8v4',
};

// Matches all color names from ColorPreferencePicker shades
const COLOR_MAP = {
  // Reds & Pinks
  'Blush': '#ffd6e7', 'Baby Pink': '#ffb3c6', 'Soft Pink': '#ff8fab', 'Hot Pink': '#f72585',
  'Rose': '#fb7185', 'Coral': '#ff6b6b', 'Red': '#ef4444', 'Crimson': '#dc143c',
  'Maroon': '#800000', 'Burgundy': '#800020',
  // Oranges
  'Peach': '#ffcba4', 'Apricot': '#fbceb1', 'Salmon': '#fa8072', 'Terracotta': '#c47c5a',
  'Orange': '#f97316', 'Burnt Orange': '#cc5500', 'Rust': '#b7410e', 'Brick Red': '#9e2a2b',
  // Yellows & Golds
  'Cream': '#fffbeb', 'Champagne': '#f7e7ce', 'Lemon': '#fff176', 'Yellow': '#eab308',
  'Gold': '#ffd700', 'Amber': '#d97706', 'Mustard': '#ca8a04', 'Saffron': '#ff9933',
  // Greens
  'Mint': '#a7f3d0', 'Sage': '#87ae73', 'Lime': '#84cc16', 'Green': '#22c55e',
  'Emerald': '#10b981', 'Forest Green': '#16a34a', 'Olive': '#808000',
  'Dark Green': '#166534', 'Hunter Green': '#355e3b', 'Bottle Green': '#006a4e',
  // Blues
  'Baby Blue': '#bfdbfe', 'Sky Blue': '#7dd3fc', 'Powder Blue': '#93c5fd',
  'Cornflower': '#6495ed', 'Blue': '#3b82f6', 'Royal Blue': '#4169e1',
  'Cobalt': '#0047ab', 'Navy': '#1e3a5f', 'Midnight Blue': '#191970',
  // Purples
  'Lavender': '#e9d5ff', 'Lilac': '#c084fc', 'Mauve': '#d8b4fe', 'Orchid': '#da70d6',
  'Violet': '#8b5cf6', 'Purple': '#a855f7', 'Amethyst': '#9966cc',
  'Plum': '#8e4585', 'Indigo': '#4b0082',
  // Teals & Aquas
  'Aqua': '#a5f3fc', 'Turquoise': '#2dd4bf', 'Teal': '#14b8a6', 'Cyan': '#06b6d4',
  'Persian Green': '#00a693', 'Dark Teal': '#0d9488', 'Peacock Blue': '#005f6b',
  // Browns & Tans
  'Ivory': '#fffff0', 'Beige': '#d4b896', 'Tan': '#d2b48c', 'Camel': '#c19a6b',
  'Khaki': '#c3b091', 'Brown': '#92400e', 'Chocolate': '#7b3f00', 'Espresso': '#4a2912',
  // Neutrals
  'White': '#ffffff', 'Off White': '#fafaf9', 'Pearl': '#f0ece3', 'Silver': '#c0c0c0',
  'Light Gray': '#d1d5db', 'Gray': '#6b7280', 'Dark Gray': '#374151',
  'Charcoal': '#36454f', 'Black': '#1f2937',
  // Pastels
  'Pastel Rose': '#ffd6e7', 'Pastel Peach': '#fde8d8', 'Pastel Yellow': '#fef9c3',
  'Pastel Green': '#bbf7d0', 'Pastel Mint': '#ccfbf1', 'Pastel Blue': '#bfdbfe',
  'Pastel Sky': '#e0f2fe', 'Pastel Purple': '#f3e8ff',
  'Pastel Lavender': '#ede9fe', 'Pastel Lilac': '#fae8ff',
  // Earth Tones
  'Sand': '#c2a882', 'Clay': '#b5651d', 'Sienna': '#a0522d',
  'Umber': '#635147', 'Moss': '#8a9a5b', 'Cedar': '#a0755a', 'Mushroom': '#b5a08c',
  // Jewel Tones
  'Ruby': '#9b111e', 'Garnet': '#733635', 'Sapphire': '#0f52ba',
  'Royal Cobalt': '#0047ab', 'Deep Emerald': '#046a38', 'Jade': '#00a36c',
  'Deep Amethyst': '#6b3fa0', 'Topaz': '#ffc87c', 'Onyx': '#353839',
  // Legacy simple names
  'red': '#EF4444', 'pink': '#EC4899', 'orange': '#F97316', 'yellow': '#EAB308',
  'green': '#22C55E', 'teal': '#14B8A6', 'blue': '#3B82F6', 'purple': '#A855F7',
  'black': '#1F2937', 'white': '#F3F4F6', 'beige': '#D4B896', 'maroon': '#7F1D1D',
  'navy': '#1E3A5F', 'olive': '#808000', 'gold': '#D97706', 'rose': '#FB7185',
  'grey': '#9CA3AF', 'brown': '#92400E', 'cream': '#FFFBEB', 'coral': '#FF7F7F',
};

function colorHex(name) {
  if (!name) return '#9CA3AF';
  return COLOR_MAP[name] || COLOR_MAP[name.toLowerCase()] || '#9CA3AF';
}

function LearningMeter({ score }) {
  const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#0D9488';
  const label = score >= 70 ? 'Well trained' : score >= 40 ? 'Learning' : 'Getting started';
  return (
    <div className="ip-meter">
      <div className="ip-meter-hd">
        <span className="ip-meter-title">AI Learning Score</span>
        <span className="ip-meter-badge" style={{ background: color + '18', color }}>{label}</span>
      </div>
      <div className="ip-meter-track">
        <div className="ip-meter-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="ip-meter-labels">
        <span>0%</span>
        <span style={{ color, fontWeight: 700 }}>{score}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function ProfileMeter({ completeness }) {
  const color = getMeterColor(completeness, { good: 80, warn: 50 });
  return (
    <div className="ip-profile-meter">
      <div className="ip-profile-meter-hd">
        <span>Profile Completeness</span>
        <span style={{ color, fontWeight: 700 }}>{completeness}%</span>
      </div>
      <div className="ip-meter-track">
        <div className="ip-meter-fill" style={{ width: `${completeness}%`, background: color }} />
      </div>
    </div>
  );
}

function CalibrationMeter({ calibration }) {
  if (!calibration) return null;
  const { calibrationScore, isImproving, interpretation } = calibration;
  const color = calibrationScore >= 70 ? '#059669' : calibrationScore >= 45 ? '#D97706' : '#0D9488';
  return (
    <div className="ip-calibration">
      <div className="ip-meter-hd">
        <span className="ip-meter-title">AI Calibration Score</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isImproving && <span className="ip-trend-badge ip-trend-badge--up">↑ Improving</span>}
          <span className="ip-meter-badge" style={{ background: color + '18', color }}>{calibrationScore}%</span>
        </div>
      </div>
      <div className="ip-meter-track">
        <div className="ip-meter-fill" style={{ width: `${calibrationScore}%`, background: color }} />
      </div>
      <p className="ip-calibration-note">{interpretation}</p>
    </div>
  );
}

function WardrobeUtilisation({ report, onNavigate }) {
  if (!report || report.totalItems === 0) return null;
  const { utilizationRate, underusedItems, overusedItems, suggestions } = report;
  const utilColor = getMeterColor(utilizationRate);

  return (
    <div className="ip-card ip-card--full">
      <div className="ip-card-hd"><Ic d={I.wardrobe} size={14} /> Wardrobe Utilisation</div>

      <div className="ip-util-summary">
        <div className="ip-util-stat">
          <span className="ip-util-val" style={{ color: utilColor }}>{utilizationRate}%</span>
          <span className="ip-util-lbl">of wardrobe used in AI recommendations</span>
        </div>
        <div className="ip-util-track">
          <div className="ip-util-fill" style={{ width: `${utilizationRate}%`, background: utilColor }} />
        </div>
      </div>

      {underusedItems?.length > 0 && (
        <div className="ip-underused">
          <div className="ip-underused-hd">Items not suggested recently</div>
          <div className="ip-underused-list">
            {underusedItems.slice(0, 4).map((item, i) => (
              <div key={i} className="ip-underused-item">
                <span className="ip-underused-name">{item.name}</span>
                <span className="ip-underused-meta">{item.category}
                  {item.daysSinceUsed ? ` · ${item.daysSinceUsed}d ago` : ' · never'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions?.length > 0 && (
        <div className="ip-util-suggestions">
          {suggestions.map((s, i) => (
            <div key={i} className="ip-util-tip">
              <span className="ip-util-tip-type">{s.type === 'gap' ? '⚠️' : s.type === 'overused' ? '🔁' : '💡'}</span>
              <div>
                <div className="ip-util-tip-title">{s.title}</div>
                <div className="ip-util-tip-detail">{s.detail}</div>
              </div>
              {s.action && (
                <button className="ip-suggest-btn" onClick={() => onNavigate?.(s.action)}>
                  Go →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PredictiveAlerts({ insights, onNavigate }) {
  if (!insights?.length) return null;
  const urgencyColor = { high: '#DC2626', medium: '#D97706', low: '#059669' };

  return (
    <div className="ip-card ip-card--full">
      <div className="ip-card-hd"><Ic d={I.lightbulb} size={14} /> Predictive Fashion Intelligence</div>
      <div className="ip-alerts">
        {insights.map((alert, i) => (
          <div key={i} className="ip-alert" style={{ borderLeftColor: urgencyColor[alert.urgency] || '#9CA3AF' }}>
            <div className="ip-alert-hd">
              <span className="ip-alert-icon">{alert.icon}</span>
              <div>
                <div className="ip-alert-title">{alert.title}</div>
                <div className="ip-alert-detail">{alert.detail}</div>
              </div>
            </div>
            {alert.action && (
              <button className="ip-suggest-btn ip-suggest-btn--sm" onClick={() => onNavigate?.(alert.action)}>
                {alert.action === 'generate' ? 'Generate →' : alert.action === 'wizard' ? 'Style →' : 'Wardrobe →'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelTransparency({ data }) {
  if (!data) return null;
  const { model, wardrobeMetadataCompleteness, kathmanduTrendsLastUpdated } = data;
  const trained = model?.modelLoaded && typeof model?.accuracy === 'number';

  return (
    <div className="ip-card ip-card--full">
      <div className="ip-card-hd"><Ic d={I.shield} size={14} /> Model Transparency</div>

      {trained ? (
        <div className="ip-stat-grid">
          {[
            { label: 'Model Accuracy',  val: `${Math.round(model.accuracy * 100)}%`, color: '#0D9488' },
            { label: 'Precision',       val: `${Math.round((model.precision || 0) * 100)}%`, color: '#059669' },
            { label: 'Recall',          val: `${Math.round((model.recall || 0) * 100)}%`, color: '#0891B2' },
            { label: 'F1 Score',        val: `${Math.round((model.f1 || 0) * 100)}%`, color: '#7C3AED' },
            { label: 'ROC-AUC',         val: model.rocAuc != null ? model.rocAuc.toFixed(2) : '—', color: '#D97706' },
            { label: 'Training Samples',val: model.trainingSize ?? '—', color: '#DC2626' },
          ].map(s => (
            <div key={s.label} className="ip-stat">
              <span className="ip-stat-val" style={{ color: s.color }}>{s.val}</span>
              <span className="ip-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="ip-neg-note">
          {model?.reachable === false
            ? 'The ML acceptance-prediction service is currently unreachable — recommendations still work using the deterministic scoring engine alone.'
            : 'The acceptance-prediction model hasn\'t been trained yet (needs real usage data). Recommendations still work using the deterministic scoring engine alone.'}
        </p>
      )}

      <div className="ip-util-summary" style={{ marginTop: 14 }}>
        <div className="ip-util-stat">
          <span className="ip-util-val" style={{ color: wardrobeMetadataCompleteness >= 60 ? '#059669' : '#D97706' }}>
            {wardrobeMetadataCompleteness}%
          </span>
          <span className="ip-util-lbl">of your wardrobe has AI-extracted metadata (colors, style, fit)</span>
        </div>
        <div className="ip-util-track">
          <div className="ip-util-fill" style={{ width: `${wardrobeMetadataCompleteness}%`, background: wardrobeMetadataCompleteness >= 60 ? '#059669' : '#D97706' }} />
        </div>
      </div>

      {kathmanduTrendsLastUpdated && (
        <p className="ip-calibration-note">
          Kathmandu fashion trends last updated {new Date(kathmanduTrendsLastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
        </p>
      )}
    </div>
  );
}

function NegativeSignals({ negSig }) {
  if (!negSig?.hasNegativeHistory) return null;
  return (
    <div className="ip-card">
      <div className="ip-card-hd"><Ic d={I.shield} size={14} /> What the AI Avoids for You</div>
      <p className="ip-neg-note">Learned from {negSig.rejectCount} rejected outfit{negSig.rejectCount !== 1 ? 's' : ''}.</p>
      {negSig.avoidColors?.length > 0 && (
        <div className="ip-neg-section">
          <div className="ip-neg-label">Avoided colors</div>
          <div className="ip-colors">
            {negSig.avoidColors.map(c => (
              <div key={c} className="ip-color-item">
                <div className="ip-color-dot ip-color-dot--avoid"
                  style={{ background: colorHex(c), boxShadow: 'inset 0 0 0 2px rgba(220,38,38,0.5)' }} />
                <span className="ip-color-name">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {negSig.avoidCategories?.length > 0 && (
        <div className="ip-neg-section">
          <div className="ip-neg-label">Avoided categories</div>
          <div className="ip-chips">
            {negSig.avoidCategories.map(c => (
              <span key={c} className="ip-chip ip-chip--avoid">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsightsPanel({ onNavigate }) {
  const [insightsData, setInsightsData] = useState(null);
  const [analytics,    setAnalytics]    = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error,   setError]             = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/recommendations/insights'),
      api.get('/recommendations/analytics').catch(() => ({ data: null })),
    ])
      .then(([insR, anaR]) => {
        setInsightsData(insR.data);
        setAnalytics(anaR.data);
      })
      .catch(() => setError('Could not load insights. Generate some recommendations first.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return (
      <div className="ip-loading">
        <div className="ip-loading-icon"><Ic d={I.brain} size={28} /></div>
        <span>Analysing your style data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ip-error">
        <Ic d={I.sparkle} size={22} />
        <p>{error}</p>
      </div>
    );
  }

  const { insights, profileCompleteness, suggestions, summaryPhrases, learningScore } = insightsData || {};
  const stats         = insights?.recommendationStats || {};
  const topColors     = insights?.topColors     || [];
  const topCategories = insights?.topCategories || [];
  const topOccasions  = insights?.topOccasions  || [];

  const { wardrobeUtilization, predictiveInsights, calibration, styleNarrative, negativeSignals, modelTransparency } = analytics || {};

  return (
    <div className="ip-panel">
      <div className="ip-panel-hd">
        <div className="ip-panel-hd-left">
          <div className="ip-panel-icon"><Ic d={I.brain} size={18} /></div>
          <div>
            <div className="ip-panel-title">My Style Insights</div>
            <div className="ip-panel-sub">How StyleAI understands your fashion preferences</div>
          </div>
        </div>
        <button className="ip-refresh-btn" onClick={load}>
          <Ic d={I.refresh} size={13} /> Refresh
        </button>
      </div>

      <div className="ip-grid">

        {/* Learning Score + Profile + Calibration */}
        <div className="ip-card ip-card--full">
          <LearningMeter score={learningScore || 0} />
          <ProfileMeter completeness={profileCompleteness || 0} />
          {calibration && <CalibrationMeter calibration={calibration} />}
          {profileCompleteness < 80 && (
            <p className="ip-complete-hint">
              Complete your style profile to improve AI recommendation accuracy.
              <button className="ip-link-btn" onClick={() => onNavigate?.('profile')}>Update profile →</button>
            </p>
          )}
        </div>

        {/* Style Narrative from analytics */}
        {styleNarrative && (
          <div className="ip-card ip-card--full ip-card--narrative">
            <div className="ip-card-hd"><Ic d={I.sparkle} size={14} /> Your Style Story</div>
            <p className="ip-narrative">{styleNarrative}</p>
          </div>
        )}

        {/* Predictive Intelligence */}
        {predictiveInsights?.length > 0 && (
          <PredictiveAlerts insights={predictiveInsights} onNavigate={onNavigate} />
        )}

        {/* Style Summary Phrases */}
        {summaryPhrases?.length > 0 && (
          <div className="ip-card">
            <div className="ip-card-hd"><Ic d={I.sparkle} size={14} /> Style Personality</div>
            <div className="ip-phrases">
              {summaryPhrases.map((p, i) => (
                <div key={i} className="ip-phrase">
                  <span className="ip-phrase-dot" />
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="ip-card">
          <div className="ip-card-hd"><Ic d={I.trending} size={14} /> Recommendation Stats</div>
          <div className="ip-stat-grid">
            {[
              { label: 'Total Sessions',     val: stats.total            || 0,   color: '#0D9488' },
              { label: 'Accepted',           val: stats.accepted         || 0,   color: '#059669' },
              { label: 'Rejected',           val: stats.rejected         || 0,   color: '#DC2626' },
              { label: 'Saved',              val: stats.saved            || 0,   color: '#0891B2' },
              { label: 'Acceptance Rate',    val: `${stats.acceptRate ?? 0}%`,   color: '#7C3AED' },
              { label: 'Total Interactions', val: insights?.totalInteractions || 0, color: '#D97706' },
            ].map(s => (
              <div key={s.label} className="ip-stat">
                <span className="ip-stat-val" style={{ color: s.color }}>{s.val}</span>
                <span className="ip-stat-lbl">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Color Preferences */}
        {topColors.length > 0 && (
          <div className="ip-card">
            <div className="ip-card-hd"><Ic d={I.palette} size={14} /> Your Colour Palette</div>
            <div className="ip-colors">
              {topColors.map(c => (
                <div key={c} className="ip-color-item">
                  <div
                    className="ip-color-dot"
                    style={{
                      background: colorHex(c),
                      boxShadow: c.toLowerCase() === 'white' ? 'inset 0 0 0 1px #D1D5DB' : 'none',
                    }}
                  />
                  <span className="ip-color-name">{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Negative Signals */}
        {negativeSignals && <NegativeSignals negSig={negativeSignals} />}

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <div className="ip-card">
            <div className="ip-card-hd"><Ic d={I.hanger} size={14} /> Favourite Categories</div>
            <div className="ip-chips">
              {topCategories.map(c => (
                <span key={c} className="ip-chip ip-chip--cat">{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Top Occasions */}
        {topOccasions.length > 0 && (
          <div className="ip-card">
            <div className="ip-card-hd"><Ic d={I.tag} size={14} /> Common Occasions</div>
            <div className="ip-chips">
              {topOccasions.map(o => (
                <span key={o} className="ip-chip ip-chip--occ">{o}</span>
              ))}
            </div>
          </div>
        )}

        {/* Wardrobe Utilisation */}
        {wardrobeUtilization && (
          <WardrobeUtilisation report={wardrobeUtilization} onNavigate={onNavigate} />
        )}

        {/* Model Transparency — real ML metrics, wardrobe AI-tagging coverage, trend freshness */}
        {modelTransparency && <ModelTransparency data={modelTransparency} />}

        {/* Improvement Suggestions */}
        {suggestions?.length > 0 && (
          <div className="ip-card ip-card--full ip-card--suggest">
            <div className="ip-card-hd"><Ic d={I.star} size={14} /> AI Improvement Suggestions</div>
            <div className="ip-suggestions">
              {suggestions.map((s, i) => (
                <div key={i} className="ip-suggestion">
                  <span className="ip-suggest-icon">{s.icon}</span>
                  <span className="ip-suggest-text">{s.text}</span>
                  {s.action && (
                    <button className="ip-suggest-btn" onClick={() => onNavigate?.(s.action)}>
                      Go →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No data state */}
        {summaryPhrases?.length === 0 && suggestions?.length === 0 && stats.total === 0 && (
          <div className="ip-card ip-card--full ip-empty">
            <Ic d={I.sparkle} size={28} />
            <div className="ip-empty-title">Not enough data yet</div>
            <p>Generate AI outfit recommendations and interact with them to build up your style profile.</p>
            <button className="ip-cta" onClick={() => onNavigate?.('overview')}>
              Generate Recommendations →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
