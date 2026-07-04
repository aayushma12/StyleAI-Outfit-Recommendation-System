import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import './OutfitBuilder.css';

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);
const IC = {
  hanger:   'M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z',
  plus:     'M12 5v14m-7-7h14',
  x:        'M18 6L6 18M6 6l12 12',
  save:     'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zm-7-1v-8H7v8',
  trash:    'M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  check:    'M20 6L9 17l-5-5',
  refresh:  'M23 4v6h-6M1 20v-6h6m16.49-8A9 9 0 0015 3a9 9 0 00-8.06 5M1.51 16A9 9 0 009 21a9 9 0 008.06-5',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  layers:   'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  eye:      'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11-3a3 3 0 100 6 3 3 0 000-6z',
  edit:     'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.41-9.41a2 2 0 112.83 2.83L11.83 15H9v-2.83z',
  copy:     'M8 17H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v3m-1 11h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  shirt:    'M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z',
  warn:     'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01',
};

const CATEGORY_TABS = [
  { key: 'all',         label: 'All'         },
  { key: 'tops',        label: 'Tops'        },
  { key: 'bottoms',     label: 'Bottoms'     },
  { key: 'dresses',     label: 'Dresses'     },
  { key: 'jackets',     label: 'Outerwear'   },
  { key: 'footwear',    label: 'Footwear'    },
  { key: 'accessories', label: 'Accessories' },
  { key: 'traditional', label: 'Traditional' },
];
const TAB_CATEGORIES = {
  all:         null,
  tops:        ['tops'],
  bottoms:     ['bottoms'],
  dresses:     ['dresses'],
  jackets:     ['jackets'],
  footwear:    ['footwear'],
  accessories: ['accessories'],
  traditional: ['traditional', 'traditional wear'],
};
const CATEGORY_TO_LAYER = {
  'tops':             'tops',
  'bottoms':          'bottoms',
  'dresses':          'dress',
  'jackets':          'outerwear',
  'footwear':         'footwear',
  'accessories':      'accessories',
  'traditional':      'traditional',
  'traditional wear': 'traditional',
};

const LAYER_LIMITS = {
  tops:        2,   // base layer + 1 mid-layer (sweater, turtleneck, etc.)
  bottoms:     1,
  dress:       1,
  traditional: 1,
  outerwear:   3,   // jacket + blazer + coat
  footwear:    1,
  accessories: 8,   // watch, bag, necklace, belt, scarf, sunglasses, hat…
};
const LAYER_META = {
  tops:        { label: 'Top',         bg: '#EDE9FE', tc: '#5B21B6', multi: false },
  bottoms:     { label: 'Bottom',      bg: '#FEF3C7', tc: '#92400E', multi: false },
  dress:       { label: 'Dress',       bg: '#FCE7F3', tc: '#9D174D', multi: false },
  outerwear:   { label: 'Outerwear',   bg: '#D1FAE5', tc: '#065F46', multi: true  },
  footwear:    { label: 'Footwear',    bg: '#DBEAFE', tc: '#1E40AF', multi: false },
  accessories: { label: 'Accessories', bg: '#FEF9C3', tc: '#713F12', multi: true  },
  traditional: { label: 'Traditional', bg: '#FFE4E6', tc: '#9F1239', multi: false },
};

const makeEmptyMap = () => ({
  tops: [], bottoms: [], dress: [], traditional: [],
  outerwear: [], footwear: [], accessories: [],
});

const OCCASIONS = ['daily','college','office','festival','wedding','party','casual_outing','religious','sports','travel','formal'];
const SEASONS   = ['summer','winter','monsoon','spring','all'];

const cap      = s => (s || '').charAt(0).toUpperCase() + (s || '').slice(1).replace(/_/g, ' ');
const scoreCol = s => s >= 82 ? '#059669' : s >= 62 ? '#D97706' : '#0891B2';
const flatItems = map => Object.values(map).flat().filter(Boolean);

