import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { getMatchBadge } from '../utils/confidenceScale';
import useDebounce from '../hooks/useDebounce';
import './SavedOutfits.css';

const Ic = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  trash:    "M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2",
  edit:     "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.41-9.41a2 2 0 112.83 2.83L11.83 15H9v-2.83z",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11 3a3 3 0 100-6 3 3 0 000 6z",
  hanger:   "M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z",
  layers:   "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  close:    "M18 6L6 18M6 6l12 12",
  save:     "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zm-7-1v-8H7v8",
  search:   "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  heart:    "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  sparkle:  "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z",
};

const OCCASIONS = ['daily', 'college', 'office', 'party', 'date', 'formal', 'festival', 'wedding', 'travel', 'gym'];
const SEASONS   = ['winter', 'spring', 'monsoon', 'autumn', 'all'];
const STYLE_TAG_OPTS = ['minimalist', 'streetwear', 'smart_casual', 'korean', 'vintage', 'preppy',
  'athleisure', 'romantic', 'edgy', 'boho', 'classic', 'grunge', 'cottagecore', 'y2k', 'modest_chic'];

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';

function OutfitDetailModal({ combo, onClose, onDelete }) {
  return (
    <>
      <div className="so-modal-bg" onClick={onClose} />
      <div className="so-modal">
        <div className="so-modal-hd">
          <h3>{combo.name || 'Unnamed Outfit'}</h3>
          <button className="so-modal-close" onClick={onClose} aria-label="Close dialog"><Ic d={I.close} size={16} /></button>
        </div>
        <div className="so-modal-body">
          {combo.occasion && (
            <div className="so-modal-row">
              <span className="so-modal-lbl">Occasion</span>
              <span className="so-modal-val">{cap(combo.occasion)}</span>
            </div>
          )}
          {combo.season && (
            <div className="so-modal-row">
              <span className="so-modal-lbl">Season</span>
              <span className="so-modal-val">{cap(combo.season)}</span>
            </div>
          )}
          {combo.weatherSnapshot?.temp != null && (
            <div className="so-modal-row">
              <span className="so-modal-lbl">Weather</span>
              <span className="so-modal-val">{combo.weatherSnapshot.temp}°C · {combo.weatherSnapshot.condition}</span>
            </div>
          )}
          {combo.notes && (
            <div className="so-modal-row">
              <span className="so-modal-lbl">Notes</span>
              <span className="so-modal-val">{combo.notes}</span>
            </div>
          )}
          {combo.source === 'recommendation' && combo.aiExplanation?.summary && (
            <div className="so-modal-ai">
              <div className="so-modal-ai-hd"><Ic d={I.sparkle} size={13} /> Why this outfit was recommended</div>
              <p className="so-modal-ai-summary">{combo.aiExplanation.summary}</p>
              <ul className="so-modal-ai-reasons">
                {[combo.aiExplanation.styleReason, combo.aiExplanation.colorReason,
                  combo.aiExplanation.occasionReason, combo.aiExplanation.weatherReason]
                  .filter(Boolean).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          <div className="so-modal-lbl" style={{ marginTop: 16, marginBottom: 10 }}>Items in this outfit</div>
          <div className="so-items-grid">
            {(combo.items || []).filter(Boolean).map(item => (
              <div key={item._id} className="so-item-chip">
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} className="so-item-img" loading="lazy" />
                  : <div className="so-item-ph"><Ic d={I.hanger} size={18} /></div>}
                <div className="so-item-info">
                  <div className="so-item-name">{item.name}</div>
                  <div className="so-item-cat">{cap(item.category)} · {item.color}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="so-modal-ft">
          <button className="so-btn so-btn--danger" onClick={() => { onDelete(combo._id); onClose(); }}>
            <Ic d={I.trash} size={14} /> Delete Outfit
          </button>
          <button className="so-btn so-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

export default function SavedOutfits() {
  const [combos, setCombos]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [detail, setDetail]     = useState(null);
  const [toast, setToast]       = useState('');
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState('');

  const [search,        setSearch]        = useState('');
  const [occasionFilter, setOccasionFilter] = useState('');
  const [seasonFilter,   setSeasonFilter]   = useState('');
  const [styleFilter,    setStyleFilter]    = useState('');
  const [favoritesOnly,  setFavoritesOnly]  = useState(false);
  const [sortBy,         setSortBy]         = useState('createdAt:desc');

  const dSearch = useDebounce(search, 380);
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sf, sd] = sortBy.split(':');
      const params = new URLSearchParams({
        search: dSearch, sort: sf, sortDir: sd,
        ...(occasionFilter && { occasion: occasionFilter }),
        ...(seasonFilter   && { season: seasonFilter }),
        ...(styleFilter    && { style: styleFilter }),
        ...(favoritesOnly  && { favoritesOnly: 'true' }),
      });
      const { data } = await api.get(`/wardrobe/outfits/saved?${params}`);
      setCombos(data.combinations || []);
    } catch {}
    setLoading(false);
  }, [dSearch, occasionFilter, seasonFilter, styleFilter, favoritesOnly, sortBy]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/wardrobe/outfits/${id}`);
      setCombos(prev => prev.filter(c => c._id !== id));
      showToast('Outfit deleted.');
    } catch { showToast('Delete failed.'); }
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    try {
      const { data } = await api.put(`/wardrobe/outfits/${id}`, { name: editName.trim() });
      setCombos(prev => prev.map(c => c._id === id ? data.combination : c));
      setEditId(null);
      showToast('Outfit renamed.');
    } catch { showToast('Rename failed.'); }
  };

  const handleToggleFavorite = async (combo) => {
    try {
      const { data } = await api.put(`/wardrobe/outfits/${combo._id}`, { isLiked: !combo.isLiked });
      setCombos(prev => prev.map(c => c._id === combo._id ? data.combination : c));
    } catch { showToast('Could not update favorite.'); }
  };

  const handleReuse = async (id) => {
    try {
      const { data } = await api.post(`/wardrobe/outfits/${id}/reuse`);
      setCombos(prev => prev.map(c => c._id === id ? data.combination : c));
      showToast('Nice pick — logged as worn again.');
    } catch { showToast('Could not reuse outfit.'); }
  };

  const clearAll = () => { setSearch(''); setOccasionFilter(''); setSeasonFilter(''); setStyleFilter(''); setFavoritesOnly(false); };
  const activeFilters = [
    ...(occasionFilter ? [{ label: cap(occasionFilter), clear: () => setOccasionFilter('') }] : []),
    ...(seasonFilter   ? [{ label: cap(seasonFilter),   clear: () => setSeasonFilter('') }] : []),
    ...(styleFilter    ? [{ label: cap(styleFilter),    clear: () => setStyleFilter('') }] : []),
    ...(favoritesOnly  ? [{ label: 'Favorites only',    clear: () => setFavoritesOnly(false) }] : []),
  ];

  if (loading && combos.length === 0) return <div className="so-loading">Loading saved outfits…</div>;

  return (
    <div className="so-root">
      {toast && <div className="so-toast">{toast}</div>}
      {detail && (
        <OutfitDetailModal
          combo={detail}
          onClose={() => setDetail(null)}
          onDelete={handleDelete}
        />
      )}

      {/* Header */}
      <div className="so-header">
        <div className="so-header-icon"><Ic d={I.bookmark} size={22} /></div>
        <div>
          <h2 className="so-title">Saved Outfits</h2>
          <p className="so-sub">{combos.length} outfit{combos.length !== 1 ? 's' : ''} saved</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="so-toolbar">
        <div className="so-search-box">
          <Ic d={I.search} size={15} />
          <input placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button className="so-search-x" onClick={() => setSearch('')}><Ic d={I.close} size={13} /></button>
          )}
        </div>
        <div className="so-toolbar-right">
          <select className="so-sel" value={occasionFilter} onChange={e => setOccasionFilter(e.target.value)}>
            <option value="">All Occasions</option>
            {OCCASIONS.map(o => <option key={o} value={o}>{cap(o)}</option>)}
          </select>
          <select className="so-sel" value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}>
            <option value="">All Seasons</option>
            {SEASONS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
          <select className="so-sel" value={styleFilter} onChange={e => setStyleFilter(e.target.value)}>
            <option value="">All Styles</option>
            {STYLE_TAG_OPTS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
          <select className="so-sel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="createdAt:desc">Newest First</option>
            <option value="createdAt:asc">Oldest First</option>
            <option value="matchScore:desc">Highest Score</option>
            <option value="name:asc">Name A→Z</option>
          </select>
          <button className={`so-fav-toggle${favoritesOnly ? ' active' : ''}`}
            onClick={() => setFavoritesOnly(f => !f)} title="Favorites only">
            <Ic d={I.heart} size={14} /> Favorites
          </button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="so-af-row">
          <span className="so-af-lbl">Filters:</span>
          {activeFilters.map((f, i) => (
            <button key={i} className="so-af-pill" onClick={f.clear}>
              {f.label} <Ic d={I.close} size={11} />
            </button>
          ))}
          <button className="so-af-clear" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {combos.length === 0 ? (
        <div className="so-empty">
          <div className="so-empty-icon"><Ic d={I.layers} size={36} /></div>
          <h3>No saved outfits found</h3>
          <p>Save an AI recommendation or build one in Outfit Builder to see it here.</p>
        </div>
      ) : (
        <div className="so-grid">
          {combos.map(combo => {
            const isAiPick = combo.source === 'recommendation';
            const match = isAiPick && combo.aiConfidence != null ? getMatchBadge(combo.aiConfidence) : null;
            return (
              <div key={combo._id} className="so-card">
                <div className="so-card-imgs">
                  {combo.previewImage?.url ? (
                    <img className="so-card-preview" src={combo.previewImage.url} alt={combo.name || 'Outfit preview'} loading="lazy" />
                  ) : (
                    <>
                      {(combo.items || []).filter(Boolean).slice(0, 4).map((item, i) => (
                        <div key={item._id || i} className="so-card-img-slot">
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} loading="lazy" />
                            : <div className="so-card-img-ph"><Ic d={I.hanger} size={20} /></div>}
                        </div>
                      ))}
                      {(combo.items || []).filter(Boolean).length === 0 && (
                        <div className="so-card-img-ph"><Ic d={I.layers} size={28} /></div>
                      )}
                    </>
                  )}
                  {match && (
                    <div className="so-card-badge" style={{ background: match.bg, color: match.color, border: `1.5px solid ${match.border}` }}>
                      {match.text}
                    </div>
                  )}
                  <button
                    className={`so-card-fav${combo.isLiked ? ' active' : ''}`}
                    onClick={() => handleToggleFavorite(combo)}
                    title={combo.isLiked ? 'Remove favorite' : 'Mark as favorite'}
                  >
                    <Ic d={I.heart} size={15} />
                  </button>
                </div>

                <div className="so-card-body">
                  {editId === combo._id ? (
                    <div className="so-edit-row">
                      <input
                        className="so-edit-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(combo._id); if (e.key === 'Escape') setEditId(null); }}
                        autoFocus
                      />
                      <button className="so-edit-save" onClick={() => handleRename(combo._id)}>
                        <Ic d={I.save} size={14} />
                      </button>
                      <button className="so-edit-cancel" onClick={() => setEditId(null)}>
                        <Ic d={I.close} size={14} />
                      </button>
                    </div>
                  ) : (
                    <h3 className="so-card-name">{combo.name || 'Unnamed Outfit'}</h3>
                  )}
                  <div className="so-card-meta">
                    <span className={`so-tag${isAiPick ? ' so-tag--ai' : ''}`}>
                      {isAiPick ? <><Ic d={I.sparkle} size={10} /> AI Pick</> : 'Custom Build'}
                    </span>
                    {combo.occasion && <span className="so-tag">{cap(combo.occasion)}</span>}
                    {combo.season && <span className="so-tag-muted">{cap(combo.season)}</span>}
                    <span className="so-tag-muted">{(combo.items || []).filter(Boolean).length} item{(combo.items || []).filter(Boolean).length !== 1 ? 's' : ''}</span>
                    <span className="so-tag-muted">{new Date(combo.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="so-card-actions">
                  <button className="so-act-btn" onClick={() => setDetail(combo)} title="View Details">
                    <Ic d={I.eye} size={15} />
                  </button>
                  <button className="so-act-btn" onClick={() => { setEditId(combo._id); setEditName(combo.name || ''); }} title="Rename">
                    <Ic d={I.edit} size={15} />
                  </button>
                  <button className="so-act-btn" onClick={() => handleReuse(combo._id)} title="Wear this again">
                    <Ic d={I.refresh} size={15} />
                  </button>
                  <button className="so-act-btn so-act-btn--del" onClick={() => handleDelete(combo._id)} title="Delete">
                    <Ic d={I.trash} size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
