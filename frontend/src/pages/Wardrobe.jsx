import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { getMeterColor } from '../utils/confidenceScale';
import useDebounce from '../hooks/useDebounce';
import { uploadWardrobeImage } from '../utils/cloudinaryUpload';
import { OCCASIONS, OCCASION_LABELS } from '../constants/occasions';
import './Wardrobe.css';

const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  plus:    'M12 5v14m-7-7h14',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  edit:    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.41-9.41a2 2 0 112.83 2.83L11.83 15H9v-2.83z',
  trash:   'M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  heart:   'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  close:   'M18 6L6 18M6 6l12 12',
  save:    'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zm-7-1v-8H7v8',
  grid:    'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  list:    'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  upload:  'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m14-7l-5-5-5 5m5-5v12',
  camera:  'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zm-7-5a4 4 0 11-8 0 4 4 0 018 0z',
  x:       'M18 6L6 18M6 6l12 12',
  check:   'M20 6L9 17l-5-5',
  wand:    'M15 4V2m0 14v-2M8 9H2m14 0h-2m-1.4-4.4L11 6m1.4 7.4L11 12m5.4-5.4L18 5m-1.4 7.4L18 14',
  hanger:  'M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z',
};

// Full 5-category enum, used for edit mode and the footwear/accessory add
// flow. The fast clothing-add flow (FastAddModal) uses only the first 3.
const CATEGORIES = ['tops', 'bottoms', 'dresses', 'footwear', 'accessories'];
const CLOTHING_CATEGORIES = ['tops', 'bottoms', 'dresses'];
const FOOTWEAR_ACCESSORY_CATEGORIES = ['footwear', 'accessories'];
const SEASONS    = ['summer','winter','monsoon','spring','all'];

// AI-extracted metadata options (Phase 1: hybrid k-means color + vision-LLM pipeline)
const PATTERNS      = ['solid','striped','plaid','floral','geometric','abstract','animal_print','paisley','checkered','embroidered','other'];
const FITS           = ['fitted','regular','relaxed','oversized','cropped'];
const SLEEVE_LENGTHS = ['sleeveless','short','3/4','long'];
const STYLE_TAG_OPTS = ['minimalist','streetwear','smart_casual','korean','vintage','preppy','athleisure','romantic','edgy','boho','classic','grunge','cottagecore','y2k','modest_chic'];
const NECKLINES  = ['crew','round','v_neck','polo_collar','shirt_collar','turtleneck','high_neck','square_neck','off_shoulder','boat_neck'];
const GENDERS    = ['women','men','unisex'];
const TEXTURES   = ['smooth','ribbed','knit','woven','lace','sequined','embroidered','denim','leather','velvet','satin','other'];
const SILHOUETTES = ['fitted','a_line','straight','flared','bodycon','oversized','wrap','asymmetric','other'];
const WEATHER_SUITABILITY = ['hot','mild','cold','rainy','any'];
const CULTURAL_CATEGORIES = ['western','indo_western','traditional','fusion','other'];
const DETAIL_FLAGS = [
  { key: 'hasHood',       label: 'Hood' },
  { key: 'hasButtons',    label: 'Buttons' },
  { key: 'hasZipper',     label: 'Zipper' },
  { key: 'hasPockets',    label: 'Pockets' },
  { key: 'hasLogo',       label: 'Logo' },
  { key: 'hasBelt',       label: 'Belt' },
  { key: 'isTransparent', label: 'Transparent' },
];

const CAT_META = {
  tops:        { label: 'Tops',        color: '#0D9488', icon: '👕' },
  bottoms:     { label: 'Bottoms',     color: '#1D4ED8', icon: '👖' },
  dresses:     { label: 'Dresses',     color: '#0891B2', icon: '👗' },
  jackets:     { label: 'Jackets',     color: '#475569', icon: '🧥' },
  footwear:    { label: 'Footwear',    color: '#D97706', icon: '👠' },
  accessories: { label: 'Accessories', color: '#059669', icon: '💍' },
  traditional: { label: 'Traditional', color: '#DC2626', icon: '🥻' },
};

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';

const COLOR_MAP = {
  white:'#FFFFFF', black:'#111827', grey:'#9CA3AF', gray:'#9CA3AF',
  red:'#DC2626', blue:'#2563EB', green:'#059669', yellow:'#F59E0B',
  orange:'#EA580C', purple:'#7C3AED', pink:'#EC4899', brown:'#92400E',
  navy:'#1E3A5F', teal:'#0D9488', cyan:'#0891B2', beige:'#D4B896',
  cream:'#F5F0E8', maroon:'#7F1D1D', olive:'#4D7C0F', mustard:'#B45309',
  lavender:'#A78BFA', mint:'#6EE7B7', coral:'#F87171', gold:'#D97706',
  silver:'#94A3B8', khaki:'#6B7280', rose:'#F43F5E', indigo:'#4F46E5',
};

function resolveColor(name) {
  const n = (name || '').toLowerCase().trim();
  return COLOR_MAP[n] || (n.startsWith('#') ? n : '#CBD5E1');
}