const COLOR_GROUPS = {
  neutral: ['white','black','grey','gray','beige','cream','ivory','nude','tan','khaki','silver','charcoal','off-white'],
  warm:    ['red','orange','yellow','coral','peach','gold','mustard','rust','burgundy','maroon','brown','camel','copper','terracotta'],
  cool:    ['blue','navy','purple','violet','indigo','teal','mint','turquoise','lavender','lilac','cyan','cobalt','sage'],
  pastel:  ['blush','rose','pink','baby blue','powder','mauve'],
};
function colorGroup(c) {
  const cl = (c || '').toLowerCase();
  for (const [g, cols] of Object.entries(COLOR_GROUPS))
    if (cols.some(x => cl.includes(x))) return g;
  return 'other';
}
function scoreColor(items) {
  const cs = items.map(i => i.color).filter(Boolean);
  if (cs.length <= 1) return 88;
  const gs   = cs.map(colorGroup);
  const nonN = gs.filter(g => g !== 'neutral');
  if (nonN.length === 0) return 97;
  const uniq = new Set(nonN);
  if (uniq.size === 1) return gs.some(g => g === 'neutral') ? 93 : 86;
  if ([...uniq].every(g => g === 'warm'))              return 82;
  if ([...uniq].every(g => ['cool','pastel'].includes(g))) return 80;
  if (uniq.size === 2) return 66;
  return Math.max(38, 88 - (uniq.size - 1) * 20);
}
const SEASON_MAP = {
  summer:  ['summer','all','spring'],
  winter:  ['winter','all'],
  monsoon: ['monsoon','all','summer'],
  spring:  ['spring','all','summer'],
  all:     ['summer','winter','monsoon','spring','all'],
};
function scoreSeason(items) {
  const ss = items.map(i => (i.season || '').toLowerCase()).filter(Boolean);
  if (!ss.length) return 72;
  if (ss.every(s => s === 'all')) return 96;
  if (new Set(ss).size === 1) return 94;
  let ok = true;
  for (let a = 0; a < ss.length && ok; a++)
    for (let b = a + 1; b < ss.length && ok; b++)
      if (!SEASON_MAP[ss[a]]?.includes(ss[b])) ok = false;
  return ok ? 80 : 48;
}
function scoreOccasion(items) {
  const oc = items.map(i => (i.occasion || '').toLowerCase()).filter(Boolean);
  if (!oc.length) return 70;
  const u = new Set(oc);
  if (u.size === 1) return 95;
  return Math.max(42, 95 - (u.size - 1) * 24);
}
function scoreCompleteness(map) {
  const hasFull = map.dress.length > 0 || map.traditional.length > 0;
  let n = 0;
  if (map.tops.length || hasFull)      n++;
  if (map.bottoms.length || hasFull)   n++;
  if (map.footwear.length)             n++;
  if (map.outerwear.length)            n++;
  if (map.accessories.length)          n++;
  // Bonus for layering depth
  const layerBonus = Math.min(map.outerwear.length - 1, 1) * 5 +
                     Math.min(map.tops.length - 1, 1) * 3 +
                     Math.min(map.accessories.length, 3) * 2;
  return Math.min(100, Math.round((n / 5) * 100) + layerBonus);
}
function computeScores(map) {
  const items = flatItems(map);
  if (!items.length) return null;
  const color   = scoreColor(items);
  const season  = scoreSeason(items);
  const occ     = scoreOccasion(items);
  const comp    = scoreCompleteness(map);
  const overall = Math.round(color * 0.30 + season * 0.20 + occ * 0.20 + comp * 0.30);
  return { color, season, occasion: occ, completeness: comp, overall };
}
function buildReasons(map, overall) {
  const s = computeScores(map);
  const r = [];
  if (s?.color >= 85)               r.push('Harmonious color palette');
  else if (s?.color >= 70)          r.push('Compatible color pairing');
  if (s?.season >= 85)              r.push('Seasonally cohesive combination');
  if (s?.occasion >= 85)            r.push('Occasion-appropriate styling');
  if (map.outerwear.length >= 2)    r.push(`${map.outerwear.length}-layer outerwear combination`);
  if (map.accessories.length >= 3)  r.push('Richly accessorized ensemble');
  if (s?.completeness >= 80)        r.push('Complete, well-layered outfit');
  if (overall >= 85)                r.push('Exceptional overall composition');
  return r.slice(0, 3);
}
function getInsights(map, scores) {
  if (!scores) return [];
  const ins = [];
  if (scores.color >= 85)
    ins.push({ text: 'Color palette is well-coordinated across all layers', type: 'positive' });
  else if (scores.color < 60)
    ins.push({ text: 'Consider matching color families for better cohesion', type: 'tip' });
  if (scores.season >= 88)
    ins.push({ text: 'All layers are seasonally compatible', type: 'positive' });
  else if (scores.season < 55)
    ins.push({ text: 'Some layers span different seasons — check compatibility', type: 'tip' });
  if (map.outerwear.length >= 2)
    ins.push({ text: `Great layering: ${map.outerwear.length} outerwear pieces`, type: 'positive' });
  if (!map.footwear.length && flatItems(map).length >= 2)
    ins.push({ text: 'Add footwear to complete the look', type: 'tip' });
  if (!map.accessories.length && flatItems(map).length >= 2)
    ins.push({ text: 'Accessories can elevate this outfit further', type: 'neutral' });
  if (map.accessories.length >= 4)
    ins.push({ text: 'Richly accessorized — ensure pieces complement each other', type: 'neutral' });
  return ins.slice(0, 3);
}

function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3400); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`ob-toast ob-toast--${type}`}>
      <span className="ob-toast-icon">{type === 'success' ? '✓' : type === 'warn' ? '⚠' : '✕'}</span>
      <span>{msg}</span>
    </div>
  );
}

function MetricBar({ label, value }) {
  const col = scoreCol(value);
  return (
    <div className="ob-metric">
      <div className="ob-metric-row">
        <span className="ob-metric-lbl">{label}</span>
        <span className="ob-metric-val" style={{ color: col }}>{value}%</span>
      </div>
      <div className="ob-metric-track">
        <div className="ob-metric-fill" style={{ width: `${value}%`, background: col }}/>
      </div>
    </div>
  );
}

function InsightRow({ insight }) {
  const marks = { positive: '✓', tip: '→', neutral: '◦' };
  return (
    <div className={`ob-insight ob-insight--${insight.type}`}>
      <span className="ob-insight-ic">{marks[insight.type]}</span>
      <span className="ob-insight-txt">{insight.text}</span>
    </div>
  );
}

function ScoreRing({ value }) {
  const R = 26, CX = 32, CY = 32, SW = 6;
  const circ = 2 * Math.PI * R;
  const arc  = (value / 100) * circ;
  const col  = scoreCol(value);
  return (
    <svg className="ob-score-ring" viewBox="0 0 64 64" aria-label={`Score ${value}`}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg-main,#EDE9FE)" strokeWidth={SW}/>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={col} strokeWidth={SW}
              strokeDasharray={`${arc.toFixed(1)} ${circ.toFixed(1)}`}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}/>
      <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: '14px', fontWeight: '800', fill: col }}>{value}</text>
    </svg>
  );
}

