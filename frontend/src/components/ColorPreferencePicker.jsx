import React, { useCallback } from 'react';
import './ColorPreferencePicker.css';

/* ── Color data — kept as export so other components can reference it ──────── */
export const COLOR_FAMILIES = [
  {
    id: 'reds', label: 'Reds & Pinks', accent: '#ef4444',
    shades: [
      { id: 'blush',     name: 'Blush',      hex: '#ffd6e7' },
      { id: 'baby-pink', name: 'Baby Pink',   hex: '#ffb3c6' },
      { id: 'soft-pink', name: 'Soft Pink',   hex: '#ff8fab' },
      { id: 'hot-pink',  name: 'Hot Pink',    hex: '#f72585' },
      { id: 'rose',      name: 'Rose',        hex: '#fb7185' },
      { id: 'coral',     name: 'Coral',       hex: '#ff6b6b' },
      { id: 'red',       name: 'Red',         hex: '#ef4444' },
      { id: 'crimson',   name: 'Crimson',     hex: '#dc143c' },
      { id: 'maroon',    name: 'Maroon',      hex: '#800000' },
      { id: 'burgundy',  name: 'Burgundy',    hex: '#800020' },
    ],
  },
  {
    id: 'oranges', label: 'Oranges', accent: '#f97316',
    shades: [
      { id: 'peach',      name: 'Peach',        hex: '#ffcba4' },
      { id: 'apricot',    name: 'Apricot',      hex: '#fbceb1' },
      { id: 'salmon',     name: 'Salmon',       hex: '#fa8072' },
      { id: 'terracotta', name: 'Terracotta',   hex: '#c47c5a' },
      { id: 'orange',     name: 'Orange',       hex: '#f97316' },
      { id: 'burnt-org',  name: 'Burnt Orange', hex: '#cc5500' },
      { id: 'rust',       name: 'Rust',         hex: '#b7410e' },
    ],
  },
  {
    id: 'yellows', label: 'Yellows & Golds', accent: '#eab308',
    shades: [
      { id: 'cream',     name: 'Cream',     hex: '#fffbeb' },
      { id: 'champagne', name: 'Champagne', hex: '#f7e7ce' },
      { id: 'lemon',     name: 'Lemon',     hex: '#fff176' },
      { id: 'yellow',    name: 'Yellow',    hex: '#eab308' },
      { id: 'gold',      name: 'Gold',      hex: '#ffd700' },
      { id: 'amber',     name: 'Amber',     hex: '#d97706' },
      { id: 'mustard',   name: 'Mustard',   hex: '#ca8a04' },
      { id: 'saffron',   name: 'Saffron',   hex: '#ff9933' },
    ],
  },
  {
    id: 'greens', label: 'Greens', accent: '#22c55e',
    shades: [
      { id: 'mint',       name: 'Mint',         hex: '#a7f3d0' },
      { id: 'sage',       name: 'Sage',         hex: '#87ae73' },
      { id: 'lime',       name: 'Lime',         hex: '#84cc16' },
      { id: 'green',      name: 'Green',        hex: '#22c55e' },
      { id: 'emerald',    name: 'Emerald',      hex: '#10b981' },
      { id: 'forest',     name: 'Forest Green', hex: '#16a34a' },
      { id: 'olive',      name: 'Olive',        hex: '#808000' },
      { id: 'dark-green', name: 'Dark Green',   hex: '#166534' },
    ],
  },
  {
    id: 'blues', label: 'Blues', accent: '#3b82f6',
    shades: [
      { id: 'baby-blue',  name: 'Baby Blue',    hex: '#bfdbfe' },
      { id: 'sky',        name: 'Sky Blue',     hex: '#7dd3fc' },
      { id: 'powder',     name: 'Powder Blue',  hex: '#93c5fd' },
      { id: 'cornflower', name: 'Cornflower',   hex: '#6495ed' },
      { id: 'blue',       name: 'Blue',         hex: '#3b82f6' },
      { id: 'royal',      name: 'Royal Blue',   hex: '#4169e1' },
      { id: 'cobalt',     name: 'Cobalt',       hex: '#0047ab' },
      { id: 'navy',       name: 'Navy',         hex: '#1e3a5f' },
    ],
  },
  {
    id: 'purples', label: 'Purples', accent: '#a855f7',
    shades: [
      { id: 'lavender', name: 'Lavender', hex: '#e9d5ff' },
      { id: 'lilac',    name: 'Lilac',    hex: '#c084fc' },
      { id: 'mauve',    name: 'Mauve',    hex: '#d8b4fe' },
      { id: 'violet',   name: 'Violet',   hex: '#8b5cf6' },
      { id: 'purple',   name: 'Purple',   hex: '#a855f7' },
      { id: 'plum',     name: 'Plum',     hex: '#8e4585' },
      { id: 'indigo',   name: 'Indigo',   hex: '#4b0082' },
    ],
  },
  {
    id: 'teals', label: 'Teals & Aquas', accent: '#14b8a6',
    shades: [
      { id: 'aqua',      name: 'Aqua',      hex: '#a5f3fc' },
      { id: 'turquoise', name: 'Turquoise', hex: '#2dd4bf' },
      { id: 'teal',      name: 'Teal',      hex: '#14b8a6' },
      { id: 'cyan',      name: 'Cyan',      hex: '#06b6d4' },
      { id: 'dark-teal', name: 'Dark Teal', hex: '#0d9488' },
    ],
  },
  {
    id: 'browns', label: 'Browns & Tans', accent: '#92400e',
    shades: [
      { id: 'beige',     name: 'Beige',     hex: '#d4b896' },
      { id: 'tan',       name: 'Tan',       hex: '#d2b48c' },
      { id: 'camel',     name: 'Camel',     hex: '#c19a6b' },
      { id: 'khaki',     name: 'Khaki',     hex: '#c3b091' },
      { id: 'brown',     name: 'Brown',     hex: '#92400e' },
      { id: 'chocolate', name: 'Chocolate', hex: '#7b3f00' },
    ],
  },
  {
    id: 'neutrals', label: 'Neutrals', accent: '#6b7280',
    shades: [
      { id: 'white',      name: 'White',      hex: '#ffffff' },
      { id: 'off-white',  name: 'Off White',  hex: '#fafaf9' },
      { id: 'pearl',      name: 'Pearl',      hex: '#f0ece3' },
      { id: 'silver',     name: 'Silver',     hex: '#c0c0c0' },
      { id: 'light-gray', name: 'Light Gray', hex: '#d1d5db' },
      { id: 'gray',       name: 'Gray',       hex: '#6b7280' },
      { id: 'dark-gray',  name: 'Dark Gray',  hex: '#374151' },
      { id: 'charcoal',   name: 'Charcoal',   hex: '#36454f' },
      { id: 'black',      name: 'Black',      hex: '#1f2937' },
    ],
  },
  {
    id: 'pastels', label: 'Pastels', accent: '#f9a8d4',
    shades: [
      { id: 'pas-rose',   name: 'Pastel Rose',    hex: '#ffd6e7' },
      { id: 'pas-peach',  name: 'Pastel Peach',   hex: '#fde8d8' },
      { id: 'pas-yellow', name: 'Pastel Yellow',  hex: '#fef9c3' },
      { id: 'pas-green',  name: 'Pastel Green',   hex: '#bbf7d0' },
      { id: 'pas-blue',   name: 'Pastel Blue',    hex: '#bfdbfe' },
      { id: 'pas-purple', name: 'Pastel Purple',  hex: '#f3e8ff' },
      { id: 'pas-lavend', name: 'Pastel Lavender',hex: '#ede9fe' },
    ],
  },
  {
    id: 'earth', label: 'Earth Tones', accent: '#b5651d',
    shades: [
      { id: 'sand',     name: 'Sand',      hex: '#c2a882' },
      { id: 'clay',     name: 'Clay',      hex: '#b5651d' },
      { id: 'sienna',   name: 'Sienna',    hex: '#a0522d' },
      { id: 'umber',    name: 'Umber',     hex: '#635147' },
      { id: 'moss',     name: 'Moss',      hex: '#8a9a5b' },
      { id: 'mushroom', name: 'Mushroom',  hex: '#b5a08c' },
    ],
  },
];

