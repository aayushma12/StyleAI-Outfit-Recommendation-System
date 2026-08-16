import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import './History.css';

const TABS = [
  { id: 'all',      label: 'All Activity' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'outfit',   label: 'Outfits' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'analytics',label: 'Analytics' },
];

const CATEGORY_META = {
  wardrobe: { label: 'Wardrobe', color: '#059669', bg: '#ECFDF5' },
  outfit:   { label: 'Outfit',   color: '#0D9488', bg: '#CCFBF1' },
  calendar: { label: 'Calendar', color: '#0891B2', bg: '#E0F9FF' },
  ai:       { label: 'AI',       color: '#D97706', bg: '#FEF3C7' },
  feedback: { label: 'Feedback', color: '#0891B2', bg: '#CFFAFE' },
  general:  { label: 'General',  color: '#64748B', bg: '#F1F5F9' },
};

const ACTION_LABELS = {
  wardrobe_added:     'Added item',
  wardrobe_updated:   'Updated item',
  wardrobe_removed:   'Removed item',
  outfit_created:     'Created outfit',
  outfit_updated:     'Updated outfit',
  outfit_deleted:     'Deleted outfit',
  calendar_scheduled: 'Scheduled outfit',
  calendar_updated:   'Updated entry',
  calendar_removed:   'Removed entry',
  ai_interaction:     'AI interaction',
  feedback_submitted: 'Submitted feedback',
  general:            'Activity',
};

const COLOR_MAP = {
  red: '#EF4444', blue: '#3B82F6', green: '#10B981', white: '#F9FAFB',
  black: '#111827', yellow: '#F59E0B', orange: '#F97316', purple: '#8B5CF6',
  pink: '#EC4899', brown: '#92400E', gray: '#6B7280', grey: '#6B7280',
  navy: '#1E3A5F', beige: '#D4B896', maroon: '#7F1D1D', olive: '#65a30d',
  teal: '#14B8A6', indigo: '#6366F1', cream: '#FEF9EE', coral: '#F87171',
};

