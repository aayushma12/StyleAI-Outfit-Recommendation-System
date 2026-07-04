import React, { useState } from 'react';
import { getMatchBadge, getMeterColor } from '../utils/confidenceScale';
import './XAIPanel.css';

// Fallback only — used if GET /recommendations/weights hasn't resolved yet.
// The real values (single source of truth: scoringService.js CATEGORY_WEIGHTS)
// are fetched once by RecommendationPanel and passed down as a prop, so this
// component never silently drifts out of sync with the backend again.
const FALLBACK_WEIGHTS = {
  styleMatch: 0.15, colorHarmony: 0.13, colorPref: 0.13, occasionFit: 0.14,
  weatherFit: 0.14, behaviorSignal: 0.10, bodyTypeMatch: 0.08, fabricMatch: 0.08, trendScore: 0.05,
};

const SCORE_TO_WEIGHT_KEY = {
  styleMatch:      'styleMatch',
  colorHarmony:    'colorHarmony',
  colorPreference: 'colorPref',
  occasionFit:     'occasionFit',
  weatherFit:      'weatherFit',
  behaviorSignal:  'behaviorSignal',
  bodyTypeMatch:   'bodyTypeMatch',
  fabricMatch:     'fabricMatch',
  trendScore:      'trendScore',
};

const DIMENSION_LABELS = {
  styleMatch:      'Style Match',
  colorHarmony:    'Color Harmony',
  colorPreference: 'Color Preference',
  occasionFit:     'Occasion Fit',
  weatherFit:      'Weather Fit',
  behaviorSignal:  'AI Learning',
  bodyTypeMatch:   'Body Type',
  fabricMatch:     'Fabric Match',
  trendScore:      'Trend Score',
};

const DIMENSION_COLORS = [
  '#0D9488', '#D97706', '#0891B2', '#7C3AED',
  '#059669', '#EA580C', '#0284C7', '#9333EA', '#E11D48',
];

const RADAR_DIMS = [
  { key: 'styleMatch',      label: 'Style Match'   },
  { key: 'colorHarmony',    label: 'Color Harmony' },
  { key: 'colorPreference', label: 'Color Pref.'   },
  { key: 'occasionFit',     label: 'Occasion Fit'  },
  { key: 'weatherFit',      label: 'Weather Fit'   },
  { key: 'behaviorSignal',  label: 'AI Learning'   },
  { key: 'bodyTypeMatch',   label: 'Body Type'     },
  { key: 'fabricMatch',     label: 'Fabric Match'  },
  { key: 'trendScore',      label: 'Trend Score'   },
];

function computeContributions(scores, category, allWeights) {
  const weights = (allWeights && allWeights[category]) || (allWeights && allWeights.best_match) || FALLBACK_WEIGHTS;

  const items = Object.entries(SCORE_TO_WEIGHT_KEY).map(([scoreKey, weightKey]) => {
    const score  = (scores[scoreKey] ?? 50) / 100;
    const weight = weights[weightKey] || 0;
    return { scoreKey, label: DIMENSION_LABELS[scoreKey], score: scores[scoreKey] ?? 50, weight, weighted: score * weight };
  });

  const total = items.reduce((s, i) => s + i.weighted, 0) || 1;

  return items.map(i => ({
    ...i,
    contribution: Math.round((i.weighted / total) * 100),
  })).sort((a, b) => b.contribution - a.contribution);
}


function RadarChart({ scores, size = 230 }) {
  const N  = RADAR_DIMS.length;
  const cx = size / 2;
  const cy = size / 2;
  const R  = size / 2 - 40;

  const dims = RADAR_DIMS.map((d, i) => {
    const angle = (2 * Math.PI * i / N) - Math.PI / 2;
    const val   = (scores[d.key] ?? 50) / 100;
    const cos   = Math.cos(angle);
    const sin   = Math.sin(angle);
    return {
      ...d,
      angle, cos, sin,
      ox: cx + R * cos,
      oy: cy + R * sin,
      px: cx + R * val * cos,
      py: cy + R * val * sin,
      lx: cx + (R + 28) * cos,
      ly: cy + (R + 28) * sin,
      anchor: Math.abs(cos) < 0.12 ? 'middle' : cos > 0 ? 'start' : 'end',
    };
  });

  const ringPath = (pct) =>
    dims.map((d, i) => `${i === 0 ? 'M' : 'L'}${cx + R * pct * d.cos},${cy + R * pct * d.sin}`).join(' ') + ' Z';

  const dataPath =
    dims.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.px},${d.py}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <path key={pct} d={ringPath(pct)} fill="none" stroke="var(--border-subtle, #E5E7EB)" strokeWidth={pct === 1 ? 1.2 : 0.7} />
      ))}
      {[25, 50, 75].map(pct => (
        <text key={pct} x={cx + 3} y={cy - R * (pct / 100) - 2}
          fontSize={7} fill="var(--text-muted, #9CA3AF)" textAnchor="start">
          {pct}
        </text>
      ))}
      {dims.map((d, i) => (
        <line key={i} x1={cx} y1={cy} x2={d.ox} y2={d.oy}
          stroke="var(--border-subtle, #E5E7EB)" strokeWidth={0.7} />
      ))}
      <path d={dataPath} fill="rgba(13,148,136,0.13)" stroke="#0D9488" strokeWidth={2} strokeLinejoin="round" />
      {dims.map((d, i) => (
        <circle key={i} cx={d.px} cy={d.py} r={3.5}
          fill={DIMENSION_COLORS[i % DIMENSION_COLORS.length]} stroke="#fff" strokeWidth={1.5} />
      ))}
      {dims.map((d, i) => (
        <text key={i} x={d.lx} y={d.ly} textAnchor={d.anchor}
          dominantBaseline="middle" fontSize={8.5}
          fill="var(--text-secondary, #374151)" fontWeight={600}>
          {d.label}
        </text>
      ))}
      {dims.map((d) => {
        const score = scores[d.key] ?? 50;
        if (score < 30) return null;
        const offX = d.cos * 9;
        const offY = d.sin * 9;
        return (
          <text key={d.key} x={d.px + offX} y={d.py + offY}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={7.5} fill="#0D9488" fontWeight={700}>
            {score}
          </text>
        );
      })}
    </svg>
  );
}