function ColorPalette({ map }) {
  const swatches = flatItems(map)
    .map(i => ({ color: i.color, name: i.name }))
    .filter(({ color }) => color);
  if (!swatches.length) return null;
  const bg = c => ['white','cream','ivory','off-white'].some(k => (c||'').toLowerCase().includes(k))
    ? '#E9E8E5' : (c || '#ccc');
  return (
    <div className="ob-palette">
      <span className="ob-palette-lbl">Palette</span>
      <div className="ob-palette-dots">
        {swatches.map(({ color, name }, i) => (
          <div key={i} className="ob-palette-dot"
               style={{ background: bg(color) }} title={`${name} — ${color}`}/>
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item, layerKey, size = 'md', onRemove }) {
  const meta = LAYER_META[layerKey] || {};
  return (
    <div className={`ob-icard ob-icard--${size}`}>
      <div className="ob-icard-img">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} className="ob-icard-photo" loading="lazy"/>
          : <div className="ob-icard-noph"><Icon d={IC.hanger} size={size === 'xs' ? 12 : 18}/></div>
        }
        <button className="ob-icard-rm" onClick={() => onRemove(layerKey, item._id)}
                aria-label={`Remove ${item.name}`}>
          <Icon d={IC.x} size={9}/>
        </button>
      </div>
      <div className="ob-icard-info">
        <span className="ob-icard-badge" style={{ background: meta.bg, color: meta.tc }}>
          {meta.label}
        </span>
        <span className="ob-icard-name" title={item.name}>{item.name}</span>
        {item.color && (
          <span className="ob-icard-dot"
                style={{ background: ['white','cream','ivory'].some(k => (item.color||'').toLowerCase().includes(k)) ? '#E5E7EB' : item.color }}
                title={item.color}/>
        )}
      </div>
    </div>
  );
}

function AddCard({ label, hint, onClick, size = 'md' }) {
  return (
    <button className={`ob-addcard ob-addcard--${size}`} onClick={onClick} type="button">
      <div className="ob-addcard-icon">
        <Icon d={IC.plus} size={size === 'xs' ? 12 : 16}/>
      </div>
      {size !== 'xs' && <span className="ob-addcard-lbl">{label}</span>}
      {hint && size !== 'xs' && <span className="ob-addcard-hint">{hint}</span>}
    </button>
  );
}

function OutfitBoard({ map, onRemove, onJumpToTab }) {
  const hasFull  = map.dress.length > 0 || map.traditional.length > 0;
  const selCount = flatItems(map).length;

  return (
    <div className="ob-board">
      <div className="ob-board-hd">
        <h2 className="ob-board-title">Outfit Preview</h2>
        {selCount > 0
          ? <span className="ob-board-badge">{selCount} piece{selCount !== 1 ? 's' : ''}</span>
          : <span className="ob-board-hint">Click items to build your layered outfit</span>
        }
      </div>

      <div className="ob-board-body">

        <div className="ob-bsec">
          <div className="ob-bsec-hd">
            <span className="ob-bsec-title">Primary Clothing</span>
            {hasFull && (
              <span className="ob-bsec-tag">Full-body — add outerwear &amp; accessories over it</span>
            )}
            {!hasFull && map.tops.length === 1 && (
              <span className="ob-bsec-tag ob-bsec-tag--tip">Tip: add a second top layer below</span>
            )}
          </div>

          {hasFull ? (
            /* Dress / Traditional */
            <div className="ob-bsec-row">
              {(map.dress.length ? map.dress : map.traditional).map(item => (
                <ItemCard key={item._id} item={item}
                  layerKey={map.dress.length ? 'dress' : 'traditional'}
                  size="lg" onRemove={onRemove}/>
              ))}
            </div>
          ) : (
            /* Tops + Bottoms layout */
            <div className="ob-bsec-twogroup">
              {/* Left: Tops (up to 2) */}
              <div className="ob-bsec-group">
                <div className="ob-bsec-grouplbl">
                  Tops
                  {map.tops.length > 0 && (
                    <span className="ob-bsec-grouplbl-ct">{map.tops.length}/{LAYER_LIMITS.tops}</span>
                  )}
                </div>
                <div className="ob-bsec-group-row">
                  {map.tops.map((item, idx) => (
                    <div key={item._id} className="ob-icard-wrap">
                      {idx > 0 && <span className="ob-layer-tag">Layer {idx + 1}</span>}
                      <ItemCard item={item} layerKey="tops" onRemove={onRemove}/>
                    </div>
                  ))}
                  {map.tops.length < LAYER_LIMITS.tops && (
                    <AddCard
                      label={map.tops.length === 0 ? 'Add Top' : '+ Layer'}
                      hint={map.tops.length === 0
                        ? 'T-shirt, blouse, shirt…'
                        : 'Sweater, turtleneck, cardigan…'}
                      onClick={() => onJumpToTab('tops')}
                      size={map.tops.length > 0 ? 'sm' : 'md'}
                    />
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="ob-bsec-divider"/>

              {/* Right: Bottoms */}
              <div className="ob-bsec-group">
                <div className="ob-bsec-grouplbl">Bottom</div>
                <div className="ob-bsec-group-row">
                  {map.bottoms.map(item => (
                    <ItemCard key={item._id} item={item} layerKey="bottoms" onRemove={onRemove}/>
                  ))}
                  {map.bottoms.length === 0 && (
                    <AddCard label="Add Bottom" hint="Pants, skirt, shorts…"
                             onClick={() => onJumpToTab('bottoms')}/>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Alt: Dress / Traditional links when nothing selected */}
          {!hasFull && map.tops.length === 0 && map.bottoms.length === 0 && (
            <div className="ob-bsec-alt">
              <span className="ob-bsec-alt-or">or browse full-body:</span>
              <button className="ob-bsec-alt-btn" onClick={() => onJumpToTab('dresses')}>
                Dresses
              </button>
              <button className="ob-bsec-alt-btn" onClick={() => onJumpToTab('traditional')}>
                Traditional Wear
              </button>
            </div>
          )}
        </div>

        <div className="ob-bsec">
          <div className="ob-bsec-hd">
            <span className="ob-bsec-title">Outerwear</span>
            {map.outerwear.length > 0 && (
              <span className="ob-bsec-ct">
                {map.outerwear.length} layer{map.outerwear.length > 1 ? 's' : ''}
              </span>
            )}
            <span className="ob-bsec-limit">up to {LAYER_LIMITS.outerwear} layers</span>
          </div>
          <div className="ob-bsec-row">
            {map.outerwear.map((item, idx) => (
              <div key={item._id} className="ob-icard-wrap">
                {idx > 0 && <span className="ob-layer-tag">Layer {idx + 1}</span>}
                <ItemCard item={item} layerKey="outerwear" onRemove={onRemove}/>
              </div>
            ))}
            {map.outerwear.length < LAYER_LIMITS.outerwear && (
              <AddCard
                label={map.outerwear.length === 0 ? 'Add Jacket / Coat' : '+ Another Layer'}
                hint={
                  map.outerwear.length === 0
                    ? 'Jacket, blazer, hoodie, coat…'
                    : map.outerwear.length === 1
                      ? 'Try blazer over shirt, coat over hoodie…'
                      : 'Add a third outer layer'
                }
                onClick={() => onJumpToTab('jackets')}
                size={map.outerwear.length > 0 ? 'sm' : 'md'}
              />
            )}
          </div>
        </div>

        <div className="ob-bsec">
          <div className="ob-bsec-hd">
            <span className="ob-bsec-title">Accessories</span>
            {map.accessories.length > 0 && (
              <span className="ob-bsec-ct">
                {map.accessories.length} item{map.accessories.length > 1 ? 's' : ''}
              </span>
            )}
            <span className="ob-bsec-limit">up to {LAYER_LIMITS.accessories} items</span>
          </div>
          <div className="ob-bsec-row ob-bsec-row--wrap">
            {map.accessories.map(item => (
              <ItemCard key={item._id} item={item} layerKey="accessories" size="sm" onRemove={onRemove}/>
            ))}
            {map.accessories.length < LAYER_LIMITS.accessories && (
              <AddCard
                label={map.accessories.length === 0 ? 'Add Accessories' : '+'}
                hint={map.accessories.length === 0 ? 'Watch, bag, necklace, belt, scarf…' : undefined}
                onClick={() => onJumpToTab('accessories')}
                size={map.accessories.length === 0 ? 'md' : 'xs'}
              />
            )}
          </div>
        </div>

        <div className="ob-bsec">
          <div className="ob-bsec-hd">
            <span className="ob-bsec-title">Footwear</span>
          </div>
          <div className="ob-bsec-row">
            {map.footwear.length > 0
              ? map.footwear.map(item => (
                  <ItemCard key={item._id} item={item} layerKey="footwear" size="wide" onRemove={onRemove}/>
                ))
              : <AddCard label="Add Footwear" hint="Shoes, boots, sandals, sneakers…"
                         onClick={() => onJumpToTab('footwear')} size="wide"/>
            }
          </div>
        </div>
      </div>

      {/* Empty-state CTA */}
      {selCount === 0 && (
        <div className="ob-board-cta">
          <div className="ob-board-cta-ic"><Icon d={IC.shirt} size={30}/></div>
          <p className="ob-board-cta-title">Build your layered outfit</p>
          <p className="ob-board-cta-body">
            Select clothing items from the wardrobe panel. Layer a t-shirt with a
            sweater and jacket, mix multiple accessories, and complete your look.
          </p>
        </div>
      )}
    </div>
  );
}

function WardrobePanel({ items, map, onSelect, loading, activeTab, setActiveTab }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let list = items;
    if (activeTab !== 'all') {
      const cats = TAB_CATEGORIES[activeTab] || [activeTab];
      list = items.filter(i => cats.some(c => (i.category || '').toLowerCase() === c));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        (i.name  || '').toLowerCase().includes(q) ||
        (i.color || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeTab, query]);

  /* All currently-selected item IDs across all layers */
  const selectedIds = useMemo(() => {
    const s = new Set();
    flatItems(map).forEach(i => s.add(i._id));
    return s;
  }, [map]);

  const count = key => {
    if (key === 'all') return items.length;
    const cats = TAB_CATEGORIES[key] || [key];
    return items.filter(i => cats.some(c => (i.category || '').toLowerCase() === c)).length;
  };

  /* Does the layer for a given item still have room? */
  const canAdd = item => {
    const layer = CATEGORY_TO_LAYER[(item.category || '').toLowerCase()];
    if (!layer) return false;
    if (selectedIds.has(item._id)) return true; // already selected = can toggle off
    const cur = (map[layer] || []).length;
    const lim = LAYER_LIMITS[layer] || 1;
    return cur < lim;
  };

  return (
    <aside className="ob-wardrobe">
      <div className="ob-wd-hd">
        <h2 className="ob-wd-title">Wardrobe</h2>
        <span className="ob-wd-count">{items.length} items</span>
      </div>

      <div className="ob-wd-search">
        <Icon d={IC.search} size={13}/>
        <input className="ob-wd-input" placeholder="Search items…"
          value={query} onChange={e => setQuery(e.target.value)}/>
        {query && (
          <button className="ob-wd-clear" onClick={() => setQuery('')}>
            <Icon d={IC.x} size={11}/>
          </button>
        )}
      </div>

      <nav className="ob-wd-tabs">
        {CATEGORY_TABS.map(t => (
          <button key={t.key}
            className={`ob-wd-tab ${activeTab === t.key ? 'ob-wd-tab--on' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            <span>{t.label}</span>
            {count(t.key) > 0 && <span className="ob-wd-tab-n">{count(t.key)}</span>}
          </button>
        ))}
      </nav>

      <div className="ob-wd-scroll">
        {loading ? (
          <div className="ob-wd-grid">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="ob-wd-skel">
                <div className="ob-sk ob-sk--sq"/>
                <div className="ob-sk ob-sk--ln"/>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="ob-wd-empty">
            <Icon d={IC.hanger} size={22}/>
            <p>{query ? `No results for "${query}"` : 'No items in this category'}</p>
          </div>
        ) : (
          <div className="ob-wd-grid">
            {filtered.map(item => {
              const sel     = selectedIds.has(item._id);
              const layer   = CATEGORY_TO_LAYER[(item.category||'').toLowerCase()];
              const meta    = LAYER_META[layer] || {};
              const full    = !canAdd(item) && !sel;
              return (
                <button key={item._id}
                  className={`ob-wd-item ${sel ? 'ob-wd-item--on' : ''} ${full ? 'ob-wd-item--full' : ''}`}
                  onClick={() => onSelect(item)} title={item.name}>
                  <div className="ob-wd-img">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.name} className="ob-wd-photo" loading="lazy"/>
                      : <div className="ob-wd-noimg"><Icon d={IC.hanger} size={16}/></div>
                    }
                    {sel && (
                      <div className="ob-wd-check"><Icon d={IC.check} size={9}/></div>
                    )}
                    {full && !sel && (
                      <div className="ob-wd-full-badge">Full</div>
                    )}
                    {/* Layer count badge for multi-item layers */}
                    {!sel && layer && LAYER_META[layer]?.multi && (map[layer]||[]).length > 0 && !full && (
                      <div className="ob-wd-layer-ct">+{(map[layer]||[]).length}</div>
                    )}
                  </div>
                  <div className="ob-wd-info">
                    <p className="ob-wd-name">{item.name}</p>
                    <div className="ob-wd-meta">
                      {meta.label && (
                        <span className="ob-wd-cat" style={{ background: meta.bg, color: meta.tc }}>
                          {meta.label}
                        </span>
                      )}
                      {item.color && (
                        <span className="ob-wd-dot"
                          style={{ background: ['white','cream','ivory'].some(c => (item.color||'').toLowerCase().includes(c))
                            ? '#E5E7EB' : item.color }}
                          title={item.color}/>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function StylePanel({
  map, scores, insights,
  name, setName, occasion, setOccasion, season, setSeason, notes, setNotes,
  onSave, onClear, onRemove, saving, editingId, nameErr, setNameErr,
}) {
  /* Flatten all selected items grouped by layer for the sidebar list */
  const selGroups = Object.entries(map)
    .map(([layer, items]) => ({ layer, items, meta: LAYER_META[layer] }))
    .filter(g => g.items.length > 0);
  const count = flatItems(map).length;
  const verdict = scores
    ? scores.overall >= 88 ? 'Exceptional'
      : scores.overall >= 76 ? 'Very Good'
      : scores.overall >= 62 ? 'Good'
      : 'Developing'
    : null;

  return (
    <aside className="ob-style">
      <div className="ob-sp-hd">
        <h2 className="ob-sp-title">{editingId ? 'Edit Outfit' : 'Style Details'}</h2>
        {editingId && <span className="ob-sp-editing">Editing</span>}
      </div>

      {/* Completeness */}
      <div className="ob-progress">
        <div className="ob-prog-row">
          <span className="ob-prog-lbl">Outfit Progress</span>
          <span className="ob-prog-val">{scores?.completeness ?? 0}%</span>
        </div>
        <div className="ob-prog-bar">
          <div className="ob-prog-fill" style={{ width: `${scores?.completeness ?? 0}%` }}/>
        </div>
      </div>

      {/* Selected pieces grouped by layer */}
      <div className="ob-section">
        <p className="ob-section-hd">
          Selected Pieces
          {count > 0 && <span className="ob-section-ct">{count}</span>}
        </p>
        {count === 0 ? (
          <div className="ob-empty-sel">
            <Icon d={IC.hanger} size={20}/>
            <p>Select items to begin — you can layer multiple outerwear and accessories</p>
          </div>
        ) : (
          <div className="ob-sel-groups">
            {selGroups.map(({ layer, items, meta }) => (
              <div key={layer} className="ob-sel-group">
                <div className="ob-sel-group-hd">
                  <span className="ob-sel-group-lbl"
                        style={{ background: meta.bg, color: meta.tc }}>
                    {meta.label}
                  </span>
                  {items.length > 1 && (
                    <span className="ob-sel-group-ct">{items.length} items</span>
                  )}
                </div>
                {items.map(item => (
                  <div key={item._id} className="ob-sel-row">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.name} className="ob-sel-thumb"/>
                      : <div className="ob-sel-thumb ob-sel-noph"><Icon d={IC.hanger} size={11}/></div>
                    }
                    <span className="ob-sel-name">{item.name}</span>
                    <button className="ob-sel-rm" onClick={() => onRemove(layer, item._id)}>
                      <Icon d={IC.x} size={10}/>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Style Analysis */}
      {scores && (
        <div className="ob-section">
          <p className="ob-section-hd">Style Analysis</p>
          <div className="ob-score-hero">
            <ScoreRing value={scores.overall}/>
            <div className="ob-score-right">
              <span className="ob-score-verdict">{verdict}</span>
              <span className="ob-score-lbl">Overall score</span>
            </div>
          </div>
          <ColorPalette map={map}/>
          <div className="ob-metrics">
            <MetricBar label="Color Harmony"  value={scores.color}/>
            <MetricBar label="Season Match"   value={scores.season}/>
            <MetricBar label="Occasion Fit"   value={scores.occasion}/>
            <MetricBar label="Completeness"   value={scores.completeness}/>
          </div>
          {insights.length > 0 && (
            <div className="ob-insights">
              {insights.map((ins, i) => <InsightRow key={i} insight={ins}/>)}
            </div>
          )}
        </div>
      )}

      {/* Save form */}
      <div className="ob-section">
        <p className="ob-section-hd">{editingId ? 'Update Outfit' : 'Save Outfit'}</p>
        <div className="ob-field">
          <label className="ob-lbl">Outfit Name <span className="ob-req">*</span></label>
          <input className={`ob-inp ${nameErr ? 'ob-inp--err' : ''}`}
            placeholder="e.g. College Look, Office Wear…"
            value={name} onChange={e => { setName(e.target.value); setNameErr(''); }}/>
          {nameErr && <p className="ob-field-err">{nameErr}</p>}
        </div>
        <div className="ob-field">
          <label className="ob-lbl">Occasion</label>
          <select className="ob-sel" value={occasion} onChange={e => setOccasion(e.target.value)}>
            <option value="">Select occasion</option>
            {OCCASIONS.map(o => <option key={o} value={o}>{cap(o)}</option>)}
          </select>
        </div>
        <div className="ob-field">
          <label className="ob-lbl">Season</label>
          <div className="ob-chips">
            {SEASONS.map(s => (
              <button key={s} type="button"
                className={`ob-chip ${season === s ? 'ob-chip--on' : ''}`}
                onClick={() => setSeason(p => p === s ? '' : s)}>
                {cap(s)}
              </button>
            ))}
          </div>
        </div>
        <div className="ob-field">
          <label className="ob-lbl">Notes <span className="ob-opt">(optional)</span></label>
          <textarea className="ob-ta" rows={2}
            placeholder="Styling notes, occasions, inspiration…"
            value={notes} onChange={e => setNotes(e.target.value)}/>
        </div>
        <div className="ob-actions">
          {count > 0 && (
            <button className="ob-btn ob-btn--ghost" onClick={onClear} disabled={saving}>
              <Icon d={IC.refresh} size={12}/> Reset
            </button>
          )}
          <button className="ob-btn ob-btn--primary" onClick={onSave} disabled={saving}>
            {saving
              ? <><span className="ob-spin"/> Saving…</>
              : <><Icon d={IC.save} size={13}/> {editingId ? 'Update' : 'Save Outfit'}</>
            }
          </button>
        </div>
      </div>
    </aside>
  );
}

function SavedLooks({ combos, onEdit, onDelete, onDuplicate, onNew, loading }) {
  const [confirm, setConfirm] = useState(null);
  const sc = s => s >= 80 ? '#059669' : s >= 60 ? '#D97706' : '#0891B2';

  if (loading) return (
    <div className="ob-looks-grid">
      {[1,2,3,4].map(i => <div key={i} className="ob-sk ob-sk--card"/>)}
    </div>
  );
  if (!combos.length) return (
    <div className="ob-looks-zero">
      <div className="ob-looks-zero-ic"><Icon d={IC.hanger} size={30}/></div>
      <h3>No saved outfits yet</h3>
      <p>Build a layered look in the Studio and save it here.</p>
      <button className="ob-btn ob-btn--primary" onClick={onNew} style={{ marginTop: 20 }}>
        <Icon d={IC.layers} size={13}/> Open Studio
      </button>
    </div>
  );

  return (
    <>
      {confirm && (
        <>
          <div className="ob-overlay" onClick={() => setConfirm(null)}/>
          <div className="ob-dialog">
            <div className="ob-dialog-icon"><Icon d={IC.trash} size={22}/></div>
            <h3 className="ob-dialog-title">Delete this outfit?</h3>
            <p className="ob-dialog-body">"{confirm.name || 'This outfit'}" will be permanently removed.</p>
            <div className="ob-dialog-acts">
              <button className="ob-btn ob-btn--ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="ob-btn ob-btn--danger"
                      onClick={() => { onDelete(confirm._id); setConfirm(null); }}>
                <Icon d={IC.trash} size={12}/> Delete
              </button>
            </div>
          </div>
        </>
      )}

      <div className="ob-looks-hd">
        <div>
          <h2 className="ob-looks-title">Saved Outfits</h2>
          <p className="ob-looks-sub">{combos.length} look{combos.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button className="ob-btn ob-btn--outline" onClick={onNew}>
          <Icon d={IC.plus} size={12}/> New Outfit
        </button>
      </div>

      <div className="ob-looks-grid">
        {combos.map(combo => {
          const score = combo.matchScore || 0;
          const imgs  = (combo.items || []).filter(i => i?.imageUrl).slice(0, 4);
          const total = (combo.items || []).length;
          return (
            <article key={combo._id} className="ob-look">
              <div className="ob-look-mosaic">
                {imgs.length === 0 && (
                  <div className="ob-look-mosaic-ph"><Icon d={IC.hanger} size={22}/></div>
                )}
                {imgs.map((item, idx) => (
                  <div key={idx} className="ob-look-cell">
                    <img src={item.imageUrl} alt={item.name} className="ob-look-img" loading="lazy"/>
                  </div>
                ))}
                {total > 4 && (
                  <span className="ob-look-more">+{total - 4}</span>
                )}
                {score > 0 && (
                  <div className="ob-look-score-badge" style={{ background: sc(score) }}>
                    {score}%
                  </div>
                )}
                <div className="ob-look-piece-ct">{total} piece{total !== 1 ? 's' : ''}</div>
              </div>
              <div className="ob-look-body">
                <h3 className="ob-look-name">{combo.name || 'Unnamed Outfit'}</h3>
                <div className="ob-look-tags">
                  {combo.occasion && (
                    <span className="ob-look-tag ob-look-tag--occ">{cap(combo.occasion)}</span>
                  )}
                  {combo.weatherSuitable && (
                    <span className="ob-look-tag ob-look-tag--season">{combo.weatherSuitable}</span>
                  )}
                </div>
                {combo.reasons?.length > 0 && (
                  <div className="ob-look-reasons">
                    {combo.reasons.slice(0, 2).map((r, i) => (
                      <span key={i} className="ob-look-reason">
                        <Icon d={IC.check} size={9}/> {r}
                      </span>
                    ))}
                  </div>
                )}
                {combo.notes && <p className="ob-look-notes">"{combo.notes}"</p>}
                <div className="ob-look-acts">
                  <button className="ob-look-btn" onClick={() => onEdit(combo)}>
                    <Icon d={IC.edit} size={11}/> Edit
                  </button>
                  <button className="ob-look-btn" onClick={() => onDuplicate(combo)}>
                    <Icon d={IC.copy} size={11}/> Duplicate
                  </button>
                  <button className="ob-look-btn ob-look-btn--del"
                          onClick={() => setConfirm(combo)}>
                    <Icon d={IC.trash} size={11}/> Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default function OutfitBuilder() {
  const [allItems,     setAllItems]     = useState([]);
  const [savedCombos,  setSavedCombos]  = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [map,          setMap]          = useState(makeEmptyMap());
  const [name,         setName]         = useState('');
  const [occasion,     setOccasion]     = useState('');
  const [season,       setSeason]       = useState('');
  const [notes,        setNotes]        = useState('');
  const [editingId,    setEditingId]    = useState(null);
  const [nameErr,      setNameErr]      = useState('');
  const [view,         setView]         = useState('studio');
  const [activeTab,    setActiveTab]    = useState('all');
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);

  const showToast = useCallback((msg, type = 'success') =>
    setToast({ msg, type, k: Date.now() }), []);

  const scores   = useMemo(() => computeScores(map), [map]);
  const insights = useMemo(() => getInsights(map, scores), [map, scores]);

  /* Data fetching */
  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const { data } = await api.get('/wardrobe?sort=name&sortDir=asc');
      setAllItems(data.items || []);
    } catch { setAllItems([]); }
    setLoadingItems(false);
  }, []);

  const fetchSaved = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const { data } = await api.get('/wardrobe/outfits/saved');
      setSavedCombos(data.combinations || []);
    } catch {}
    setLoadingSaved(false);
  }, []);

  useEffect(() => { fetchItems(); fetchSaved(); }, [fetchItems, fetchSaved]);

  const handleSelect = useCallback(item => {
    const layer = CATEGORY_TO_LAYER[(item.category || '').toLowerCase()];
    if (!layer) return;

    setMap(prev => {
      const arr = prev[layer] || [];

      /* Toggle off: already selected */
      if (arr.some(i => i._id === item._id)) {
        return { ...prev, [layer]: arr.filter(i => i._id !== item._id) };
      }

      /* Mutual exclusion: dress/traditional ↔ tops/bottoms */
      if ((layer === 'dress' || layer === 'traditional') &&
          (prev.tops.length || prev.bottoms.length)) {
        showToast('Remove separate tops/bottoms first, then add a dress or traditional piece.', 'warn');
        return prev;
      }
      if ((layer === 'tops' || layer === 'bottoms') &&
          (prev.dress.length || prev.traditional.length)) {
        showToast('Remove dress/traditional first, then add separate tops and bottoms.', 'warn');
        return prev;
      }

      /* Layer limit check */
      const limit = LAYER_LIMITS[layer] || 1;
      if (arr.length >= limit) {
        if (limit === 1) {
          /* Single-slot layers: silently replace (footwear, bottoms, dress, traditional) */
          return { ...prev, [layer]: [item] };
        }
        /* Multi-slot layers: show error, don't add */
        showToast(
          `You've reached the maximum of ${limit} ${LAYER_META[layer]?.label.toLowerCase() || 'items'} per outfit.`,
          'error'
        );
        return prev;
      }

      return { ...prev, [layer]: [...arr, item] };
    });
  }, [showToast]);

  /* Remove a specific item from a layer by its ID */
  const handleRemove = useCallback((layer, itemId) => {
    setMap(prev => ({
      ...prev,
      [layer]: (prev[layer] || []).filter(i => i._id !== itemId),
    }));
  }, []);

  const handleClear = useCallback(() => {
    setMap(makeEmptyMap());
    setName(''); setOccasion(''); setSeason(''); setNotes('');
    setEditingId(null); setNameErr('');
  }, []);

  /* Save / update */
  const handleSave = async () => {
    const items = flatItems(map);
    if (items.length < 2) {
      showToast('Select at least 2 pieces to save an outfit.', 'error');
      return;
    }
    if (!name.trim()) { setNameErr('Please name your outfit.'); return; }
    setNameErr('');
    setSaving(true);
    const matchScore = scores?.overall ?? 0;
    const payload = {
      name: name.trim(), items: items.map(i => i._id),
      matchScore, occasion,
      weatherSuitable: season ? cap(season) : '',
      notes, reasons: buildReasons(map, matchScore),
    };
    try {
      if (editingId) {
        const { data } = await api.put(`/wardrobe/outfits/${editingId}`, payload);
        setSavedCombos(p => p.map(c => c._id === editingId ? data.combination : c));
        showToast('Outfit updated.');
      } else {
        const { data } = await api.post('/wardrobe/outfits/save', payload);
        setSavedCombos(p => [data.combination, ...p]);
        showToast('Outfit saved.');
      }
      handleClear();
      setView('looks');
    } catch { showToast('Could not save outfit. Try again.', 'error'); }
    finally  { setSaving(false); }
  };

  /* Edit — rebuild layered map from saved combo items */
  const handleEdit = useCallback(combo => {
    handleClear();
    setEditingId(combo._id);
    setName(combo.name || '');
    setOccasion(combo.occasion || '');
    setNotes(combo.notes || '');
    const nm = makeEmptyMap();
    (combo.items || []).filter(Boolean).forEach(item => {
      const layer = CATEGORY_TO_LAYER[(item.category || '').toLowerCase()];
      if (!layer) return;
      const lim = LAYER_LIMITS[layer] || 1;
      if (nm[layer].length < lim && !nm[layer].some(i => i._id === item._id)) {
        nm[layer] = [...nm[layer], item];
      }
    });
    setMap(nm);
    setView('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleClear]);

  /* Duplicate — copy to studio as new outfit */
  const handleDuplicate = useCallback(combo => {
    handleClear();
    setName(`${combo.name || 'Outfit'} (Copy)`);
    setOccasion(combo.occasion || '');
    setNotes(combo.notes || '');
    const nm = makeEmptyMap();
    (combo.items || []).filter(Boolean).forEach(item => {
      const layer = CATEGORY_TO_LAYER[(item.category || '').toLowerCase()];
      if (!layer) return;
      const lim = LAYER_LIMITS[layer] || 1;
      if (nm[layer].length < lim && !nm[layer].some(i => i._id === item._id)) {
        nm[layer] = [...nm[layer], item];
      }
    });
    setMap(nm);
    setView('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleClear]);

  /* Delete */
  const handleDelete = async id => {
    try {
      await api.delete(`/wardrobe/outfits/${id}`);
      setSavedCombos(p => p.filter(c => c._id !== id));
      showToast('Outfit removed.');
    } catch { showToast('Could not delete outfit.', 'error'); }
  };

  const handleJumpToTab = useCallback(tab => setActiveTab(tab), []);

  const selCount = flatItems(map).length;

  return (
    <div className="ob-root">
      {toast && (
        <Toast key={toast.k} msg={toast.msg} type={toast.type}
               onClose={() => setToast(null)}/>
      )}

      {/* Page header */}
      <header className="ob-header">
        <div className="ob-header-left">
          <div className="ob-header-icon"><Icon d={IC.layers} size={18}/></div>
          <div>
            <h1 className="ob-header-title">Outfit Builder</h1>
            <p className="ob-header-sub">
              Layer tops, outerwear, and accessories to create complete outfit combinations
            </p>
          </div>
        </div>
        <div className="ob-header-right">
          {editingId && (
            <span className="ob-header-editing">
              <Icon d={IC.edit} size={11}/> Editing outfit
            </span>
          )}
          {selCount > 0 && (
            <button className="ob-btn ob-btn--ghost" onClick={handleClear}>
              <Icon d={IC.refresh} size={12}/> New Outfit
            </button>
          )}
        </div>
      </header>

      {/* View tabs */}
      <div className="ob-viewbar">
        <button className={`ob-viewtab ${view === 'studio' ? 'ob-viewtab--on' : ''}`}
          onClick={() => setView('studio')}>
          <Icon d={IC.layers} size={13}/>
          Fitting Studio
          {editingId && <span className="ob-viewpill">editing</span>}
          {selCount > 0 && !editingId && (
            <span className="ob-viewct">{selCount}</span>
          )}
        </button>
        <button className={`ob-viewtab ${view === 'looks' ? 'ob-viewtab--on' : ''}`}
          onClick={() => setView('looks')}>
          <Icon d={IC.eye} size={13}/>
          Saved Looks
          {savedCombos.length > 0 && (
            <span className="ob-viewct">{savedCombos.length}</span>
          )}
        </button>
      </div>

      {/* Studio */}
      {view === 'studio' && (
        <div className="ob-studio">
          <WardrobePanel
            items={allItems} map={map}
            onSelect={handleSelect} loading={loadingItems}
            activeTab={activeTab} setActiveTab={setActiveTab}/>

          <OutfitBoard
            map={map} onRemove={handleRemove}
            onJumpToTab={handleJumpToTab}/>

          <StylePanel
            map={map} scores={scores} insights={insights}
            name={name} setName={setName}
            occasion={occasion} setOccasion={setOccasion}
            season={season} setSeason={setSeason}
            notes={notes} setNotes={setNotes}
            onSave={handleSave} onClear={handleClear} onRemove={handleRemove}
            saving={saving} editingId={editingId}
            nameErr={nameErr} setNameErr={setNameErr}/>
        </div>
      )}

      {/* Saved looks */}
      {view === 'looks' && (
        <div className="ob-looks-view">
          <SavedLooks
            combos={savedCombos} onEdit={handleEdit}
            onDelete={handleDelete} onDuplicate={handleDuplicate}
            onNew={() => setView('studio')} loading={loadingSaved}/>
        </div>
      )}
    </div>
  );
}