function WardrobeStats({ stats }) {
  const [open, setOpen] = useState(false);
  if (!stats || stats.total === 0) return null;

  const maxCat = Math.max(...(stats.categories || []).map(c => c.count), 1);

  return (
    <div className="wd-stats-panel">
      <button className="wd-stats-toggle" onClick={() => setOpen(o => !o)}>
        <span>Wardrobe Insights</span>
        <span className="wd-stats-toggle-meta">
          {stats.categoryCoverage}/{stats.totalCategories} categories · {stats.completenessScore}% complete
        </span>
        <Ic d={open ? I.close : I.wand} size={13} />
      </button>

      {open && (
        <div className="wd-stats-body">
          <div className="wd-stats-grid">

            {/* Completeness */}
            <div className="wd-stat-card">
              <div className="wd-stat-label">Wardrobe Completeness</div>
              <div className="wd-stat-progress">
                <div className="wd-stat-progress-fill"
                  style={{ width: `${stats.completenessScore}%`,
                    background: getMeterColor(stats.completenessScore),
                  }} />
              </div>
              <div className="wd-stat-val">{stats.completenessScore}%</div>
              <div className="wd-stat-hint">
                {stats.categoryCoverage} of {stats.totalCategories} categories covered
              </div>
            </div>

            {/* Top Colors */}
            {stats.topColors?.length > 0 && (
              <div className="wd-stat-card">
                <div className="wd-stat-label">Top Colors</div>
                <div className="wd-stat-colors">
                  {stats.topColors.map(c => (
                    <div key={c} className="wd-stat-swatch" title={cap(c)}
                      style={{ background: resolveColor(c),
                        border: `2px solid ${resolveColor(c) === '#FFFFFF' ? '#e5e7eb' : 'transparent'}`,
                      }} />
                  ))}
                </div>
                <div className="wd-stat-hint">
                  {stats.topColors.slice(0, 3).map(cap).join(', ')}
                </div>
              </div>
            )}

            {/* Top Occasions */}
            {stats.topOccasions?.length > 0 && (
              <div className="wd-stat-card">
                <div className="wd-stat-label">Top Occasions</div>
                <div className="wd-stat-chips">
                  {stats.topOccasions.map(o => (
                    <span key={o._id} className="wd-stat-chip">
                      {cap(o._id)} <span className="wd-stat-chip-n">{o.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category bars */}
          <div className="wd-stat-cats">
            <div className="wd-stat-label" style={{ marginBottom: 8 }}>Category Distribution</div>
            {(stats.categories || []).map((c, i) => (
              <div key={c._id} className="wd-stat-cat-row">
                <span className="wd-stat-cat-name">
                  {CAT_META[c._id]?.icon} {CAT_META[c._id]?.label || cap(c._id)}
                </span>
                <div className="wd-stat-cat-bar">
                  <div className="wd-stat-cat-fill"
                    style={{
                      width: `${(c.count / maxCat) * 100}%`,
                      background: CAT_META[c._id]?.color || '#0D9488',
                      animationDelay: `${i * 60}ms`,
                    }} />
                </div>
                <span className="wd-stat-cat-count">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemThumb({ url, name, size = 48, fill = false }) {
  const [err, setErr] = useState(false);
  if (fill) {
    if (url && !err) return (
      <img src={url} alt={name} className="wd-thumb wd-thumb--fill"
        onError={() => setErr(true)} />
    );
    return (
      <div className="wd-thumb wd-thumb--ph wd-thumb--fill">
        <Ic d={I.hanger} size={36} />
      </div>
    );
  }
  const style = { width: size, height: size, minWidth: size };
  if (url && !err) return (
    <img src={url} alt={name} className="wd-thumb" style={style}
      onError={() => setErr(true)} />
  );
  return (
    <div className="wd-thumb wd-thumb--ph" style={style}>
      <Ic d={I.hanger} size={Math.round(size * 0.45)} />
    </div>
  );
}

function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`wd-toast wd-toast--${type}`}>
      <Ic d={type === 'success' ? I.check : I.x} size={14} />
      <span>{msg}</span>
    </div>
  );
}

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function ImageUploader({ existingUrl, onFileChange, uploadError }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview,  setPreview]  = useState(existingUrl || '');
  const [fileErr,  setFileErr]  = useState('');
  const fileRef = useRef(null);

  const applyFile = (file) => {
    setFileErr('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFileErr('Please select an image file.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setFileErr('Image must be under 10 MB.');
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);
    onFileChange(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    applyFile(e.dataTransfer.files[0]);
  };

  const clear = () => {
    setPreview('');
    setFileErr('');
    onFileChange(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="wd-uploader">
      {preview ? (
        <div className="wd-uploader-preview">
          <img src={preview} alt="outfit preview" onError={() => setPreview('')} />
          <div className="wd-uploader-actions">
            <button type="button" className="wd-uploader-change"
              onClick={() => { clear(); setTimeout(() => fileRef.current?.click(), 50); }}>
              <Ic d={I.camera} size={13} /> Replace Image
            </button>
            <button type="button" className="wd-uploader-remove" onClick={clear}>
              <Ic d={I.trash} size={13} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`wd-drop-zone ${dragOver ? 'wd-drop-zone--over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}>
          <input
            type="file" ref={fileRef} style={{ display: 'none' }}
            accept="image/*"
            onChange={e => applyFile(e.target.files[0])} />
          <div className="wd-drop-icon"><Ic d={I.upload} size={28} /></div>
          <p className="wd-drop-title">
            {dragOver ? 'Drop it here!' : 'Drag & drop your outfit photo'}
          </p>
          <p className="wd-drop-sub">
            or <span className="wd-drop-link">browse from device</span>
          </p>
          <p className="wd-drop-hint">Any image format (JPG, PNG, HEIC, WebP…) &nbsp;·&nbsp; Max 10 MB</p>
        </div>
      )}
      {(fileErr || uploadError) && (
        <p className="wd-field-err" style={{ marginTop: 6 }}>{fileErr || uploadError}</p>
      )}
    </div>
  );
}

const EMPTY_DETAILS = { hasHood: false, hasButtons: false, hasZipper: false, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false };

const EMPTY_FORM = {
  name: '', category: '', color: '',
  occasion: '', season: '', notes: '', imageUrl: '', publicId: '',
  subcategory: '', pattern: '', fit: '', sleeveLength: '', materialGuess: '',
  styleTags: [], suitableSeasons: [], suitableOccasions: [], colorHex: [],
  neckline: '', genderCategory: '', details: { ...EMPTY_DETAILS },
  isCompleteOutfit: false,
  texture: '', silhouette: '', weatherSuitability: '', culturalCategory: '',
  aiMeta: null,
};

function AiBadge({ confidence }) {
  const pct = typeof confidence === 'number' ? Math.round(confidence * 100) : null;
  const low = pct !== null && pct < 70;
  return (
    <span
      className={`wd-tag ${low ? 'wd-tag--warn' : 'wd-tag--purple'}`}
      style={{ marginLeft: 6, fontSize: 10 }}
      title={low ? 'Low confidence — please verify this value' : undefined}
    >
      ✨ {pct !== null ? `${pct}%${low ? ' — verify' : ''}` : 'AI suggested'}
    </span>
  );
}

// Shared AI/CV-extracted metadata field set — every value here is
// AI-prefilled and editable via the same AiBadge/aiSuggested convention.
// Used by both ItemModal (edit + footwear/accessory add) and FastAddModal's
// review step (fast clothing add), so both paths render identically.
function MetadataFields({ form, set, toggleChip, toggleDetail, aiSuggested, category }) {
  // Footwear/accessories get a deliberately minimal review screen — only
  // Subcategory/Material/Style Tags/Notes stay visible. Everything else here
  // (pattern, sleeve/neckline/fit, seasons/occasions chips, gender, texture,
  // silhouette, weather, cultural category, construction details) is either
  // garment-specific or a nice-to-have the AI already filled in the
  // background — no need to make the user review it for a pair of shoes or
  // a necklace. Toggled by the same `isGarment` flag throughout.
  const isGarment = category !== 'footwear' && category !== 'accessories';
  return (
    <>
      {/* Subcategory */}
      <div className="wd-field">
        <label className="wd-label">Subcategory <span className="wd-opt">(optional)</span>{aiSuggested.has('subcategory') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.subcategory} />}</label>
        <input className="wd-input" placeholder="e.g. Blouse, Ankle boots"
          value={form.subcategory} onChange={e => set('subcategory', e.target.value)} />
      </div>

      {/* Pattern — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Pattern <span className="wd-opt">(optional)</span>{aiSuggested.has('pattern') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.pattern} />}</label>
          <select className="wd-select" value={form.pattern} onChange={e => set('pattern', e.target.value)}>
            <option value="">Select pattern</option>
            {PATTERNS.map(p => <option key={p} value={p}>{cap(p)}</option>)}
          </select>
        </div>
      )}

      {/* Fit — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Fit <span className="wd-opt">(optional)</span>{aiSuggested.has('fit') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.fit} />}</label>
          <select className="wd-select" value={form.fit} onChange={e => set('fit', e.target.value)}>
            <option value="">Select fit</option>
            {FITS.map(f => <option key={f} value={f}>{cap(f)}</option>)}
          </select>
        </div>
      )}

      {/* Sleeve length — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Sleeve Length <span className="wd-opt">(optional)</span>{aiSuggested.has('sleeveLength') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.sleeveLength} />}</label>
          <select className="wd-select" value={form.sleeveLength} onChange={e => set('sleeveLength', e.target.value)}>
            <option value="">Select sleeve length</option>
            {SLEEVE_LENGTHS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </div>
      )}

      {/* Material guess */}
      <div className="wd-field">
        <label className="wd-label">Material <span className="wd-opt">(optional)</span>{aiSuggested.has('materialGuess') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.materialGuess} />}</label>
        <input className="wd-input" placeholder="e.g. Cotton, Denim, Chiffon"
          value={form.materialGuess} onChange={e => set('materialGuess', e.target.value)} />
      </div>

      {/* Style tags */}
      <div className="wd-field wd-field--full">
        <label className="wd-label">Style Tags <span className="wd-opt">(optional)</span>{aiSuggested.has('styleTags') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.styleTags} />}</label>
        <div className="wd-chips">
          {STYLE_TAG_OPTS.map(s => (
            <button type="button" key={s}
              className={`wd-chip ${form.styleTags.includes(s) ? 'wd-chip--on' : ''}`}
              onClick={() => toggleChip('styleTags', s)}>{cap(s)}</button>
          ))}
        </div>
      </div>

      {/* Suitable seasons — garment-only (footwear/accessories already have the single Season field above) */}
      {isGarment && (
        <div className="wd-field wd-field--full">
          <label className="wd-label">Suitable Seasons <span className="wd-opt">(optional)</span>{aiSuggested.has('suitableSeasons') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.suitableSeasons} />}</label>
          <div className="wd-chips">
            {['winter','spring','monsoon','autumn','all'].map(s => (
              <button type="button" key={s}
                className={`wd-chip wd-chip--season ${form.suitableSeasons.includes(s) ? 'wd-chip--on' : ''}`}
                onClick={() => toggleChip('suitableSeasons', s)}>{cap(s)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Suitable occasions — garment-only (footwear/accessories already have the primary Occasion from step 2) */}
      {isGarment && (
        <div className="wd-field wd-field--full">
          <label className="wd-label">Suitable Occasions <span className="wd-opt">(optional)</span>{aiSuggested.has('suitableOccasions') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.suitableOccasions} />}</label>
          <div className="wd-chips">
            {OCCASIONS.map(o => (
              <button type="button" key={o}
                className={`wd-chip ${form.suitableOccasions.includes(o) ? 'wd-chip--on' : ''}`}
                onClick={() => toggleChip('suitableOccasions', o)}>{OCCASION_LABELS[o] || cap(o)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Neckline — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Neckline <span className="wd-opt">(optional)</span>{aiSuggested.has('neckline') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.neckline} />}</label>
          <select className="wd-select" value={form.neckline} onChange={e => set('neckline', e.target.value)}>
            <option value="">Select neckline</option>
            {NECKLINES.map(n => <option key={n} value={n}>{cap(n)}</option>)}
          </select>
        </div>
      )}

      {/* Gender category — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Gender <span className="wd-opt">(optional)</span>{aiSuggested.has('genderCategory') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.genderCategory} />}</label>
          <select className="wd-select" value={form.genderCategory} onChange={e => set('genderCategory', e.target.value)}>
            <option value="">Select gender</option>
            {GENDERS.map(g => <option key={g} value={g}>{cap(g)}</option>)}
          </select>
        </div>
      )}

      {/* Texture — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Texture <span className="wd-opt">(optional)</span>{aiSuggested.has('texture') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.texture} />}</label>
          <select className="wd-select" value={form.texture} onChange={e => set('texture', e.target.value)}>
            <option value="">Select texture</option>
            {TEXTURES.map(t => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
        </div>
      )}

      {/* Silhouette — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Silhouette <span className="wd-opt">(optional)</span>{aiSuggested.has('silhouette') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.silhouette} />}</label>
          <select className="wd-select" value={form.silhouette} onChange={e => set('silhouette', e.target.value)}>
            <option value="">Select silhouette</option>
            {SILHOUETTES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </div>
      )}

      {/* Weather suitability — garment-only */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Weather Suitability <span className="wd-opt">(optional)</span>{aiSuggested.has('weatherSuitability') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.weatherSuitability} />}</label>
          <select className="wd-select" value={form.weatherSuitability} onChange={e => set('weatherSuitability', e.target.value)}>
            <option value="">Select weather suitability</option>
            {WEATHER_SUITABILITY.map(w => <option key={w} value={w}>{cap(w)}</option>)}
          </select>
        </div>
      )}

      {/* Cultural category — garment-only; informational only, never a hard filter */}
      {isGarment && (
        <div className="wd-field">
          <label className="wd-label">Cultural Category <span className="wd-opt">(optional)</span>{aiSuggested.has('culturalCategory') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.culturalCategory} />}</label>
          <select className="wd-select" value={form.culturalCategory} onChange={e => set('culturalCategory', e.target.value)}>
            <option value="">Select cultural category</option>
            {CULTURAL_CATEGORIES.map(c => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
          <p className="wd-hint">Used to enrich suggestions, not a hard filter.</p>
        </div>
      )}

      {/* Complete outfit flag — garment-only */}
      {isGarment && (
        <div className="wd-field wd-field--full">
          <label className="wd-label">Outfit Structure <span className="wd-opt">(optional)</span>{aiSuggested.has('isCompleteOutfit') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.isCompleteOutfit} />}</label>
          <div className="wd-chips">
            <button type="button"
              className={`wd-chip ${form.isCompleteOutfit ? 'wd-chip--on' : ''}`}
              onClick={() => set('isCompleteOutfit', !form.isCompleteOutfit)}>
              This is already a complete outfit
            </button>
          </div>
          <p className="wd-hint">Saree, lehenga, kurta set, co-ord set — never needs a separate bottom in recommendations.</p>
        </div>
      )}

      {/* Additional details — garment-only */}
      {isGarment && (
        <div className="wd-field wd-field--full">
          <label className="wd-label">Additional Details <span className="wd-opt">(optional)</span>{aiSuggested.has('details') && <AiBadge confidence={form.aiMeta?.fieldConfidence?.details} />}</label>
          <div className="wd-chips">
            {DETAIL_FLAGS.map(({ key, label }) => (
              <button type="button" key={key}
                className={`wd-chip ${form.details?.[key] ? 'wd-chip--on' : ''}`}
                onClick={() => toggleDetail(key)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="wd-field wd-field--full">
        <label className="wd-label">Notes <span className="wd-opt">(optional)</span></label>
        <textarea className="wd-textarea" rows={2}
          placeholder="Any special notes about this item…"
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
    </>
  );
}

function ItemModal({ item, onClose, onSave, categoryOptions = CATEGORIES }) {
  const isEdit = !!item;
  const [form, setForm] = useState(isEdit ? {
    name:      item.name      || '',
    category:  item.category  || '',
    color:     item.color     || '',
    occasion:  item.occasion  || '',
    season:    item.season    || '',
    notes:     item.notes     || '',
    imageUrl:  item.imageUrl  || '',
    publicId:  item.publicId  || '',
    subcategory:     item.subcategory     || '',
    pattern:         item.pattern         || '',
    fit:             item.fit             || '',
    sleeveLength:    item.sleeveLength    || '',
    materialGuess:   item.materialGuess   || '',
    styleTags:       item.styleTags       || [],
    suitableSeasons: item.suitableSeasons || [],
    suitableOccasions: item.suitableOccasions || [],
    colorHex:        item.colorHex        || [],
    neckline:        item.neckline        || '',
    genderCategory:  item.genderCategory  || '',
    details:         { ...EMPTY_DETAILS, ...(item.details || {}) },
    isCompleteOutfit: item.isCompleteOutfit || false,
    texture:            item.texture            || '',
    silhouette:         item.silhouette         || '',
    weatherSuitability: item.weatherSuitability || '',
    culturalCategory:   item.culturalCategory   || '',
    aiMeta:          item.aiMeta          || null,
  } : { ...EMPTY_FORM });

  // Defensive: a legacy (pre-migration) item's stored category may not be in
  // the current 5-value enum (e.g. 'jackets'/'traditional') — render it as a
  // selectable extra option rather than showing a blank select.
  const categorySelectOptions = (isEdit && item.category && !categoryOptions.includes(item.category))
    ? [item.category, ...categoryOptions]
    : categoryOptions;

  const [uploadFile,  setUploadFile]  = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});

  const [analyzing,    setAnalyzing]    = useState(false);
  const [aiSuggested,  setAiSuggested]  = useState(isEdit ? new Set(item.unverifiedFields || []) : new Set());
  const [aiBanner,     setAiBanner]     = useState('');

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setAiSuggested(prev => { if (!prev.has(k)) return prev; const next = new Set(prev); next.delete(k); return next; });
  };

  const toggleChip = (k, val) => {
    setForm(f => {
      const arr = f[k] || [];
      return { ...f, [k]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
    setAiSuggested(prev => { if (!prev.has(k)) return prev; const next = new Set(prev); next.delete(k); return next; });
  };

  const toggleDetail = (flag) => {
    setForm(f => ({ ...f, details: { ...f.details, [flag]: !f.details?.[flag] } }));
    setAiSuggested(prev => { if (!prev.has('details')) return prev; const next = new Set(prev); next.delete('details'); return next; });
  };

  const fetchAiMeta = async (imageUrl, category) => {
    try {
      const { data } = await api.post('/wardrobe/analyze', { imageUrl, category });
      return data.meta || null;
    } catch {
      return null;
    }
  };

  const mergeMeta = (f, meta) => ({
    subcategory:       f.subcategory       || meta.subcategory       || '',
    pattern:           f.pattern           || meta.pattern           || '',
    fit:               f.fit               || meta.fit               || '',
    sleeveLength:      f.sleeveLength      || meta.sleeveLength      || '',
    materialGuess:     f.materialGuess     || meta.materialGuess     || '',
    styleTags:         f.styleTags?.length         ? f.styleTags         : (meta.styleTags || []),
    suitableSeasons:   f.suitableSeasons?.length   ? f.suitableSeasons   : (meta.suitableSeasons || []),
    suitableOccasions: f.suitableOccasions?.length ? f.suitableOccasions : (meta.suitableOccasions || []),
    colorHex:          meta.colorHex?.length ? meta.colorHex : f.colorHex,
    formalityLevel:    meta.formalityLevel ?? f.formalityLevel,
    layeringLevel:     meta.layeringLevel || f.layeringLevel || '',
    accessoryCompatibility: meta.accessoryCompatibility?.length ? meta.accessoryCompatibility : (f.accessoryCompatibility || []),
    neckline:          f.neckline         || meta.neckline         || '',
    genderCategory:    f.genderCategory   || meta.genderCategory   || '',
    details:           meta.details ? { ...EMPTY_DETAILS, ...meta.details } : (f.details || { ...EMPTY_DETAILS }),
    isCompleteOutfit:  f.isCompleteOutfit || meta.isCompleteOutfit || false,
    texture:            f.texture            || meta.texture            || '',
    silhouette:         f.silhouette         || meta.silhouette         || '',
    weatherSuitability: f.weatherSuitability || meta.weatherSuitability || '',
    culturalCategory:   f.culturalCategory   || meta.culturalCategory   || '',
    aiMeta:            meta.aiMeta,
  });

  const runAnalysis = async (imageUrl, category) => {
    if (!imageUrl) return;
    setAnalyzing(true);
    setAiBanner('');
    const meta = await fetchAiMeta(imageUrl, category);
    if (meta) {
      setForm(f => ({ ...f, ...mergeMeta(f, meta) }));
      setAiSuggested(new Set(meta.unverifiedFields || []));
      if (meta.aiMeta && !meta.aiMeta.visionAvailable) {
        setAiBanner('AI tagging unavailable right now — colors were detected automatically, please fill in the rest below. Tip: add a free Gemini API key for full automatic tagging.');
      }
    } else {
      setAiBanner('AI tagging is temporarily unavailable — please fill in the details manually.');
    }
    setAnalyzing(false);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name     = 'Outfit name is required';
    if (!form.category)     e.category = 'Category is required';
    if (!form.color.trim()) e.color    = 'Color is required';
    if (!form.occasion)     e.occasion = 'Occasion is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let finalForm = { ...form };

      if (uploadFile) {
        setUploading(true);
        setUploadPct(0);
        setUploadError('');

        try {
          const { imageUrl, publicId } = await uploadWardrobeImage(uploadFile, {
            folder: 'styleai/wardrobe',
            onProgress: setUploadPct,
          });
          finalForm.imageUrl = imageUrl;
          finalForm.publicId = publicId;
        } catch (err) {
          setUploadError(err.message);
          setUploading(false);
          setSaving(false);
          return;
        }
        setUploading(false);
      }

      // A fresh upload (new item, or a re-uploaded image on edit) gets AI-tagged
      // automatically. Editing without changing the photo does not re-trigger this
      // — the "Analyze with AI" button covers that case on demand.
      if (uploadFile && finalForm.imageUrl) {
        setAnalyzing(true);
        const meta = await fetchAiMeta(finalForm.imageUrl, finalForm.category);
        if (meta) {
          finalForm = { ...finalForm, ...mergeMeta(finalForm, meta), unverifiedFields: meta.unverifiedFields || [] };
        }
        setAnalyzing(false);
      }

      if (finalForm.unverifiedFields === undefined) {
        finalForm.unverifiedFields = Array.from(aiSuggested);
      }

      await onSave(finalForm);
    } finally {
      setSaving(false);
    }
  };

  const loading = uploading || saving || analyzing;

  return (
    <>
      <div className="wd-modal-bg" onClick={onClose} />
      <div className="wd-modal" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit outfit' : 'Add outfit'}>

        {/* Header */}
        <div className="wd-modal-hd">
          <div className="wd-modal-hd-left">
            <div className="wd-modal-icon"><Ic d={I.hanger} size={18} /></div>
            <div>
              <h2 className="wd-modal-title">{isEdit ? 'Edit Outfit' : 'Add to Wardrobe'}</h2>
              <p className="wd-modal-sub">{isEdit ? item.name : 'Add a new clothing item'}</p>
            </div>
          </div>
          <button className="wd-icon-btn" onClick={onClose} disabled={loading} aria-label="Close">
            <Ic d={I.close} size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="wd-modal-body">
          <div className="wd-form-grid">

            {/* Outfit Image */}
            <div className="wd-field wd-field--full">
              <label className="wd-label">Outfit Image</label>
              <ImageUploader
                existingUrl={form.imageUrl}
                onFileChange={setUploadFile}
                uploadError={uploadError}
              />
              {uploading && (
                <div className="wd-progress">
                  <div className="wd-progress-bar" style={{ width: `${uploadPct}%` }} />
                  <span className="wd-progress-txt">Uploading… {uploadPct}%</span>
                </div>
              )}
              {analyzing && (
                <div className="wd-progress">
                  <div className="wd-progress-bar" style={{ width: '100%' }} />
                  <span className="wd-progress-txt">✨ AI is tagging your item…</span>
                </div>
              )}
              {isEdit && form.imageUrl && !uploadFile && (
                <button type="button" className="wd-btn wd-btn--ghost" style={{ marginTop: 8 }}
                  disabled={analyzing || loading}
                  onClick={() => runAnalysis(form.imageUrl, form.category)}>
                  <Ic d={I.wand} size={13} /> {analyzing ? 'Analyzing…' : 'Re-analyze with AI'}
                </button>
              )}
              {aiBanner && <p className="wd-field-err" style={{ marginTop: 6, color: 'var(--wd-primary)' }}>{aiBanner}</p>}
            </div>

            {/* Outfit Name */}
            <div className="wd-field wd-field--full">
              <label className="wd-label">
                Outfit Name <span className="wd-req">*</span>
              </label>
              <input
                className={`wd-input ${errors.name ? 'wd-input--err' : ''}`}
                placeholder="e.g. White Floral Kurta"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <span className="wd-field-err">{errors.name}</span>}
            </div>

            {/* Category */}
            <div className="wd-field">
              <label className="wd-label">
                Category <span className="wd-req">*</span>
              </label>
              <select
                className={`wd-select ${errors.category ? 'wd-input--err' : ''}`}
                value={form.category}
                onChange={e => set('category', e.target.value)}>
                <option value="">Select category</option>
                {categorySelectOptions.map(c => (
                  <option key={c} value={c}>{(CAT_META[c]?.icon || '')} {CAT_META[c]?.label || cap(c)}</option>
                ))}
              </select>
              {errors.category && <span className="wd-field-err">{errors.category}</span>}
            </div>

            {/* Color */}
            <div className="wd-field">
              <label className="wd-label">
                Color <span className="wd-req">*</span>
              </label>
              <input
                className={`wd-input ${errors.color ? 'wd-input--err' : ''}`}
                placeholder="e.g. White, Navy Blue"
                value={form.color}
                onChange={e => set('color', e.target.value)}
              />
              {errors.color && <span className="wd-field-err">{errors.color}</span>}
            </div>

            {/* Occasion */}
            <div className="wd-field">
              <label className="wd-label">
                Occasion <span className="wd-req">*</span>
              </label>
              <select className={`wd-select ${errors.occasion ? 'wd-input--err' : ''}`} value={form.occasion}
                onChange={e => set('occasion', e.target.value)}>
                <option value="">Select occasion</option>
                {OCCASIONS.map(o => <option key={o} value={o}>{OCCASION_LABELS[o] || cap(o)}</option>)}
              </select>
              {errors.occasion && <span className="wd-field-err">{errors.occasion}</span>}
            </div>

            {/* Season */}
            <div className="wd-field">
              <label className="wd-label">Season</label>
              <select className="wd-select" value={form.season}
                onChange={e => set('season', e.target.value)}>
                <option value="">Select season</option>
                {SEASONS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
            </div>

            <MetadataFields form={form} set={set} toggleChip={toggleChip} toggleDetail={toggleDetail} aiSuggested={aiSuggested} category={form.category} />

          </div>
        </div>

        {/* Footer */}
        <div className="wd-modal-ft">
          <button className="wd-btn wd-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="wd-btn wd-btn--primary" onClick={handleSave} disabled={loading}>
            {loading
              ? <><span className="wd-spin" />{uploading ? `Uploading ${uploadPct}%…` : analyzing ? 'Tagging with AI…' : 'Saving…'}</>
              : <><Ic d={I.save} size={14} />{isEdit ? 'Save Changes' : 'Add to Wardrobe'}</>}
          </button>
        </div>

      </div>
    </>
  );
}

// Fast 2-step add flow, shared by both "+ Add Clothing" (Top/Bottom/Dress)
// and "+ Add Footwear/Accessory": Step 1 (image + category) → Step 2
// (occasion + Generate with AI) → a review screen where every AI-detected
// field is pre-filled and editable via the same AiBadge/mergeMeta machinery
// ItemModal uses. `categoryOptions` picks which category chips Step 1 shows;
// everything else (occasion, AI analysis, review fields) is identical
// regardless of item type — the vision AI already returns null/not-applicable
// for fields a shoe or bag doesn't have (sleeve length, neckline, etc.).
function FastAddModal({ onClose, onSave, categoryOptions = CLOTHING_CATEGORIES, title = 'Add Clothing' }) {
  const [step, setStep] = useState('category'); // 'category' | 'occasion' | 'review'
  const [category, setCategory] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [publicId, setPublicId] = useState('');
  const [occasion, setOccasionVal] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiBanner, setAiBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setFormState] = useState({ ...EMPTY_FORM });
  const [aiSuggested, setAiSuggested] = useState(new Set());

  const set = (k, v) => {
    setFormState(f => ({ ...f, [k]: v }));
    setAiSuggested(prev => { if (!prev.has(k)) return prev; const next = new Set(prev); next.delete(k); return next; });
  };

  const toggleChip = (k, val) => {
    setFormState(f => {
      const arr = f[k] || [];
      return { ...f, [k]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
    setAiSuggested(prev => { if (!prev.has(k)) return prev; const next = new Set(prev); next.delete(k); return next; });
  };

  const toggleDetail = (flag) => {
    setFormState(f => ({ ...f, details: { ...f.details, [flag]: !f.details?.[flag] } }));
    setAiSuggested(prev => { if (!prev.has('details')) return prev; const next = new Set(prev); next.delete('details'); return next; });
  };

  const handleImageChange = (file) => {
    setImageFile(file);
    setImageUrl('');
    setPublicId('');
    setUploadError('');
  };

  const goToOccasionStep = async () => {
    if (!imageFile || !category) return;
    if (imageUrl) { // already uploaded (e.g. came back via "Back" without picking a new photo)
      setFormState(f => ({ ...f, category }));
      setStep('occasion');
      return;
    }
    setUploading(true);
    setUploadPct(0);
    setUploadError('');
    try {
      const { imageUrl: url, publicId: pid } = await uploadWardrobeImage(imageFile, {
        folder: 'styleai/wardrobe',
        onProgress: setUploadPct,
      });
      setImageUrl(url);
      setPublicId(pid);
      setFormState(f => ({ ...f, imageUrl: url, publicId: pid, category }));
      setStep('occasion');
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const generateWithAI = async () => {
    if (!occasion) { setErrors({ occasion: 'Occasion is required' }); return; }
    setErrors({});
    setAnalyzing(true);
    setAiBanner('');
    try {
      const { data } = await api.post('/wardrobe/analyze', { imageUrl, category });
      const meta = data.meta || null;
      if (meta) {
        const suggestedName  = [meta.colorNames?.[0], meta.subcategory || category].filter(Boolean).map(cap).join(' ');
        const suggestedColor = (meta.colorNames || []).map(cap).join(', ');
        setFormState(f => ({
          ...f,
          occasion,
          name: suggestedName,
          color: suggestedColor,
          subcategory:       meta.subcategory       || '',
          pattern:           meta.pattern           || '',
          fit:               meta.fit               || '',
          sleeveLength:      meta.sleeveLength      || '',
          materialGuess:     meta.materialGuess     || '',
          styleTags:         meta.styleTags         || [],
          suitableSeasons:   meta.suitableSeasons   || [],
          suitableOccasions: meta.suitableOccasions || [],
          colorHex:          meta.colorHex          || [],
          formalityLevel:    meta.formalityLevel,
          layeringLevel:     meta.layeringLevel     || '',
          accessoryCompatibility: meta.accessoryCompatibility || [],
          neckline:          meta.neckline          || '',
          genderCategory:    meta.genderCategory    || '',
          details:           meta.details ? { ...EMPTY_DETAILS, ...meta.details } : { ...EMPTY_DETAILS },
          isCompleteOutfit:  meta.isCompleteOutfit   || false,
          texture:            meta.texture            || '',
          silhouette:         meta.silhouette         || '',
          weatherSuitability: meta.weatherSuitability || '',
          culturalCategory:   meta.culturalCategory   || '',
          aiMeta:            meta.aiMeta,
        }));
        setAiSuggested(new Set([
          ...(meta.unverifiedFields || []),
          ...(suggestedName  ? ['name']  : []),
          ...(suggestedColor ? ['color'] : []),
        ]));
        if (meta.aiMeta && !meta.aiMeta.visionAvailable) {
          setAiBanner('AI tagging unavailable right now — colors were detected automatically, please fill in the rest below.');
        }
      } else {
        setFormState(f => ({ ...f, occasion }));
        setAiBanner('AI tagging is temporarily unavailable — please fill in the details manually.');
      }
    } catch {
      setFormState(f => ({ ...f, occasion }));
      setAiBanner('AI tagging is temporarily unavailable — please fill in the details manually.');
    }
    setAnalyzing(false);
    setStep('review');
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Outfit name is required';
    if (!form.color.trim()) e.color = 'Color is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const finalForm = {
        ...form,
        category, occasion, imageUrl, publicId,
        unverifiedFields: Array.from(aiSuggested),
      };
      await onSave(finalForm);
    } finally {
      setSaving(false);
    }
  };

  const loading = uploading || saving || analyzing;

  return (
    <>
      <div className="wd-modal-bg" onClick={onClose} />
      <div className="wd-modal" role="dialog" aria-modal="true" aria-label={title}>

        <div className="wd-modal-hd">
          <div className="wd-modal-hd-left">
            <div className="wd-modal-icon"><Ic d={I.hanger} size={18} /></div>
            <div>
              <h2 className="wd-modal-title">{title}</h2>
              <p className="wd-modal-sub">
                {step === 'category' && 'Step 1 of 2 — Photo & category'}
                {step === 'occasion' && 'Step 2 of 2 — Occasion'}
                {step === 'review'   && 'Review AI-detected details'}
              </p>
            </div>
          </div>
          <button className="wd-icon-btn" onClick={onClose} disabled={loading} aria-label="Close">
            <Ic d={I.close} size={16} />
          </button>
        </div>

        <div className="wd-modal-body">
          {step === 'category' && (
            <div className="wd-form-grid">
              <div className="wd-field wd-field--full">
                <label className="wd-label">Outfit Image <span className="wd-req">*</span></label>
                <ImageUploader existingUrl="" onFileChange={handleImageChange} uploadError={uploadError} />
                {uploading && (
                  <div className="wd-progress">
                    <div className="wd-progress-bar" style={{ width: `${uploadPct}%` }} />
                    <span className="wd-progress-txt">Uploading… {uploadPct}%</span>
                  </div>
                )}
              </div>

              <div className="wd-field wd-field--full">
                <label className="wd-label">Category <span className="wd-req">*</span></label>
                <div className="wd-chips">
                  {categoryOptions.map(c => (
                    <button type="button" key={c}
                      className={`wd-chip wd-chip--cat ${category === c ? 'wd-chip--on' : ''}`}
                      onClick={() => setCategory(c)}>
                      {CAT_META[c].icon} {CAT_META[c].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'occasion' && (
            <div className="wd-form-grid">
              <div className="wd-field wd-field--full">
                <label className="wd-label">Occasion <span className="wd-req">*</span></label>
                <select className={`wd-select ${errors.occasion ? 'wd-input--err' : ''}`} value={occasion}
                  onChange={e => setOccasionVal(e.target.value)}>
                  <option value="">Select occasion</option>
                  {OCCASIONS.map(o => <option key={o} value={o}>{OCCASION_LABELS[o] || cap(o)}</option>)}
                </select>
                {errors.occasion && <span className="wd-field-err">{errors.occasion}</span>}
                <p className="wd-hint">
                  The occasion you'd normally wear this for — used to keep this item out of
                  mismatched recommendations (e.g. a wedding outfit will never be suggested for a casual day).
                </p>
              </div>
              {analyzing && (
                <div className="wd-field wd-field--full wd-progress">
                  <div className="wd-progress-bar" style={{ width: '100%' }} />
                  <span className="wd-progress-txt">✨ AI is analyzing your item…</span>
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="wd-form-grid">
              {aiBanner && <p className="wd-field-err wd-field--full" style={{ color: 'var(--wd-primary)' }}>{aiBanner}</p>}

              <div className="wd-field wd-field--full">
                <label className="wd-label">
                  Outfit Name <span className="wd-req">*</span>{aiSuggested.has('name') && <AiBadge />}
                </label>
                <input className={`wd-input ${errors.name ? 'wd-input--err' : ''}`}
                  value={form.name} onChange={e => set('name', e.target.value)} />
                {errors.name && <span className="wd-field-err">{errors.name}</span>}
              </div>

              <div className="wd-field">
                <label className="wd-label">
                  Color <span className="wd-req">*</span>{aiSuggested.has('color') && <AiBadge />}
                </label>
                <input className={`wd-input ${errors.color ? 'wd-input--err' : ''}`}
                  value={form.color} onChange={e => set('color', e.target.value)} />
                {errors.color && <span className="wd-field-err">{errors.color}</span>}
              </div>

              <div className="wd-field">
                <label className="wd-label">Season <span className="wd-opt">(optional)</span></label>
                <select className="wd-select" value={form.season} onChange={e => set('season', e.target.value)}>
                  <option value="">Select season</option>
                  {SEASONS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                </select>
              </div>

              <MetadataFields form={form} set={set} toggleChip={toggleChip} toggleDetail={toggleDetail} aiSuggested={aiSuggested} category={category} />
            </div>
          )}
        </div>

        <div className="wd-modal-ft">
          {step === 'category' && (
            <>
              <button className="wd-btn wd-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="wd-btn wd-btn--primary" onClick={goToOccasionStep} disabled={loading || !imageFile || !category}>
                {uploading ? <><span className="wd-spin" />Uploading {uploadPct}%…</> : 'Next'}
              </button>
            </>
          )}
          {step === 'occasion' && (
            <>
              <button className="wd-btn wd-btn--ghost" onClick={() => setStep('category')} disabled={loading}>Back</button>
              <button className="wd-btn wd-btn--primary" onClick={generateWithAI} disabled={loading || !occasion}>
                {analyzing ? <><span className="wd-spin" />Tagging with AI…</> : <><Ic d={I.wand} size={14} />Generate with AI</>}
              </button>
            </>
          )}
          {step === 'review' && (
            <>
              <button className="wd-btn wd-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="wd-btn wd-btn--primary" onClick={handleSave} disabled={loading}>
                {saving ? <><span className="wd-spin" />Saving…</> : <><Ic d={I.save} size={14} />Add to Wardrobe</>}
              </button>
            </>
          )}
        </div>

      </div>
    </>
  );
}

function DeleteModal({ item, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const go = async () => {
    setLoading(true);
    try { await onConfirm(item._id); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="wd-modal-bg" onClick={onClose} />
      <div className="wd-modal wd-modal--sm">
        <div className="wd-del-icon"><Ic d={I.trash} size={24} /></div>
        <h2 className="wd-del-title">Remove Item?</h2>
        <p className="wd-del-body">
          Remove <strong>{item?.name}</strong> from your wardrobe permanently?
        </p>
        <div className="wd-del-actions">
          <button className="wd-btn wd-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="wd-btn wd-btn--danger" onClick={go} disabled={loading}>
            {loading ? <span className="wd-spin" /> : <Ic d={I.trash} size={14} />}
            {loading ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </>
  );
}

function WardrobeCard({ item, onEdit, onDelete }) {
  const meta = CAT_META[item.category] || { color: '#0D9488', icon: '👗', label: cap(item.category) };
  return (
    <div className="wd-card">
      <div className="wd-card-img">
        <ItemThumb url={item.imageUrl} name={item.name} fill />
        <div className="wd-card-overlay">
          <button className="wd-card-act" onClick={() => onEdit(item)} title="Edit">
            <Ic d={I.edit} size={14} />
          </button>
          <button className="wd-card-act wd-card-act--del" onClick={() => onDelete(item)} title="Remove">
            <Ic d={I.trash} size={14} />
          </button>
        </div>
        <span className="wd-cat-icon-badge">{meta.icon}</span>
      </div>
      <div className="wd-card-body">
        <div className="wd-card-meta">
          <span className="wd-cat-badge" style={{ '--cc': meta.color }}>{meta.label}</span>
          {item.color && (
            <span className="wd-color-dot"
              style={{ background: item.color.toLowerCase() === 'white' ? '#E2E8F0' : item.color.toLowerCase() }}
              title={item.color} />
          )}
        </div>
        <h3 className="wd-card-name">{item.name}</h3>
        <div className="wd-card-tags">
          {item.occasion && <span className="wd-tag">{cap(item.occasion)}</span>}
          {item.season   && <span className="wd-tag wd-tag--green">{cap(item.season)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Wardrobe({ onMixMatch } = {}) {

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState({ total: 0, categories: [] });

  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [view,         setView]         = useState('grid');
  const [sortBy,       setSortBy]       = useState('createdAt:desc');

  const [addMode,  setAddMode]  = useState(null); // null | 'clothing' | 'footwear'
  const [editItem, setEditItem] = useState(null);
  const [delItem,  setDelItem]  = useState(null);
  const [toast,    setToast]    = useState(null);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type, k: Date.now() }), []);
  const dSearch   = useDebounce(search, 380);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [sf, sd] = sortBy.split(':');
      const p = new URLSearchParams({
        search: dSearch, sort: sf, sortDir: sd,
        ...(catFilter    && { category: catFilter }),
        ...(seasonFilter && { season:   seasonFilter }),
      });
      const { data } = await api.get(`/wardrobe?${p}`);
      setItems(data.items || []);
    } catch { setItems([]); }
    setLoading(false);
  }, [dSearch, catFilter, seasonFilter, sortBy]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/wardrobe/stats');
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleCreate = async form => {
    try {
      const { data } = await api.post('/wardrobe', form);
      setItems(prev => [data.item, ...prev]);
      setStats(s => ({ ...s, total: s.total + 1 }));
      setAddMode(null);
      showToast('Item added to wardrobe!');
    } catch { showToast('Failed to add item.', 'error'); }
  };

  const handleUpdate = async form => {
    try {
      const { data } = await api.put(`/wardrobe/${editItem._id}`, form);
      setItems(prev => prev.map(i => i._id === editItem._id ? data.item : i));
      setEditItem(null);
      showToast('Item updated.');
    } catch { showToast('Update failed.', 'error'); }
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/wardrobe/${id}`);
      setItems(prev => prev.filter(i => i._id !== id));
      setStats(s => ({ ...s, total: Math.max(0, s.total - 1) }));
      setDelItem(null);
      showToast('Item removed from wardrobe.');
    } catch { showToast('Delete failed.', 'error'); }
  };

  const catCounts = useMemo(() => {
    const m = {};
    items.forEach(i => { m[i.category] = (m[i.category] || 0) + 1; });
    return m;
  }, [items]);

  const activeFilters = [
    ...(catFilter    ? [{ label: CAT_META[catFilter]?.label || cap(catFilter), clear: () => setCatFilter('') }] : []),
    ...(seasonFilter ? [{ label: cap(seasonFilter), clear: () => setSeasonFilter('') }] : []),
  ];

  const clearAll = () => { setCatFilter(''); setSeasonFilter(''); };
  const hasFilters = !!(search || catFilter || seasonFilter);

  return (
    <div className="wd-root">
      {toast && <Toast key={toast.k} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="wd-banner">
        <div className="wd-banner-top">
          <div className="wd-banner-left">
            <div className="wd-banner-icon"><Ic d={I.hanger} size={22} /></div>
            <div>
              <h1 className="wd-page-title">My Wardrobe</h1>
              <p className="wd-page-sub">
                {stats.total} item{stats.total !== 1 ? 's' : ''} in your wardrobe
              </p>
            </div>
          </div>
          <div className="wd-banner-acts">
            <button className="wd-btn-add wd-btn-add--ghost" onClick={() => setAddMode('footwear')}>
              <Ic d={I.plus} size={15} /> Add Footwear/Accessory
            </button>
            <button className="wd-btn-add" onClick={() => setAddMode('clothing')}>
              <Ic d={I.plus} size={15} /> Add Clothing
            </button>
          </div>
        </div>

        {/* Category summary pills in banner */}
        {stats.total > 0 && (
          <div className="wd-banner-cats">
            {CATEGORIES.map(c => {
              const count = (stats.categories || []).find(x => x._id === c)?.count || 0;
              if (!count) return null;
              return (
                <button key={c} className="wd-banner-cat-pill"
                  onClick={() => setCatFilter(catFilter === c ? '' : c)}
                  style={catFilter === c ? { background: 'rgba(255,255,255,.35)', fontWeight: 700 } : {}}>
                  {CAT_META[c].icon} {CAT_META[c].label}
                  <span className="wd-banner-cat-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <WardrobeStats stats={stats} />

      <div className="wd-cat-strip">
        <button className={`wd-cat-btn ${!catFilter ? 'active' : ''}`}
          onClick={() => setCatFilter('')}>
          All <span className="wd-cat-ct">{stats.total}</span>
        </button>
        {CATEGORIES.map(c => {
          const meta = CAT_META[c];
          const cnt  = catCounts[c] || 0;
          return (
            <button key={c}
              className={`wd-cat-btn ${catFilter === c ? 'active' : ''}`}
              style={catFilter === c ? { '--cc': meta.color } : {}}
              onClick={() => setCatFilter(c === catFilter ? '' : c)}>
              {meta.icon} {meta.label}
              {cnt > 0 && <span className="wd-cat-ct">{cnt}</span>}
            </button>
          );
        })}
      </div>

      <div className="wd-toolbar">
        <div className="wd-search-box">
          <Ic d={I.search} size={15} />
          <input placeholder="Search outfits…" value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && (
            <button className="wd-search-x" onClick={() => setSearch('')}>
              <Ic d={I.x} size={13} />
            </button>
          )}
        </div>
        <div className="wd-toolbar-right">
          <select className="wd-sel" value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}>
            <option value="">All Seasons</option>
            {SEASONS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
          <select className="wd-sel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="createdAt:desc">Newest First</option>
            <option value="createdAt:asc">Oldest First</option>
            <option value="name:asc">Name A→Z</option>
            <option value="name:desc">Name Z→A</option>
          </select>
          <div className="wd-view-toggle">
            <button className={`wd-vt ${view === 'grid' ? 'active' : ''}`}
              onClick={() => setView('grid')} title="Grid view">
              <Ic d={I.grid} size={15} />
            </button>
            <button className={`wd-vt ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')} title="List view">
              <Ic d={I.list} size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Pills */}
      {activeFilters.length > 0 && (
        <div className="wd-af-row">
          <span className="wd-af-lbl">Filters:</span>
          {activeFilters.map((f, i) => (
            <button key={i} className="wd-af-pill" onClick={f.clear}>
              {f.label} <Ic d={I.x} size={10} />
            </button>
          ))}
          <button className="wd-af-clear" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {loading ? (
        /* Skeleton grid */
        <div className="wd-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="wd-skel">
              <div className="wd-sk wd-sk--img" />
              <div className="wd-skel-body">
                <span className="wd-sk wd-sk--tag" />
                <span className="wd-sk wd-sk--md" />
                <span className="wd-sk wd-sk--sm" />
              </div>
            </div>
          ))}
        </div>

      ) : items.length === 0 ? (
        /* Empty state */
        <div className="wd-empty">
          <div className="wd-empty-icon"><Ic d={I.hanger} size={38} /></div>
          <h3>{hasFilters ? 'No items match your filters' : 'Your wardrobe is empty'}</h3>
          <p>
            {hasFilters
              ? 'Try adjusting or clearing your filters to find what you\'re looking for.'
              : 'Start building your digital wardrobe by adding the clothes you already own.'}
          </p>
          {hasFilters
            ? <button className="wd-btn wd-btn--ghost" style={{ marginTop: 16 }} onClick={clearAll}>Clear Filters</button>
            : <button className="wd-btn-add" style={{ marginTop: 20 }} onClick={() => setAddMode('clothing')}>
                <Ic d={I.plus} size={15} /> Add Your First Outfit
              </button>
          }
        </div>

      ) : view === 'grid' ? (
        /* Grid view */
        <div className="wd-grid">
          <div className="wd-add-card" onClick={() => setAddMode('clothing')}
            role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setAddMode('clothing')}>
            <div className="wd-add-inner">
              <div className="wd-add-icon-wrap"><Ic d={I.plus} size={24} /></div>
              <p>Add Outfit</p>
            </div>
          </div>
          {items.map(item => (
            <WardrobeCard key={item._id} item={item}
              onEdit={setEditItem} onDelete={setDelItem} />
          ))}
        </div>

      ) : (
        /* List view */
        <div className="wd-list-wrap">
          <table className="wd-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Color</th>
                <th>Occasion</th>
                <th>Season</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const meta = CAT_META[item.category] || {};
                return (
                  <tr key={item._id} className="wd-row">
                    <td>
                      <div className="wd-row-item">
                        <ItemThumb url={item.imageUrl} name={item.name} size={44} />
                        <div>
                          <p className="wd-row-name">{item.name}</p>
                          <p className="wd-row-brand">{item.color}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="wd-cat-badge" style={{ '--cc': meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td>
                      <div className="wd-color-cell">
                        <span className="wd-color-dot"
                          style={{ background: item.color?.toLowerCase() === 'white' ? '#E2E8F0' : item.color?.toLowerCase() }} />
                        <span>{item.color}</span>
                      </div>
                    </td>
                    <td>
                      {item.occasion
                        ? <span className="wd-tag">{cap(item.occasion)}</span>
                        : <span className="wd-nil">–</span>}
                    </td>
                    <td>
                      {item.season
                        ? <span className="wd-tag wd-tag--green">{cap(item.season)}</span>
                        : <span className="wd-nil">–</span>}
                    </td>
                    <td>
                      <div className="wd-row-acts">
                        <button className="wd-ra wd-ra--edit" onClick={() => setEditItem(item)} title="Edit">
                          <Ic d={I.edit} size={14} />
                        </button>
                        <button className="wd-ra wd-ra--del" onClick={() => setDelItem(item)} title="Remove">
                          <Ic d={I.trash} size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {addMode === 'clothing' && (
        <FastAddModal categoryOptions={CLOTHING_CATEGORIES} title="Add Clothing"
          onClose={() => setAddMode(null)} onSave={handleCreate} />
      )}
      {addMode === 'footwear' && (
        <FastAddModal categoryOptions={FOOTWEAR_ACCESSORY_CATEGORIES} title="Add Footwear / Accessory"
          onClose={() => setAddMode(null)} onSave={handleCreate} />
      )}
      {editItem  && <ItemModal item={editItem} onClose={() => setEditItem(null)} onSave={handleUpdate} />}
      {delItem   && <DeleteModal item={delItem} onClose={() => setDelItem(null)} onConfirm={handleDelete} />}
    </div>
  );
}