const Ic = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  brain:     'M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7H4a2 2 0 00-2 2v0a2 2 0 002 2h.5A2.5 2.5 0 017 13.5v0A2.5 2.5 0 019.5 16H10a2 2 0 002-2v-4a2 2 0 00-2-2h-.5zM14.5 2A2.5 2.5 0 0117 4.5v0A2.5 2.5 0 0119.5 7H20a2 2 0 012 2v0a2 2 0 01-2 2h-.5A2.5 2.5 0 0117 13.5v0A2.5 2.5 0 0114.5 16H14a2 2 0 01-2-2v-4a2 2 0 012-2h.5z',
  chev_down: 'M6 9l6 6 6-6',
  chev_up:   'M18 15l-6-6-6 6',
  sparkle:   'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
};

export function XAIPanel({ rec, weights }) {
  const [expanded, setExpanded] = useState(false);

  const scores       = rec.scores || {};
  const contributions = computeContributions(scores, rec.category, weights);
  const confLevel    = getMatchBadge(rec.confidence || 75);
  const confidence   = rec.confidence || 75;

  return (
    <div className="xai-panel">
      <button className="xai-toggle" onClick={() => setExpanded(p => !p)}>
        <Ic d={I.brain} size={13} />
        <span>Feature Contribution Analysis</span>
        <span className="xai-conf-inline" style={{ background: confLevel.color + '18', color: confLevel.color }}>
          {confLevel.label} Confidence
        </span>
        <Ic d={expanded ? I.chev_up : I.chev_down} size={13} />
      </button>

      {expanded && (
        <div className="xai-body">
          <div className="xai-summary-row">
            <div className="xai-metric">
              <span className="xai-metric-label">Confidence Level</span>
              <span className="xai-metric-badge" style={{ background: confLevel.color + '18', color: confLevel.color }}>
                {confLevel.label} · {confidence}%
              </span>
            </div>
            <div className="xai-metric">
              <span className="xai-metric-label">Weighted Match Score</span>
              <div className="xai-quality-wrap">
                <div className="xai-quality-bar">
                  <div
                    className="xai-quality-fill"
                    style={{ width: `${confidence}%`, background: getMeterColor(confidence) }}
                  />
                </div>
                <span className="xai-quality-val" style={{ color: getMeterColor(confidence) }}>{confidence}%</span>
              </div>
            </div>
            {typeof rec.mlAcceptanceProbability === 'number' && (
              <div className="xai-metric">
                <span className="xai-metric-label">ML Acceptance Model</span>
                <span className="xai-metric-badge" style={{ background: '#0D948818', color: '#0D9488' }}>
                  {Math.round(rec.mlAcceptanceProbability * 100)}% of similar past picks were kept
                </span>
              </div>
            )}
          </div>

          <p className="xai-note" style={{ marginTop: 0 }}>
            {rec.explanationSource === 'llm_polished'
              ? 'Explanation text was AI-polished for tone — every number above comes directly from the scoring engine, not the AI.'
              : 'Explanation text is generated directly from the scoring engine (template mode) — no AI language model was used for this session\'s wording.'}
          </p>

          <div className="xai-radar-wrap">
            <div className="xai-radar-title">9-Dimension Score Radar</div>
            <RadarChart scores={scores} />
          </div>

          <div className="xai-contrib-header">
            <Ic d={I.sparkle} size={12} />
            <span>What drove this recommendation</span>
          </div>

          <div className="xai-contrib-chart">
            {contributions.map((c, i) => (
              <div key={c.scoreKey} className="xai-contrib-row">
                <span className="xai-contrib-label">{c.label}</span>
                <div className="xai-contrib-bar-wrap">
                  <div
                    className="xai-contrib-bar"
                    style={{
                      width: `${c.contribution}%`,
                      background: DIMENSION_COLORS[i % DIMENSION_COLORS.length],
                    }}
                  />
                </div>
                <span className="xai-contrib-pct">{c.contribution}%</span>
              </div>
            ))}
          </div>

          <p className="xai-note">
            Contribution percentages are computed as <em>(score × category weight) / total</em>, showing which factors most influenced this recommendation.
          </p>
        </div>
      )}
    </div>
  );
}
