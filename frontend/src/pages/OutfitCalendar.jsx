import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import './OutfitCalendar.css';

const OCCASIONS   = ['College', 'Office', 'Party', 'Wedding', 'Festival', 'Casual', 'Travel'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBR    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const OCC_COLORS = {
  college: '#0D9488', office: '#1D4ED8', party: '#DB2777',
  wedding: '#D97706', festival: '#059669', casual: '#64748B', travel: '#0891B2',
};
const occColor = (occ) => OCC_COLORS[(occ || '').toLowerCase()] || '#0D9488';

const localKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const TODAY = localKey(new Date());

const getMonday = (date) => {
  const d    = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() + 6) % 7;          // Mon=0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
};
const addDays = (date, n) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
};

const getMonthGrid = (year, month) => {
  const first    = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const startDow = (first.getDay() + 6) % 7;
  const cells    = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
};

const fmtShortDate = (key) => {
  const d   = new Date(key + 'T12:00:00');
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  return `${dow}, ${MONTH_NAMES[d.getMonth()].slice(0,3)} ${d.getDate()}`;
};

const entryKey = (entry) => new Date(entry.date).toISOString().slice(0, 10);

const CalIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export default function OutfitCalendar() {
  /* view state */
  const [viewMode, setViewMode]   = useState('month');
  const [cursor, setCursor]       = useState(new Date());

  /* data */
  const [entries, setEntries]     = useState({});   // { 'YYYY-MM-DD': entry }
  const [savedCombos, setSavedCombos] = useState([]);
  const [upcoming, setUpcoming]   = useState([]);

  /* loading flags */
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  /* panel */
  const [panelOpen, setPanelOpen]       = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [suggestions, setSuggestions]   = useState([]);

  /* panel form */
  const [outfitMode, setOutfitMode]     = useState('manual');
  const [selectedCombo, setSelectedCombo] = useState('');
  const [manualName, setManualName]     = useState('');
  const [occasion, setOccasion]         = useState('');
  const [notes, setNotes]               = useState('');

  /* ui */
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  useEffect(() => {
    api.get('/wardrobe/outfits/saved')
      .then(r => setSavedCombos(r.data.combinations || []))
      .catch(() => {});
  }, []);

  const loadUpcoming = useCallback(async () => {
    try {
      const r = await api.get('/calendar/upcoming?days=14');
      setUpcoming(r.data.entries || []);
    } catch {}
  }, []);
  useEffect(() => { loadUpcoming(); }, [loadUpcoming]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      let r;
      if (viewMode === 'month') {
        r = await api.get(`/calendar?year=${cursor.getFullYear()}&month=${cursor.getMonth() + 1}`);
      } else {
        const mon = getMonday(cursor);
        r = await api.get(`/calendar/week?date=${localKey(mon)}`);
      }
      const map = {};
      (r.data.entries || []).forEach(e => { map[entryKey(e)] = e; });
      setEntries(map);
    } catch {}
    setLoading(false);
  }, [viewMode, cursor]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const openPanel = useCallback((dateKey) => {
    const isPast    = dateKey < TODAY;
    const existing  = entries[dateKey];

    if (isPast && !existing) {
      showToast('You cannot schedule outfits for a past date. Please choose today or a future date.');
      return;
    }
    if (existing && !isPast) {
      showToast(`Outfit already planned: "${existing.outfitName || existing.combo?.name || 'Outfit'}". You can edit or remove it below.`);
    }
    setSelectedDate(dateKey);
    if (existing) {
      const mode = existing.combo ? 'combo' : 'manual';
      setOutfitMode(mode);
      setSelectedCombo(existing.combo?._id || '');
      setManualName(existing.outfitName || '');
      setOccasion(existing.occasion || '');
      setNotes(existing.notes || '');
    } else {
      setOutfitMode('manual');
      setSelectedCombo('');
      setManualName('');
      setOccasion('');
      setNotes('');
    }
    setSuggestions([]);
    setPanelOpen(true);
  }, [entries]);

  const fetchSuggestions = async () => {
    if (!selectedDate) return;
    setAiLoading(true);
    try {
      const r = await api.get(`/calendar/suggest?date=${selectedDate}&occasion=${occasion}`);
      setSuggestions(r.data.suggestions || []);
      if (!r.data.suggestions?.length) showToast('No suggestions found. Try adding more combos to your wardrobe.');
    } catch { showToast('Could not fetch suggestions.'); }
    setAiLoading(false);
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    if (selectedDate < TODAY) {
      showToast('You cannot schedule outfits for a past date. Please choose today or a future date.');
      return;
    }
    const outfitName = outfitMode === 'combo'
      ? (savedCombos.find(c => c._id === selectedCombo)?.name || '')
      : manualName.trim();
    if (!outfitName && !selectedCombo) {
      showToast('Please enter an outfit name or select a combo.');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post('/calendar', {
        date: selectedDate,
        outfitName,
        combo: outfitMode === 'combo' ? (selectedCombo || null) : null,
        occasion,
        notes,
      });
      setEntries(prev => ({ ...prev, [selectedDate]: r.data.entry }));
      await loadUpcoming();
      setPanelOpen(false);
      showToast(entries[selectedDate] ? 'Outfit plan updated!' : 'Outfit planned!');
    } catch { showToast('Failed to save. Please try again.'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    const entry = entries[selectedDate];
    if (!entry) return;
    setDeleting(true);
    try {
      await api.delete(`/calendar/${entry._id}`);
      setEntries(prev => { const n = { ...prev }; delete n[selectedDate]; return n; });
      await loadUpcoming();
      setPanelOpen(false);
      showToast('Entry removed.');
    } catch { showToast('Failed to delete.'); }
    setDeleting(false);
  };

  const navPrev = () => {
    if (viewMode === 'month') setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else setCursor(d => addDays(d, -7));
  };
  const navNext = () => {
    if (viewMode === 'month') setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else setCursor(d => addDays(d, 7));
  };

  const monthCells = useMemo(() => getMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const weekDays = useMemo(() => {
    const mon = getMonday(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [cursor]);

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const mon = getMonday(cursor);
    const sun = addDays(mon, 6);
    const sameMonth = mon.getMonth() === sun.getMonth();
    return sameMonth
      ? `${MONTH_NAMES[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}, ${sun.getFullYear()}`
      : `${MONTH_NAMES[mon.getMonth()].slice(0,3)} ${mon.getDate()} – ${MONTH_NAMES[sun.getMonth()].slice(0,3)} ${sun.getDate()}, ${sun.getFullYear()}`;
  }, [viewMode, cursor]);

  const selEntry = selectedDate ? entries[selectedDate] : null;

  return (
    <div className="oc-wrap">
      {/* Toast */}
      {toast && <div className="oc-toast">{toast}</div>}

      {/* Page header */}
      <div className="oc-page-hd">
        <div className="oc-page-hd-icon"><CalIcon /></div>
        <div>
          <h2>Outfit Calendar</h2>
          <p>Plan and schedule your outfits for upcoming days</p>
        </div>
      </div>

      {/* Body: calendar + assignment panel */}
      <div className="oc-body">

        <div className="oc-cal-area">
          <div className="oc-cal-card">

            {/* Toolbar */}
            <div className="oc-toolbar">
              <div className="oc-vswitch">
                <button className={`oc-vs-btn${viewMode==='month'?' --active':''}`} onClick={()=>setViewMode('month')}>Month</button>
                <button className={`oc-vs-btn${viewMode==='week'?' --active':''}`}  onClick={()=>setViewMode('week')}>Week</button>
              </div>
              <div className="oc-nav-ctrl">
                <button className="oc-nav-btn" onClick={navPrev} title="Previous">‹</button>
                <span className="oc-period-label">{headerLabel}</span>
                <button className="oc-nav-btn" onClick={navNext} title="Next">›</button>
                <button className="oc-today-btn" onClick={()=>setCursor(new Date())}>Today</button>
              </div>
            </div>

            {/* Day-of-week header */}
            {viewMode === 'month' && (
              <div className="oc-dow-row">
                {DAY_ABBR.map(d => <div key={d} className="oc-dow-cell">{d}</div>)}
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="oc-skel-grid">
                {Array.from({ length: viewMode === 'month' ? 35 : 7 }).map((_, i) => (
                  <div key={i} className="oc-skel-cell" />
                ))}
              </div>
            ) : viewMode === 'month' ? (
              <div className="oc-month-grid">
                {monthCells.map((date, i) => {
                  if (!date) return <div key={i} className="oc-day-cell --empty" />;
                  const key     = localKey(date);
                  const entry   = entries[key];
                  const isToday = key === TODAY;
                  const isSel   = key === selectedDate && panelOpen;
                  const isPast  = key < TODAY;
                  const occ     = (entry?.occasion || '').toLowerCase();
                  return (
                    <div
                      key={key}
                      className={`oc-day-cell${isToday?' --today':''}${isSel?' --selected':''}${entry?' --has-entry':''}${isPast&&!isToday?' --past':''}`}
                      onClick={() => openPanel(key)}
                      style={isPast && !entry ? { cursor: 'not-allowed' } : undefined}
                    >
                      <span className="oc-day-num">{date.getDate()}</span>
                      {entry && (
                        <div
                          className="oc-entry-chip"
                          style={{ background: occColor(occ) + '1A', borderColor: occColor(occ) }}
                        >
                          <span className="oc-chip-dot" style={{ background: occColor(occ) }} />
                          <span className="oc-chip-label">
                            {entry.outfitName || entry.combo?.name || 'Outfit'}
                          </span>
                        </div>
                      )}
                      {!entry && !isPast && <div className="oc-add-hint">+</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="oc-week-grid">
                {weekDays.map((date) => {
                  const key     = localKey(date);
                  const entry   = entries[key];
                  const isToday = key === TODAY;
                  const isSel   = key === selectedDate && panelOpen;
                  const isPast  = key < TODAY;
                  const occ     = (entry?.occasion || '').toLowerCase();
                  const dowIdx  = (date.getDay() + 6) % 7;
                  return (
                    <div
                      key={key}
                      className={`oc-week-day${isToday?' --today':''}${isSel?' --selected':''}${entry?' --has-entry':''}${isPast&&!isToday?' --past':''}`}
                      onClick={() => openPanel(key)}
                      style={isPast && !entry ? { cursor: 'not-allowed', opacity: 0.55 } : undefined}
                    >
                      <div className="oc-wd-hd">
                        <span className="oc-wd-name">{DAY_ABBR[dowIdx]}</span>
                        <span className={`oc-wd-num${isToday?' --today':''}`}>{date.getDate()}</span>
                      </div>
                      {entry ? (
                        <div className="oc-wd-entry">
                          <div
                            className="oc-wd-badge"
                            style={{ background: occColor(occ) + '1A', borderColor: occColor(occ) }}
                          >
                            <span className="oc-wd-dot" style={{ background: occColor(occ) }} />
                            {entry.outfitName || entry.combo?.name || 'Outfit'}
                          </div>
                          {entry.occasion && <span className="oc-wd-occ">{entry.occasion}</span>}
                          {entry.notes && <p className="oc-wd-notes">{entry.notes}</p>}
                        </div>
                      ) : (
                        <div className="oc-wd-empty">
                          <span className="oc-wd-add">+ Plan outfit</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {panelOpen && selectedDate && (
          <aside className="oc-assign-panel">
            <div className="oc-panel-scroll">
              {/* Header */}
              <div className="oc-ap-hd">
                <div>
                  <p className="oc-ap-date">{fmtShortDate(selectedDate)}</p>
                  <h3 className="oc-ap-title">{selEntry ? 'Edit Outfit Plan' : 'Plan Your Outfit'}</h3>
                </div>
                <button className="oc-ap-close" onClick={() => setPanelOpen(false)}>✕</button>
              </div>

              {/* Past date warning */}
              {selectedDate < TODAY && (
                <div className="oc-past-warning">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="oc-past-warning-text">
                    {selEntry
                      ? 'This is a past date. You can view this plan but cannot modify it.'
                      : 'You cannot schedule outfits for a past date. Please choose today or a future date.'}
                  </span>
                </div>
              )}

              {/* Already-planned notice */}
              {selEntry && selectedDate >= TODAY && (
                <div className="oc-already-notice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="oc-already-notice-text">
                    This date already has <strong>{selEntry.outfitName || selEntry.combo?.name || 'an outfit'}</strong> planned.
                    You are now editing the existing plan.
                  </span>
                </div>
              )}

              {/* Mode toggle */}
              <div className="oc-mode-toggle">
                <button
                  className={`oc-mt-btn${outfitMode==='manual'?' --active':''}`}
                  onClick={() => setOutfitMode('manual')}
                >Custom Name</button>
                <button
                  className={`oc-mt-btn${outfitMode==='combo'?' --active':''}`}
                  onClick={() => setOutfitMode('combo')}
                >From Wardrobe</button>
              </div>

              {/* Outfit input */}
              {outfitMode === 'manual' ? (
                <div className="oc-field">
                  <label className="oc-label">Outfit Name</label>
                  <input
                    className="oc-input"
                    placeholder="e.g. College Outfit, Wedding Look…"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                  />
                </div>
              ) : (
                <div className="oc-field">
                  <label className="oc-label">Saved Combination</label>
                  {savedCombos.length === 0 ? (
                    <p className="oc-no-combos">
                      No saved outfits yet. Create one in Outfit Builder first.
                    </p>
                  ) : (
                    <select
                      className="oc-select"
                      value={selectedCombo}
                      onChange={e => setSelectedCombo(e.target.value)}
                    >
                      <option value="">— Choose a combo —</option>
                      {savedCombos.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.name || 'Unnamed'}{c.matchScore ? ` (${c.matchScore}%)` : ''}
                          {c.occasion ? ` · ${c.occasion}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Occasion */}
              <div className="oc-field">
                <label className="oc-label">Occasion</label>
                <div className="oc-occ-grid">
                  {OCCASIONS.map(o => (
                    <button
                      key={o}
                      className={`oc-occ-btn${occasion===o?' --active':''}`}
                      style={occasion === o
                        ? { background: occColor(o.toLowerCase()), borderColor: occColor(o.toLowerCase()), color: '#fff' }
                        : {}}
                      onClick={() => setOccasion(prev => prev === o ? '' : o)}
                    >{o}</button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="oc-field">
                <label className="oc-label">Notes <span className="oc-optional">(optional)</span></label>
                <textarea
                  className="oc-textarea"
                  placeholder="Accessories, weather tip, event time…"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* AI suggestions */}
              <div className="oc-ai-section">
                <div className="oc-ai-hd">
                  <span className="oc-ai-label">✦ AI Suggestions</span>
                  <button className="oc-ai-btn" onClick={fetchSuggestions} disabled={aiLoading}>
                    {aiLoading ? 'Thinking…' : 'Get Suggestions'}
                  </button>
                </div>
                {suggestions.length > 0 && (
                  <div className="oc-suggestions">
                    {suggestions.map((s, i) => (
                      <div
                        key={s._id || i}
                        className="oc-sug-card"
                        onClick={() => {
                          setOutfitMode('combo');
                          setSelectedCombo(s._id);
                          if (s.occasion) setOccasion(s.occasion);
                        }}
                      >
                        <div className="oc-sug-top">
                          <span className="oc-sug-name">{s.name}</span>
                          {s.matchScore > 0 && <span className="oc-sug-score">{s.matchScore}%</span>}
                        </div>
                        {s.reasons.slice(0, 2).map((r, ri) => (
                          <p key={ri} className="oc-sug-reason">✓ {r}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action bar */}
            <div className="oc-ap-actions">
              <button className="oc-save-btn" onClick={handleSave} disabled={saving || selectedDate < TODAY}>
                {saving ? 'Saving…' : selEntry ? 'Update Plan' : 'Save Plan'}
              </button>
              {selEntry && (
                <button className="oc-del-btn" onClick={handleDelete} disabled={deleting}>
                  {deleting ? '…' : 'Remove'}
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      <section className="oc-upcoming">
        <h3 className="oc-up-title">Upcoming Outfit Schedule</h3>
        {upcoming.length === 0 ? (
          <p className="oc-up-empty">
            No outfits planned for the next 14 days. Click any date on the calendar to start planning!
          </p>
        ) : (
          <div className="oc-up-list">
            {upcoming.map(entry => {
              const key     = entryKey(entry);
              const occ     = (entry.occasion || '').toLowerCase();
              const isToday = key === TODAY;
              const d       = new Date(key + 'T12:00:00');
              const dow     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
              return (
                <div
                  key={entry._id}
                  className={`oc-up-item${isToday?' --today':''}`}
                  onClick={() => {
                    if (viewMode === 'month') {
                      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                    } else {
                      setCursor(d);
                    }
                    setTimeout(() => openPanel(key), 80);
                  }}
                >
                  {isToday && <span className="oc-up-today-badge">Today</span>}
                  <div className="oc-up-date-col">
                    <span className="oc-up-dow">{dow}</span>
                    <span className="oc-up-dom">{d.getDate()}</span>
                  </div>
                  <div className="oc-up-content">
                    <span className="oc-up-name">
                      {entry.outfitName || entry.combo?.name || 'Outfit'}
                    </span>
                    {entry.occasion && (
                      <span
                        className="oc-up-occ"
                        style={{ background: occColor(occ) + '1A', color: occColor(occ) }}
                      >{entry.occasion}</span>
                    )}
                    {entry.notes && <p className="oc-up-notes">{entry.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