const ALL_SHADES = COLOR_FAMILIES.flatMap(f =>
  f.shades.map(s => ({ ...s, familyId: f.id, familyLabel: f.label }))
);
const NAME_TO_HEX = Object.fromEntries(ALL_SHADES.map(s => [s.name, s.hex]));

export function getHexForColorName(name) {
  if (!name) return '#888';
  if (NAME_TO_HEX[name]) return NAME_TO_HEX[name];
  const m = name.match(/#([0-9A-Fa-f]{3,6})/);
  return m ? `#${m[1]}` : '#888888';
}

function isLight(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export default function ColorPreferencePicker({
  value = [],
  onChange,
  disallowed = [],
  mode = 'love',
}) {
  const toggle = useCallback((name) => {
    if (disallowed.includes(name)) return;
    onChange(value.includes(name) ? value.filter(v => v !== name) : [...value, name]);
  }, [value, onChange, disallowed]);

  const remove = useCallback((name) => {
    onChange(value.filter(v => v !== name));
  }, [value, onChange]);

  const accentColor = mode === 'love' ? '#0D9488' : '#DC2626';

  return (
    <div className="cpp-root">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="cpp-header">
        <span className="cpp-header-label" style={{ color: accentColor }}>
          {mode === 'love' ? '❤ Favourite Colors' : '✕ Colors to Avoid'}
        </span>
        {value.length > 0 && (
          <button className="cpp-clear" type="button" onClick={() => onChange([])}>
            Clear {value.length}
          </button>
        )}
      </div>

      {/* ── Flat color dot grid ─────────────────────────────────────────────── */}
      <div className="cpp-grid">
        {ALL_SHADES.map(shade => {
          const selected     = value.includes(shade.name);
          const isDisallowed = disallowed.includes(shade.name);
          const light        = isLight(shade.hex);
          return (
            <button
              key={shade.id}
              type="button"
              className={`cpp-dot${selected ? ' cpp-dot--on' : ''}${isDisallowed ? ' cpp-dot--off' : ''}`}
              style={{
                background:  shade.hex,
                boxShadow:   light ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined,
                outline:     selected ? `2.5px solid ${accentColor}` : undefined,
                outlineOffset: selected ? '2px' : undefined,
              }}
              title={shade.name}
              aria-label={shade.name}
              aria-pressed={selected}
              disabled={isDisallowed}
              onClick={() => toggle(shade.name)}
            >
              {selected && (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none"
                  stroke={light ? '#1f2937' : '#fff'} strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected chips ──────────────────────────────────────────────────── */}
      {value.length > 0 ? (
        <div className="cpp-chips">
          {value.map(name => {
            const hex   = getHexForColorName(name);
            const light = isLight(hex);
            return (
              <span key={name} className="cpp-chip"
                style={{
                  background: hex,
                  color:      light ? '#1f2937' : '#fff',
                  boxShadow:  light ? 'inset 0 0 0 1px rgba(0,0,0,0.18)' : undefined,
                }}>
                {name}
                <button type="button" className="cpp-chip-x"
                  style={{ color: light ? '#374151' : 'rgba(255,255,255,.8)' }}
                  onClick={() => remove(name)} aria-label={`Remove ${name}`}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="cpp-hint">Click any color to select it</p>
      )}

    </div>
  );
}