const LIMIT = 20;

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function getGroupLabel(dateStr) {
  const d       = new Date(dateStr);
  const today   = new Date();
  const yest    = new Date(today); yest.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const monAgo  = new Date(today); monAgo.setMonth(today.getMonth() - 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yest))  return 'Yesterday';
  if (d > weekAgo) return d.toLocaleDateString('en-US', { weekday: 'long' });
  if (d > monAgo)  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function fmtFull(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function groupLogs(logs) {
  const groups = [];
  const seen   = {};
  logs.forEach(log => {
    const label = getGroupLabel(log.createdAt);
    if (!seen[label]) { seen[label] = true; groups.push({ label, items: [] }); }
    groups[groups.length - 1].items.push(log);
  });
  return groups;
}

function cap(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const Ico = {
  wardrobe: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57A1 1 0 004.85 10H6v10a2 2 0 002 2h8a2 2 0 002-2V10h1.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/>
    </svg>
  ),
  layers: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  calendar: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  star: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  activity: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  search: (sz = 16, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  trash: (sz = 15, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
  download: (sz = 16, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  close: (sz = 14, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  chevL: (sz = 16, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  chevR: (sz = 16, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

function catIcon(cat, sz = 17) {
  const meta = CATEGORY_META[cat] || CATEGORY_META.general;
  if (cat === 'wardrobe') return Ico.wardrobe(sz, meta.color);
  if (cat === 'outfit')   return Ico.layers(sz, meta.color);
  if (cat === 'calendar') return Ico.calendar(sz, meta.color);
  if (cat === 'ai')       return Ico.star(sz, meta.color);
  return Ico.activity(sz, meta.color);
}

function BarChart({ data, colorFn }) {
  if (!data || !data.length) return <div className="hst-chart-empty">No data yet</div>;
  const maxV = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="hst-barchart">
      {data.map((d, i) => (
        <div key={i} className="hst-bc-row">
          <span className="hst-bc-label" title={d.name}>{cap(d.name)}</span>
          <div className="hst-bc-track">
            <div className="hst-bc-fill" style={{ width: `${(d.count / maxV) * 100}%`, background: colorFn ? colorFn(d.name, i) : '#0D9488' }} />
          </div>
          <span className="hst-bc-val">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel, danger }) {
  return (
    <div className="hst-overlay" onClick={onCancel}>
      <div className="hst-modal" onClick={e => e.stopPropagation()}>
        <div className="hst-modal-icon">{danger ? '⚠️' : '❓'}</div>
        <h3 className="hst-modal-title">{title}</h3>
        <p className="hst-modal-msg">{message}</p>
        <div className="hst-modal-btns">
          <button className="hst-btn hst-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className={`hst-btn ${danger ? 'hst-btn--danger' : 'hst-btn--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const [tab,        setTab]        = useState('all');
  const [logs,       setLogs]       = useState([]);
  const [analytics,  setAnalytics]  = useState(null);
  const [search,     setSearch]     = useState('');
  const [filters,    setFilters]    = useState({ from: '', to: '', action: '' });
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [anaLoad,    setAnaLoad]    = useState(false);
  const [delId,      setDelId]      = useState(null);
  const [clearModal, setClearModal] = useState(false);
  const [clearCat,   setClearCat]   = useState('all');
  const [toast,      setToast]      = useState(null);

  const searchRef  = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchLogs = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT };
      if (tab !== 'all') params.category = tab;
      if (search)         params.search = search;
      if (filters.from)   params.from   = filters.from;
      if (filters.to)     params.to     = filters.to;
      if (filters.action) params.action = filters.action;
      const { data } = await api.get('/history', { params });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 0);
      setPage(pg);
    } catch {
      showToast('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, search, filters, showToast]);

  const fetchAnalytics = useCallback(async () => {
    setAnaLoad(true);
    try {
      const { data } = await api.get('/history/analytics');
      setAnalytics(data);
    } catch {
      showToast('Failed to load analytics', 'error');
    } finally {
      setAnaLoad(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === 'analytics') fetchAnalytics();
    else fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'analytics') return;
    const t = setTimeout(() => fetchLogs(1), 380);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters]);

  const confirmDelete = async () => {
    try {
      await api.delete(`/history/${delId}`);
      setDelId(null);
      showToast('History entry removed', 'success');
      fetchLogs(page);
    } catch {
      showToast('Failed to delete entry', 'error');
      setDelId(null);
    }
  };

  const confirmClear = async () => {
    try {
      const body = {};
      if (clearCat !== 'all') body.category = clearCat;
      const { data } = await api.delete('/history/bulk', { data: body });
      setClearModal(false);
      showToast(data.message || 'History cleared', 'success');
      if (tab === 'analytics') fetchAnalytics();
      else fetchLogs(1);
    } catch {
      showToast('Failed to clear history', 'error');
      setClearModal(false);
    }
  };

  const exportHistory = async () => {
    try {
      const params = { limit: 1000, page: 1 };
      if (tab !== 'all' && tab !== 'analytics') params.category = tab;
      if (search) params.search = search;
      const { data } = await api.get('/history', { params });
      const blob = new Blob([JSON.stringify(data.logs, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `styleai-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      showToast('Export downloaded', 'success');
    } catch {
      showToast('Export failed', 'error');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilters({ from: '', to: '', action: '' });
    if (searchRef.current) searchRef.current.value = '';
  };

  const hasFilters = search || filters.from || filters.to || filters.action;
  const groups     = groupLogs(logs);

  const ACTION_OPT = {
    wardrobe: ['wardrobe_added','wardrobe_updated','wardrobe_removed'],
    outfit:   ['outfit_created','outfit_updated','outfit_deleted'],
    calendar: ['calendar_scheduled','calendar_updated','calendar_removed'],
  };

  function AnalyticsPanel() {
    if (anaLoad) return <div className="hst-spinner-wrap"><span className="hst-spinner" /></div>;
    if (!analytics) return <div className="hst-empty"><span className="hst-empty-icon">📊</span><p>No analytics data yet.</p></div>;

    const { summary, activityByCategory, monthlyActivity, wardrobeBreakdown, activityByAction } = analytics;
    const catColors = { wardrobe:'#059669', outfit:'#0D9488', calendar:'#0891B2', ai:'#D97706', feedback:'#0891B2', general:'#64748B' };
    const palette   = ['#0D9488','#0891B2','#059669','#D97706','#06B6D4','#64748B','#F97316','#14B8A6'];
    const topActions = (activityByAction || []).slice(0, 6).map(a => ({ name: ACTION_LABELS[a.action] || a.action, count: a.count }));
    const maxMon    = Math.max(...(monthlyActivity || []).map(m => m.count), 1);

    return (
      <div className="hst-analytics">
        {/* Summary cards */}
        <div className="hst-ana-cards">
          {[
            { label: 'Total Events',     val: summary.totalEvents,                         color: '#0D9488' },
            { label: 'Wardrobe Items',   val: summary.totalWardrobe,                       color: '#059669' },
            { label: 'Saved Outfits',    val: summary.totalOutfits,                        color: '#0891B2' },
            { label: 'Calendar Entries', val: summary.totalCalendar,                       color: '#D97706' },
            { label: 'Avg Outfit Score', val: summary.avgOutfitScore ? `${summary.avgOutfitScore}%` : '—', color: '#0D9488' },
          ].map((c, i) => (
            <div key={i} className="hst-ana-card" style={{ borderTopColor: c.color }}>
              <div className="hst-ana-card-val" style={{ color: c.color }}>{c.val}</div>
              <div className="hst-ana-card-lbl">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="hst-ana-grid">
          {/* Monthly bar chart */}
          {monthlyActivity && monthlyActivity.length > 0 && (
            <div className="hst-ana-block hst-ana-block--wide">
              <h4 className="hst-ana-block-title">Monthly Activity</h4>
              <div className="hst-month-chart">
                {monthlyActivity.map((m, i) => (
                  <div key={i} className="hst-mon-col">
                    <span className="hst-mon-ct">{m.count}</span>
                    <div className="hst-mon-bar-wrap">
                      <div className="hst-mon-bar" style={{ height: `${(m.count / maxMon) * 100}%` }} />
                    </div>
                    <span className="hst-mon-lbl">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity by category */}
          <div className="hst-ana-block">
            <h4 className="hst-ana-block-title">Activity by Category</h4>
            <BarChart
              data={Object.entries(activityByCategory || {}).map(([k, v]) => ({ name: k, count: v }))}
              colorFn={name => catColors[name] || '#6B7280'}
            />
          </div>

          {/* Top actions */}
          {topActions.length > 0 && (
            <div className="hst-ana-block">
              <h4 className="hst-ana-block-title">Top Actions</h4>
              <BarChart data={topActions} colorFn={(_, i) => palette[i % 8]} />
            </div>
          )}

          {/* Wardrobe categories */}
          {wardrobeBreakdown?.categories?.length > 0 && (
            <div className="hst-ana-block">
              <h4 className="hst-ana-block-title">Wardrobe by Category</h4>
              <BarChart data={wardrobeBreakdown.categories} colorFn={(_, i) => palette[i % 8]} />
            </div>
          )}

          {/* Colors */}
          {wardrobeBreakdown?.colors?.length > 0 && (
            <div className="hst-ana-block">
              <h4 className="hst-ana-block-title">Wardrobe Colors</h4>
              <div className="hst-colors-grid">
                {wardrobeBreakdown.colors.map((c, i) => {
                  const hex = COLOR_MAP[c.name?.toLowerCase()] || '#9CA3AF';
                  return (
                    <div key={i} className="hst-color-item">
                      <span className="hst-color-dot" style={{ background: hex, border: c.name?.toLowerCase() === 'white' ? '1px solid #E5E7EB' : 'none' }} />
                      <span className="hst-color-nm">{cap(c.name)}</span>
                      <span className="hst-color-ct">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Occasions */}
          {wardrobeBreakdown?.occasions?.length > 0 && (
            <div className="hst-ana-block">
              <h4 className="hst-ana-block-title">Wardrobe by Occasion</h4>
              <BarChart data={wardrobeBreakdown.occasions} colorFn={(_, i) => palette[i % 8]} />
            </div>
          )}

          {/* Seasons */}
          {wardrobeBreakdown?.seasons?.length > 0 && (
            <div className="hst-ana-block">
              <h4 className="hst-ana-block-title">Season Distribution</h4>
              <div className="hst-seasons">
                {wardrobeBreakdown.seasons.map((s, i) => {
                  const sc = ({ summer:'#D97706', winter:'#0891B2', spring:'#059669', autumn:'#F97316', fall:'#F97316', all:'#0D9488' })[s.name?.toLowerCase()] || '#64748B';
                  return (
                    <div key={i} className="hst-season-chip" style={{ background: sc + '20', color: sc, border: `1px solid ${sc}40` }}>
                      {cap(s.name)} <strong>{s.count}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Manage section */}
        <div className="hst-manage">
          <h4 className="hst-manage-title">Manage History</h4>
          <p className="hst-manage-desc">
            Removing history entries only clears your activity log — it does not delete wardrobe items, outfits, or calendar data.
          </p>
          <div className="hst-manage-row">
            <select className="hst-select" value={clearCat} onChange={e => setClearCat(e.target.value)}>
              <option value="all">All history</option>
              {Object.entries(CATEGORY_META).map(([k, m]) => (
                <option key={k} value={k}>{m.label} history</option>
              ))}
            </select>
            <button className="hst-btn hst-btn--danger" onClick={() => setClearModal(true)}>
              {Ico.trash(15, '#fff')} Clear history
            </button>
          </div>
        </div>
      </div>
    );
  }

  function TimelineItem({ log }) {
    const meta     = CATEGORY_META[log.category] || CATEGORY_META.general;
    const isRemove = log.action?.includes('removed') || log.action?.includes('deleted');
    return (
      <div className="hst-item">
        <div className="hst-item-left">
          <div className="hst-item-icon" style={{ background: meta.bg }}>
            {catIcon(log.category, 16)}
          </div>
          <div className="hst-item-line" />
        </div>
        <div className="hst-item-body">
          <div className="hst-item-header">
            <span className="hst-item-title">{log.title}</span>
            <span className="hst-item-cat" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
          </div>
          {log.description && <div className="hst-item-desc">{log.description}</div>}
          {log.metadata?.itemImage && <img src={log.metadata.itemImage} alt="" className="hst-item-thumb" />}
          <div className="hst-item-foot">
            <span className="hst-item-time" title={fmtFull(log.createdAt)}>{fmtTime(log.createdAt)}</span>
            <span className="hst-item-act" style={{ color: isRemove ? '#EF4444' : '#9CA3AF' }}>
              {ACTION_LABELS[log.action] || log.action}
            </span>
            <button className="hst-item-del" onClick={() => setDelId(log._id)} title="Remove entry">
              {Ico.trash(13, '#9CA3AF')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hst-root">

      {/* Header */}
      <div className="hst-header">
        <div>
          <h2 className="hst-title">History</h2>
          <p className="hst-subtitle">Your personal fashion activity timeline</p>
        </div>
        <div className="hst-header-actions">
          <button className="hst-btn hst-btn--ghost hst-btn--sm" onClick={exportHistory}>
            {Ico.download(15)} Export
          </button>
          <button className="hst-btn hst-btn--danger-ghost hst-btn--sm" onClick={() => { setClearCat('all'); setClearModal(true); }}>
            {Ico.trash(14)} Clear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="hst-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`hst-tab${tab === t.id ? ' hst-tab--active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setPage(1);
              setSearch('');
              setFilters({ from: '', to: '', action: '' });
              if (searchRef.current) searchRef.current.value = '';
            }}
          >
            {t.label}
            {tab === t.id && t.id !== 'analytics' && total > 0 && (
              <span className="hst-tab-ct">{total}</span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      {tab !== 'analytics' && (
        <div className="hst-toolbar">
          <div className="hst-search-wrap">
            {Ico.search(15, '#9CA3AF')}
            <input
              ref={searchRef}
              className="hst-search"
              aria-label="Search by name, category, outfit"
              placeholder="Search by name, category, outfit…"
              defaultValue={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="hst-search-x" aria-label="Clear search" onClick={() => { setSearch(''); if (searchRef.current) searchRef.current.value = ''; }}>
                {Ico.close(12)}
              </button>
            )}
          </div>
          <label className="hst-date-lbl">
            From
            <input type="date" className="hst-date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </label>
          <label className="hst-date-lbl">
            To
            <input type="date" className="hst-date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </label>
          {ACTION_OPT[tab] && (
            <select className="hst-select hst-select--sm" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
              <option value="">All actions</option>
              {ACTION_OPT[tab].map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
            </select>
          )}
          {hasFilters && (
            <button className="hst-btn hst-btn--ghost hst-btn--sm" onClick={clearFilters}>
              {Ico.close(12)} Clear
            </button>
          )}
          <button className="hst-btn hst-btn--ghost hst-btn--sm hst-ml-auto" onClick={() => fetchLogs(page)}>Refresh</button>
        </div>
      )}

      {/* Content */}
      <div className="hst-content">
        {tab === 'analytics' ? (
          <AnalyticsPanel />
        ) : loading ? (
          <div className="hst-spinner-wrap"><span className="hst-spinner" /></div>
        ) : groups.length === 0 ? (
          <div className="hst-empty">
            <span className="hst-empty-icon">🕐</span>
            <p className="hst-empty-ttl">No history yet</p>
            <p className="hst-empty-sub">
              {hasFilters
                ? 'No entries match your filters.'
                : 'Start using StyleAI — add wardrobe items, build outfits, or schedule them in the calendar.'}
            </p>
            {hasFilters && <button className="hst-btn hst-btn--ghost" onClick={clearFilters}>Clear filters</button>}
          </div>
        ) : (
          <div className="hst-timeline">
            {groups.map((g, gi) => (
              <div key={gi} className="hst-group">
                <div className="hst-group-lbl">
                  <span>{g.label}</span>
                  <span className="hst-group-ct">{g.items.length}</span>
                </div>
                {g.items.map(log => <TimelineItem key={log._id} log={log} />)}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {tab !== 'analytics' && !loading && totalPages > 1 && (
          <div className="hst-pagination">
            <button className="hst-pg-btn" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
              {Ico.chevL(16)} Prev
            </button>
            <div className="hst-pg-pages">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                  acc.push(p); return acc;
                }, [])
                .map((p, i) => p === '…'
                  ? <span key={i} className="hst-pg-dot">…</span>
                  : <button key={p} className={`hst-pg-num${p === page ? ' hst-pg-num--on' : ''}`} onClick={() => fetchLogs(p)}>{p}</button>
                )}
            </div>
            <button className="hst-pg-btn" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>
              Next {Ico.chevR(16)}
            </button>
          </div>
        )}
        {tab !== 'analytics' && !loading && total > 0 && (
          <p className="hst-range-lbl">
            Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total} entries
          </p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`hst-toast hst-toast--${toast.type}`}>
          <span>{toast.msg}</span>
          <button className="hst-toast-x" onClick={() => setToast(null)}>{Ico.close(12, '#fff')}</button>
        </div>
      )}

      {/* Delete confirm */}
      {delId && (
        <ConfirmModal
          danger
          title="Remove history entry?"
          message="This removes only the activity log entry. Your wardrobe items, outfits, and calendar data remain unchanged."
          confirmLabel="Remove entry"
          onConfirm={confirmDelete}
          onCancel={() => setDelId(null)}
        />
      )}

      {/* Bulk clear confirm */}
      {clearModal && (
        <ConfirmModal
          danger
          title={`Clear ${clearCat === 'all' ? 'all' : cap(clearCat)} history?`}
          message={
            clearCat === 'all'
              ? 'This permanently deletes your entire activity log. Wardrobe, outfits, and calendar data are not affected.'
              : `This deletes all ${cap(clearCat)} history entries. The underlying ${clearCat} data is not affected.`
          }
          confirmLabel="Yes, clear history"
          onConfirm={confirmClear}
          onCancel={() => setClearModal(false)}
        />
      )}
    </div>
  );
}
