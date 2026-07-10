/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AdminDashboard.css';

// ── SVG icon helper ───────────────────────────────────────────────────────────
function Ic({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

// Icon path constants
const IC = {
  overview:  ['M3 3h7v7H3z','M13 3h7v7h-7z','M3 13h7v7H3z','M13 13h7v7h-7z'],
  users:     ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
  outfits:   ['M4 6h16','M4 12h16','M4 18h16'],
  mountain:  'M3 20l5.5-11 3.5 5 3-4.5L20 20H3z',
  recs:      'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  ml:        ['M12 2a5 5 0 0 1 5 5v2h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1h2V7a5 5 0 0 1 5-5z','M12 14a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
  feedback:  ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  logs:      ['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2','M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2','M9 12h6','M9 16h4'],
  settings:  ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  logout:    ['M17 16l4-4m0 0l-4-4m4 4H7','M13 20v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1'],
  search:    'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  plus:      ['M12 5v14','M5 12h14'],
  x:         ['M18 6L6 18','M6 6l12 12'],
  edit:      ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7','M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  trash:     ['M3 6h18','M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6','M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2'],
  refresh:   ['M1 4v6h6','M23 20v-6h-6','M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15'],
  download:  ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M7 10l5 5 5-5','M12 15V3'],
  eye:       ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z','M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  chevLeft:  'M15 18l-6-6 6-6',
  chevRight: 'M9 18l6-6-6-6',
  user:      ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2','M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  lock:      ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M7 11V7a5 5 0 0 1 10 0v4'],
  menu:      ['M3 12h18','M3 6h18','M3 18h18'],
  check:     'M20 6L9 17l-5-5',
  alertCircle: ['M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z','M12 8v4','M12 16h.01'],
  bar:       ['M18 20V10','M12 20V4','M6 20v-6'],
  wardrobe:  ['M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z','M3 6h18','M16 10a4 4 0 0 1-8 0'],
  bookmark:  ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  calendar:  ['M3 4h18v18H3z','M16 2v4','M8 2v4','M3 10h18'],
  sparkle:   ['M5 3v4M3 5h4M6 17v4M4 19h4M13 3l3 3-3 3M17 13l3 3-3 3'],
  shield:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  zap:       'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  banned:    ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z','M12 9v4','M12 17h.01'],
  cpu:       ['M9 3H5a2 2 0 0 0-2 2v4','M9 3h6','M15 3h4a2 2 0 0 1 2 2v4','M21 9v6','M21 15h-4a6 6 0 0 0-6 6v4','M15 21H9','M9 21H5a2 2 0 0 1-2-2v-4','M3 15V9','M3 9h4a6 6 0 0 0 6-6V0'],
  clipboard: ['M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z','M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2','M9 12h6','M9 16h6'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = n => (n ?? 0).toLocaleString();
const pct     = (n, t) => (t > 0 ? Math.round((n / t) * 100) : 0);
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—';

// ── Primitive UI components ───────────────────────────────────────────────────

function Badge({ label, color = 'blue' }) {
  return <span className={`ad-badge ad-badge-${color}`}>{label}</span>;
}

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`ad-btn ad-btn-${variant}${size === 'sm' ? ' ad-btn-sm' : ''}`}>
      {children}
    </button>
  );
}

function Inp({ label, ...props }) {
  return (
    <div className="ad-field">
      {label && <label className="ad-field-label">{label}</label>}
      <input {...props} className="ad-input" />
    </div>
  );
}

function Sel({ label, children, ...props }) {
  return (
    <div className="ad-field">
      {label && <label className="ad-field-label">{label}</label>}
      <select {...props} className="ad-input ad-input-sel">
        {children}
      </select>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="ad-modal-backdrop">
      <div className="ad-modal">
        <div className="ad-modal-hd">
          <h3 className="ad-modal-title">{title}</h3>
          <button className="ad-modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const visible = Math.min(pages, 7);
  return (
    <div className="ad-pagination">
      <button className="ad-page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <Ic d={IC.chevLeft} />
      </button>
      {Array.from({ length: visible }, (_, i) => {
        const p = i + 1;
        return (
          <button key={p} onClick={() => onPage(p)}
            className={`ad-page-btn${p === page ? ' active' : ''}`}>{p}</button>
        );
      })}
      <button className="ad-page-btn" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        <Ic d={IC.chevRight} />
      </button>
    </div>
  );
}

function StatCard({ icon, label, value, sub, bg = '#0D9488' }) {
  return (
    <div className="ad-stat">
      <div className="ad-stat-icon" style={{ background: bg }}>
        <Ic d={IC[icon] || IC.bar} size={20} />
      </div>
      <div className="ad-stat-body">
        <div className="ad-stat-val">{value}</div>
        <div className="ad-stat-label">{label}</div>
        {sub && <div className="ad-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function ToastContainer({ toasts, remove }) {
  return (
    <div className="ad-toasts">
      {toasts.map(t => (
        <div key={t.id} className={`ad-toast ad-toast-${t.type}`}>
          <span>{t.msg}</span>
          <button className="ad-toast-close" onClick={() => remove(t.id)} aria-label="Dismiss notification">×</button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);
  const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, toast, remove };
}

function Spinner({ text = 'Loading…' }) {
  return (
    <div className="ad-spinner-wrap">
      <div className="ad-spinner" />
      <span>{text}</span>
    </div>
  );
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const TABS = [
  { key:'overview',   label:'Overview',        icon:'overview'  },
  { key:'users',      label:'Users',           icon:'users'     },
  { key:'moderation', label:'Content',         icon:'wardrobe'  },
  { key:'catalog',    label:'Outfit Catalog',  icon:'outfits'   },
  { key:'kathmandu',  label:'Kathmandu Intel', icon:'mountain'  },
  { key:'recs',      label:'Recommendations', icon:'recs'      },
  { key:'ml',        label:'ML Model',        icon:'ml'        },
  { key:'feedback',  label:'Feedback',        icon:'feedback'  },
  { key:'evaluation',label:'Evaluation',      icon:'clipboard' },
  { key:'logs',      label:'Logs',            icon:'logs'      },
  { key:'settings',  label:'Settings',        icon:'settings'  },
];

const TREND_TYPES = ['fashion_trend','seasonal','festival','venue','local_brand'];
const KTM_SEASONS = ['spring','summer','monsoon','autumn','winter','all'];
const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Status bar colors (design-system aligned)
const STATUS_CLR = {
  liked:'#059669', worn:'#0D9488', saved:'#D97706',
  disliked:'#DC2626', skipped:'#9CA3AF', pending:'#D1D5DB',
};

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab({ toast }) {
  const [stats,   setStats]   = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [recAna,  setRecAna]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/analytics'),
      api.get('/admin/rec-analytics'),
    ]).then(([s, a, r]) => {
      setStats(s.data.stats);
      setMonthly(a.data.monthly || []);
      setRecAna(r.data);
    }).catch(() => toast('Failed to load dashboard data.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner text="Loading dashboard…" />;

  const maxVal = Math.max(...monthly.map(m => m.users + m.wardrobeItems + m.outfits), 1);

  return (
    <div>
      <div className="ad-stats-grid">
        <StatCard icon="users"    label="Total Users"      value={fmt(stats?.totalUsers)}          sub={`${fmt(stats?.activeUsers)} active`}    bg="#0D9488" />
        <StatCard icon="banned"   label="Suspended"        value={fmt(stats?.suspendedUsers)}                                                     bg="#DC2626" />
        <StatCard icon="wardrobe" label="Wardrobe Items"   value={fmt(stats?.totalWardrobeItems)}                                                  bg="#059669" />
        <StatCard icon="bookmark" label="Saved Outfits"    value={fmt(stats?.totalSavedOutfits)}                                                   bg="#D97706" />
        <StatCard icon="calendar" label="Calendar Entries" value={fmt(stats?.totalCalendarEntries)}                                                bg="#06B6D4" />
        <StatCard icon="feedback" label="Feedback Pending" value={fmt(stats?.pendingFeedbacks)}    sub={`${fmt(stats?.totalFeedbacks)} total`}    bg="#EA580C" />
        <StatCard icon="sparkle"  label="Acceptance Rate"  value={recAna ? `${recAna.acceptanceRate}%` : '—'} sub={`${recAna?.avgConfidence ?? 0}% avg conf`} bg="#DB2777" />
      </div>

      <div className="ad-charts-2">
        <div className="ad-card ad-card-p">
          <h4 className="ad-card-title">6-Month Activity</h4>
          <div className="ad-vchart">
            {monthly.map(m => {
              const h = Math.round(((m.users + m.wardrobeItems + m.outfits) / maxVal) * 100);
              return (
                <div key={m.month} className="ad-vchart-col"
                     title={`Users: ${m.users}  Items: ${m.wardrobeItems}  Outfits: ${m.outfits}`}>
                  <div className="ad-vchart-bar" style={{ height: `${h || 2}%` }} />
                  <span className="ad-vchart-lbl">{m.month}</span>
                </div>
              );
            })}
          </div>
          {monthly.length === 0 && <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>No monthly data yet.</p>}
        </div>

        {recAna && (
          <div className="ad-card ad-card-p">
            <h4 className="ad-card-title">Recommendation Status</h4>
            {Object.entries(recAna.statusBreakdown || {}).map(([k, v]) => {
              const t = Object.values(recAna.statusBreakdown).reduce((a, b) => a + b, 0);
              const w = pct(v, t);
              return (
                <div key={k} className="ad-bar-row">
                  <div className="ad-bar-hd">
                    <span style={{ textTransform:'capitalize' }}>{k}</span>
                    <span>{v} ({w}%)</span>
                  </div>
                  <div className="ad-bar-track">
                    <div className="ad-bar-fill" style={{ width:`${w}%`, background: STATUS_CLR[k] || 'var(--clr-primary-500)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recAna?.categoryPerformance?.length > 0 && (
        <div className="ad-card ad-card-p">
          <h4 className="ad-card-title">Category Performance</h4>
          {recAna.categoryPerformance.map(c => {
            const clr = c.acceptRate >= 60 ? 'var(--clr-success)' : c.acceptRate >= 40 ? 'var(--clr-warning)' : 'var(--clr-error)';
            return (
              <div key={c.category} className="ad-cat-row">
                <div>
                  <div className="ad-cat-name">{c.label || c.category}</div>
                  <div className="ad-cat-count">{c.count} recommendations</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="ad-cat-rate" style={{ color: clr }}>{c.acceptRate}%</div>
                  <div className="ad-cat-count">conf: {c.avgConf}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────
function UsersTab({ toast }) {
  const [users,      setUsers]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', { params: { page: p, limit: 20, search } });
      setUsers(data.users); setTotal(data.total); setPages(data.pages); setPage(p);
    } catch { toast('Failed to load users.', 'error'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, [search]);

  const suspend   = async id => { try { await api.patch(`/admin/users/${id}/suspend`);  toast('User suspended.', 'warning');  load(page); } catch { toast('Failed.','error'); } };
  const unsuspend = async id => { try { await api.patch(`/admin/users/${id}/activate`); toast('User unsuspended.');            load(page); } catch { toast('Failed.','error'); } };
  const deleteUser= async id => { if (!window.confirm('Permanently delete this user?')) return; try { await api.delete(`/admin/users/${id}`); toast('Deleted.','warning'); setSelected(null); load(page); } catch { toast('Failed.','error'); } };

  return (
    <div>
      <div className="ad-toolbar">
        <div className="ad-search">
          <span className="ad-search-icon"><Ic d={IC.search} size={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" />
        </div>
        <span className="ad-toolbar-count">{fmt(total)} users</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                {['Name','Email','Role','Status','Joined','Actions'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td><Badge label={u.role} color={u.role === 'admin' ? 'purple' : u.role === 'guest' ? 'yellow' : 'teal'} /></td>
                  <td><Badge label={u.status === 'suspended' ? 'Suspended' : 'Active'} color={u.status === 'suspended' ? 'red' : 'green'} /></td>
                  <td style={{ whiteSpace:'nowrap' }}>{fmtDate(u.createdAt)}</td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <Btn size="sm" variant="ghost" onClick={() => setSelected(u)}><Ic d={IC.eye} size={13} /></Btn>
                      {u.role !== 'admin' && (u.status === 'suspended'
                        ? <Btn size="sm" variant="success" onClick={() => unsuspend(u._id)}>Restore</Btn>
                        : <Btn size="sm" variant="warning" onClick={() => suspend(u._id)}>Suspend</Btn>)}
                      {u.role !== 'admin' && <Btn size="sm" variant="danger" onClick={() => deleteUser(u._id)}><Ic d={IC.trash} size={13} /></Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="ad-table-empty">No users found.</div>}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={load} />

      {selected && (
        <Modal title="User Details" onClose={() => setSelected(null)}>
          <div className="ad-info-row"><span className="ad-info-key">Name</span><span className="ad-info-val">{selected.name}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Email</span><span className="ad-info-val" style={{ textTransform:'none' }}>{selected.email}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Role</span><span className="ad-info-val">{selected.role}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Status</span><span className="ad-info-val">{selected.status === 'suspended' ? 'Suspended' : 'Active'}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Joined</span><span className="ad-info-val">{fmtDate(selected.createdAt)}</span></div>
          {selected.gender && <div className="ad-info-row"><span className="ad-info-key">Gender</span><span className="ad-info-val">{selected.gender}</span></div>}
          {selected.bodyType && <div className="ad-info-row"><span className="ad-info-key">Body type</span><span className="ad-info-val">{selected.bodyType}</span></div>}
          {selected.stylePreferences?.length > 0 && (
            <div className="ad-info-row"><span className="ad-info-key">Styles</span><span className="ad-info-val">{selected.stylePreferences.join(', ')}</span></div>
          )}
          <div className="ad-modal-footer">
            {selected.role !== 'admin' && (selected.status === 'suspended'
              ? <Btn variant="success" onClick={() => { unsuspend(selected._id); setSelected(null); }}>Restore</Btn>
              : <Btn variant="warning" onClick={() => { suspend(selected._id); setSelected(null); }}>Suspend</Btn>
            )}
            {selected.role !== 'admin' && (
              <Btn variant="danger" onClick={() => deleteUser(selected._id)}>Delete</Btn>
            )}
            <Btn variant="outline" onClick={() => setSelected(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── KATHMANDU INTELLIGENCE TAB ────────────────────────────────────────────────
const blankTrend = () => ({ name:'', type:'fashion_trend', description:'', fashionNote:'', season:[], occasion:[], venue:[], colors:'', styles:'', festivalMonth:'', isTraditional:false, popularity:50, imageUrl:'', tags:'' });

function KathmanduTab({ toast }) {
  const [trends,     setTrends]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [typeF,      setTypeF]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [modal,      setModal]      = useState(null);
  const [form,       setForm]       = useState(blankTrend());
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/kathmandu/trends', { params: { limit: 50, type: typeF } });
      setTrends(data.trends || []); setTotal(data.total || 0);
    } catch { toast('Failed to load trends.', 'error'); }
    finally { setLoading(false); }
  }, [typeF]);

  useEffect(() => { load(); }, [typeF]);

  const toggleArr = (field, val) => setForm(p => ({
    ...p, [field]: p[field].includes(val) ? p[field].filter(x => x !== val) : [...p[field], val],
  }));

  const save = async () => {
    if (!form.name || !form.type) return toast('Name and type are required.', 'error');
    setSaving(true);
    try {
      const payload = { ...form,
        colors:        form.colors.split(',').map(s => s.trim()).filter(Boolean),
        styles:        form.styles.split(',').map(s => s.trim()).filter(Boolean),
        tags:          form.tags.split(',').map(s => s.trim()).filter(Boolean),
        festivalMonth: form.festivalMonth ? Number(form.festivalMonth) : null,
        popularity:    Number(form.popularity),
      };
      if (modal === 'create') { await api.post('/admin/kathmandu/trends', payload);            toast('Trend added.'); }
      else                    { await api.put(`/admin/kathmandu/trends/${form._id}`, payload); toast('Trend updated.'); }
      setModal(null); load();
    } catch (e) { toast(e.response?.data?.message || 'Save failed.', 'error'); }
    finally { setSaving(false); }
  };

  const del = async id => {
    try { await api.delete(`/admin/kathmandu/trends/${id}`); toast('Deleted.', 'warning'); setConfirmDel(null); load(); }
    catch { toast('Failed.', 'error'); }
  };

  return (
    <div>
      <div className="ad-page-hd">
        <div>
          <h3 className="ad-page-title">Kathmandu Fashion Intelligence</h3>
          <p className="ad-page-sub">Local trends, festivals, venues, and brands for culturally-aware recommendations.</p>
        </div>
        <div className="ad-page-actions">
          <select value={typeF} onChange={e => setTypeF(e.target.value)} className="ad-select">
            <option value="">All types</option>
            {TREND_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
          </select>
          <Btn onClick={() => { setForm(blankTrend()); setModal('create'); }}>
            <Ic d={IC.plus} size={14} /> Add Trend
          </Btn>
        </div>
      </div>
      <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:14 }}>{fmt(total)} entries</p>

      {loading ? <Spinner /> : trends.length === 0 ? (
        <div className="ad-empty">
          <div className="ad-empty-icon"><Ic d={IC.mountain} size={26} /></div>
          <div className="ad-empty-title">No trends yet</div>
          <div className="ad-empty-sub">Build the Kathmandu intelligence database by adding local trends, festivals, and venues.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {trends.map(t => (
            <div key={t._id} className="ad-list-card">
              <div className="ad-list-card-body">
                <div className="ad-list-card-hd">
                  <span className="ad-list-card-title">{t.name}</span>
                  <Badge label={t.type.replace('_',' ')} color="blue" />
                  {t.isTraditional && <Badge label="Traditional" color="purple" />}
                  <Badge label={t.isActive ? 'Active' : 'Inactive'} color={t.isActive ? 'green' : 'gray'} />
                </div>
                <div className="ad-list-card-meta">
                  {t.festivalMonth && <span>Month: {MONTHS[t.festivalMonth - 1]}</span>}
                  {t.season?.length > 0 && <span>Season: {t.season.join(', ')}</span>}
                  {t.colors?.length > 0 && <span>Colors: {t.colors.join(', ')}</span>}
                  <span>Popularity: {t.popularity}/100</span>
                </div>
                {t.fashionNote && <div className="ad-list-card-note">{t.fashionNote}</div>}
              </div>
              <div className="ad-list-card-btns">
                <Btn size="sm" variant="outline" onClick={() => {
                  setForm({ ...t, colors:(t.colors||[]).join(', '), styles:(t.styles||[]).join(', '), tags:(t.tags||[]).join(', '), festivalMonth:t.festivalMonth||'' });
                  setModal('edit');
                }}><Ic d={IC.edit} size={12} /> Edit</Btn>
                <Btn size="sm" variant="danger" onClick={() => setConfirmDel(t)}><Ic d={IC.trash} size={12} /></Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Kathmandu Trend' : 'Edit Trend'} onClose={() => setModal(null)}>
          <Inp label="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Tihar Festival Fashion" />
          <Sel label="Type *" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            {TREND_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
          </Sel>
          {form.type === 'festival' && (
            <Sel label="Festival Month" value={form.festivalMonth} onChange={e => setForm(p => ({ ...p, festivalMonth: e.target.value }))}>
              <option value="">Select month</option>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </Sel>
          )}
          <div className="ad-field">
            <label className="ad-field-label">Season</label>
            <div className="ad-chips">
              {KTM_SEASONS.map(s => (
                <button key={s} type="button" onClick={() => toggleArr('season', s)}
                  className={`ad-chip${form.season.includes(s) ? ' sel' : ''}`}>{s}</button>
              ))}
            </div>
          </div>
          <Inp label="Colors (comma-separated)" value={form.colors} onChange={e => setForm(p => ({ ...p, colors: e.target.value }))} placeholder="red, gold, deep blue" />
          <Inp label="Styles (comma-separated)" value={form.styles} onChange={e => setForm(p => ({ ...p, styles: e.target.value }))} placeholder="traditional, festive, ethnic" />
          <div className="ad-form-2">
            <div className="ad-field">
              <label className="ad-field-label">Popularity ({form.popularity})</label>
              <input type="range" min={0} max={100} value={form.popularity}
                onChange={e => setForm(p => ({ ...p, popularity: e.target.value }))} style={{ width:'100%' }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:22 }}>
              <input type="checkbox" id="trad" checked={form.isTraditional} onChange={e => setForm(p => ({ ...p, isTraditional: e.target.checked }))} />
              <label htmlFor="trad" style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-secondary)', cursor:'pointer' }}>Is Traditional</label>
            </div>
          </div>
          <Inp label="Fashion Note" value={form.fashionNote} onChange={e => setForm(p => ({ ...p, fashionNote: e.target.value }))} placeholder="e.g. Wear bright red for Teej blessings" />
          <Inp label="Image URL" value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://…" />
          <div className="ad-field">
            <label className="ad-field-label">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} className="ad-input ad-textarea" />
          </div>
          <div className="ad-modal-footer">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : modal === 'create' ? 'Add Trend' : 'Save'}</Btn>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Confirm Delete" onClose={() => setConfirmDel(null)}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>
            Delete <strong>{confirmDel.name}</strong>? This cannot be undone.
          </p>
          <div className="ad-modal-footer">
            <Btn variant="outline" onClick={() => setConfirmDel(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => del(confirmDel._id)}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CONTENT MODERATION TAB (wardrobe / saved outfits / calendar) ──────────────
const WARDROBE_CATEGORIES = ['tops', 'bottoms', 'dresses', 'jackets', 'footwear', 'accessories', 'traditional'];

function WardrobeMonitorPanel({ toast }) {
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [catF,    setCatF]    = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/wardrobe', { params: { page: p, limit: 16, search, category: catF } });
      setItems(data.items); setTotal(data.total); setPages(data.pages); setPage(p);
    } catch { toast('Failed to load wardrobe items.', 'error'); }
    finally { setLoading(false); }
  }, [search, catF]);

  useEffect(() => { load(1); }, [search, catF]);

  const del = async id => {
    if (!window.confirm('Delete this wardrobe item? This cannot be undone.')) return;
    try { await api.delete(`/admin/wardrobe/${id}`); toast('Item deleted.', 'warning'); load(page); }
    catch { toast('Failed.', 'error'); }
  };

  return (
    <div>
      <div className="ad-toolbar">
        <div className="ad-search">
          <span className="ad-search-icon"><Ic d={IC.search} size={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item name…" />
        </div>
        <select value={catF} onChange={e => setCatF(e.target.value)} className="ad-select">
          <option value="">All categories</option>
          {WARDROBE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="ad-toolbar-count">{fmt(total)} items</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr>{['Item','Owner','Category','Color','Added','Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it._id}>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{it.name}</td>
                  <td>{it.user?.name || 'Unknown'}<div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{it.user?.email}</div></td>
                  <td><Badge label={it.category} color="teal" /></td>
                  <td style={{ textTransform:'capitalize' }}>{it.color || '—'}</td>
                  <td style={{ whiteSpace:'nowrap' }}>{fmtDate(it.createdAt)}</td>
                  <td><Btn size="sm" variant="danger" onClick={() => del(it._id)}><Ic d={IC.trash} size={13} /></Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="ad-table-empty">No wardrobe items found.</div>}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={load} />
    </div>
  );
}

function SavedOutfitsPanel({ toast }) {
  const [combos,  setCombos]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/saved-outfits', { params: { page: p, limit: 16, search } });
      setCombos(data.combinations); setTotal(data.total); setPages(data.pages); setPage(p);
    } catch { toast('Failed to load saved outfits.', 'error'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, [search]);

  const del = async id => {
    if (!window.confirm('Delete this saved outfit? This cannot be undone.')) return;
    try { await api.delete(`/admin/saved-outfits/${id}`); toast('Outfit deleted.', 'warning'); load(page); }
    catch { toast('Failed.', 'error'); }
  };

  return (
    <div>
      <div className="ad-toolbar">
        <div className="ad-search">
          <span className="ad-search-icon"><Ic d={IC.search} size={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search outfit name…" />
        </div>
        <span className="ad-toolbar-count">{fmt(total)} saved outfits</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr>{['Outfit','Owner','Items','Match Score','Saved','Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {combos.map(c => (
                <tr key={c._id}>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{c.name || 'Unnamed Outfit'}</td>
                  <td>{c.user?.name || 'Unknown'}<div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{c.user?.email}</div></td>
                  <td>{c.items?.length || 0}</td>
                  <td>{c.matchScore != null ? `${c.matchScore}%` : '—'}</td>
                  <td style={{ whiteSpace:'nowrap' }}>{fmtDate(c.createdAt)}</td>
                  <td><Btn size="sm" variant="danger" onClick={() => del(c._id)}><Ic d={IC.trash} size={13} /></Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
          {combos.length === 0 && <div className="ad-table-empty">No saved outfits found.</div>}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={load} />
    </div>
  );
}

function CalendarMonitorPanel({ toast }) {
  const [entries, setEntries] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/calendar', { params: { page: p, limit: 16, search } });
      setEntries(data.entries); setTotal(data.total); setPages(data.pages); setPage(p);
    } catch { toast('Failed to load calendar entries.', 'error'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, [search]);

  const del = async id => {
    if (!window.confirm('Delete this calendar entry? This cannot be undone.')) return;
    try { await api.delete(`/admin/calendar/${id}`); toast('Entry deleted.', 'warning'); load(page); }
    catch { toast('Failed.', 'error'); }
  };

  return (
    <div>
      <div className="ad-toolbar">
        <div className="ad-search">
          <span className="ad-search-icon"><Ic d={IC.search} size={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search owner or outfit name…" />
        </div>
        <span className="ad-toolbar-count">{fmt(total)} entries</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr>{['Owner','Outfit / Combo','Occasion','Date','Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e._id}>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{e.user?.name || 'Unknown'}<div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:400 }}>{e.user?.email}</div></td>
                  <td>{e.outfitName || e.combo?.name || '—'}</td>
                  <td style={{ textTransform:'capitalize' }}>{e.occasion || '—'}</td>
                  <td style={{ whiteSpace:'nowrap' }}>{fmtDate(e.date)}</td>
                  <td><Btn size="sm" variant="danger" onClick={() => del(e._id)}><Ic d={IC.trash} size={13} /></Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <div className="ad-table-empty">No calendar entries found.</div>}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={load} />
    </div>
  );
}

function ModerationTab({ toast }) {
  const [view, setView] = useState('wardrobe');
  return (
    <div>
      <div className="ad-toolbar" style={{ marginBottom:20 }}>
        {[['wardrobe','Wardrobe'],['saved','Saved Outfits'],['calendar','Calendar']].map(([k,l]) => (
          <button key={k} onClick={() => setView(k)}
            className={`ad-btn${view===k ? ' ad-btn-primary' : ' ad-btn-outline'}`}>{l}</button>
        ))}
      </div>
      {view === 'wardrobe' && <WardrobeMonitorPanel toast={toast} />}
      {view === 'saved'    && <SavedOutfitsPanel   toast={toast} />}
      {view === 'calendar' && <CalendarMonitorPanel toast={toast} />}
    </div>
  );
}

// ── OUTFIT CATALOG TAB ────────────────────────────────────────────────────────
const CATALOG_CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'traditional', 'full_outfit'];
const blankOutfit = () => ({ name:'', description:'', category:'tops', style:'', occasion:'', season:'', colors:'', fabric:'', brand:'', price:'', imageUrl:'', tags:'', isActive:true });

function CatalogTab({ toast }) {
  const [outfits,    setOutfits]    = useState([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [catF,       setCatF]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [modal,      setModal]      = useState(null);
  const [form,       setForm]       = useState(blankOutfit());
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/outfits', { params: { page: p, limit: 16, search, category: catF } });
      setOutfits(data.outfits); setTotal(data.total); setPages(data.pages); setPage(p);
    } catch { toast('Failed to load outfit catalog.', 'error'); }
    finally { setLoading(false); }
  }, [search, catF]);

  useEffect(() => { load(1); }, [search, catF]);

  const toArr = s => s.split(',').map(x => x.trim()).filter(Boolean);

  const save = async () => {
    if (!form.name || !form.category) return toast('Name and category are required.', 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        style:    toArr(form.style),
        occasion: toArr(form.occasion),
        season:   toArr(form.season),
        colors:   toArr(form.colors),
        tags:     toArr(form.tags),
        price:    form.price === '' ? null : Number(form.price),
      };
      if (modal === 'create') { await api.post('/admin/outfits', payload);            toast('Outfit added to catalog.'); }
      else                    { await api.put(`/admin/outfits/${form._id}`, payload); toast('Outfit updated.'); }
      setModal(null); load(page);
    } catch (e) { toast(e.response?.data?.message || 'Save failed.', 'error'); }
    finally { setSaving(false); }
  };

  const approve = async id => {
    try { await api.patch(`/admin/outfits/${id}/approve`); toast('Outfit approved.'); load(page); }
    catch { toast('Failed.', 'error'); }
  };

  const del = async id => {
    try { await api.delete(`/admin/outfits/${id}`); toast('Deleted.', 'warning'); setConfirmDel(null); load(page); }
    catch { toast('Failed.', 'error'); }
  };

  return (
    <div>
      <div className="ad-page-hd">
        <div>
          <h3 className="ad-page-title">Outfit Catalog</h3>
          <p className="ad-page-sub">Curated outfit entries independent of any user's personal wardrobe.</p>
        </div>
        <div className="ad-page-actions">
          <select value={catF} onChange={e => setCatF(e.target.value)} className="ad-select">
            <option value="">All categories</option>
            {CATALOG_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
          </select>
          <Btn onClick={() => { setForm(blankOutfit()); setModal('create'); }}>
            <Ic d={IC.plus} size={14} /> Add Outfit
          </Btn>
        </div>
      </div>

      <div className="ad-toolbar" style={{ marginBottom:14 }}>
        <div className="ad-search">
          <span className="ad-search-icon"><Ic d={IC.search} size={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search catalog…" />
        </div>
        <span className="ad-toolbar-count">{fmt(total)} outfits</span>
      </div>

      {loading ? <Spinner /> : outfits.length === 0 ? (
        <div className="ad-empty">
          <div className="ad-empty-icon"><Ic d={IC.outfits} size={26} /></div>
          <div className="ad-empty-title">No catalog outfits yet</div>
          <div className="ad-empty-sub">Add curated outfits here — independent of any individual user's wardrobe.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {outfits.map(o => (
            <div key={o._id} className="ad-list-card">
              <div className="ad-list-card-body">
                <div className="ad-list-card-hd">
                  <span className="ad-list-card-title">{o.name}</span>
                  <Badge label={o.category.replace('_',' ')} color="blue" />
                  <Badge label={o.isApproved ? 'Approved' : 'Pending'} color={o.isApproved ? 'green' : 'yellow'} />
                  <Badge label={o.isActive ? 'Active' : 'Inactive'} color={o.isActive ? 'green' : 'gray'} />
                </div>
                <div className="ad-list-card-meta">
                  {o.occasion?.length > 0 && <span>Occasion: {o.occasion.join(', ')}</span>}
                  {o.season?.length > 0 && <span>Season: {o.season.join(', ')}</span>}
                  {o.brand && <span>Brand: {o.brand}</span>}
                  {o.price != null && <span>Price: {o.price}</span>}
                </div>
                {o.description && <div className="ad-list-card-note">{o.description}</div>}
              </div>
              <div className="ad-list-card-btns">
                {!o.isApproved && <Btn size="sm" variant="success" onClick={() => approve(o._id)}>Approve</Btn>}
                <Btn size="sm" variant="outline" onClick={() => {
                  setForm({ ...o, style:(o.style||[]).join(', '), occasion:(o.occasion||[]).join(', '), season:(o.season||[]).join(', '), colors:(o.colors||[]).join(', '), tags:(o.tags||[]).join(', '), price: o.price ?? '' });
                  setModal('edit');
                }}><Ic d={IC.edit} size={12} /> Edit</Btn>
                <Btn size="sm" variant="danger" onClick={() => setConfirmDel(o)}><Ic d={IC.trash} size={12} /></Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={load} />

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Catalog Outfit' : 'Edit Outfit'} onClose={() => setModal(null)}>
          <Inp label="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Monsoon-Ready Office Look" />
          <Sel label="Category *" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            {CATALOG_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
          </Sel>
          <Inp label="Style (comma-separated)" value={form.style} onChange={e => setForm(p => ({ ...p, style: e.target.value }))} placeholder="minimalist, korean" />
          <Inp label="Occasion (comma-separated)" value={form.occasion} onChange={e => setForm(p => ({ ...p, occasion: e.target.value }))} placeholder="office, daily" />
          <Inp label="Season (comma-separated)" value={form.season} onChange={e => setForm(p => ({ ...p, season: e.target.value }))} placeholder="monsoon, autumn" />
          <Inp label="Colors (comma-separated)" value={form.colors} onChange={e => setForm(p => ({ ...p, colors: e.target.value }))} placeholder="black, white" />
          <div className="ad-form-2">
            <Inp label="Fabric" value={form.fabric} onChange={e => setForm(p => ({ ...p, fabric: e.target.value }))} />
            <Inp label="Brand" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} />
          </div>
          <div className="ad-form-2">
            <Inp label="Price" type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
            <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:22 }}>
              <input type="checkbox" id="cat-active" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
              <label htmlFor="cat-active" style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-secondary)', cursor:'pointer' }}>Active</label>
            </div>
          </div>
          <Inp label="Image URL" value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://…" />
          <Inp label="Tags (comma-separated)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
          <div className="ad-field">
            <label className="ad-field-label">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} className="ad-input ad-textarea" />
          </div>
          <div className="ad-modal-footer">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : modal === 'create' ? 'Add Outfit' : 'Save'}</Btn>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Confirm Delete" onClose={() => setConfirmDel(null)}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>
            Delete <strong>{confirmDel.name}</strong> from the catalog? This cannot be undone.
          </p>
          <div className="ad-modal-footer">
            <Btn variant="outline" onClick={() => setConfirmDel(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => del(confirmDel._id)}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── RECOMMENDATIONS TAB ───────────────────────────────────────────────────────
function RecsTab({ toast }) {
  const [view,      setView]      = useState('analytics');
  const [analytics, setAnalytics] = useState(null);
  const [logs,      setLogs]      = useState([]);
  const [logPage,   setLogPage]   = useState(1);
  const [logPages,  setLogPages]  = useState(1);
  const [loading,   setLoading]   = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/rec-analytics'); setAnalytics(data); }
    catch { toast('Failed to load analytics.', 'error'); }
    finally { setLoading(false); }
  }, []);

  const loadLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/recommendations', { params: { page: p, limit: 20 } });
      setLogs(data.sessions || []); setLogPages(data.pages || 1); setLogPage(p);
    } catch { toast('Failed to load logs.', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { view === 'analytics' ? loadAnalytics() : loadLogs(); }, [view]);

  return (
    <div>
      <div className="ad-toolbar" style={{ marginBottom:20 }}>
        {[['analytics','Analytics'],['logs','Session Logs']].map(([k,l]) => (
          <button key={k} onClick={() => setView(k)}
            className={`ad-btn${view===k ? ' ad-btn-primary' : ' ad-btn-outline'}`}>{l}</button>
        ))}
        <div className="ad-toolbar-end">
          <Btn variant="outline" onClick={() => window.open('/api/admin/reports/recommendations', '_blank')}>
            <Ic d={IC.download} size={14} /> Export CSV
          </Btn>
        </div>
      </div>

      {view === 'analytics' && (loading ? <Spinner /> : analytics ? (
        <div>
          <div className="ad-stats-grid">
            <StatCard icon="bar"      label="Total Sessions"        value={fmt(analytics.totalSessions)}        bg="#0D9488" />
            <StatCard icon="sparkle"  label="Total Recommendations" value={fmt(analytics.totalRecommendations)} bg="#7C3AED" />
            <StatCard icon="check"    label="Acceptance Rate"        value={`${analytics.acceptanceRate}%`}      bg="#059669" />
            <StatCard icon="zap"      label="Avg Confidence"         value={`${analytics.avgConfidence}%`}       bg="#D97706" />
          </div>
          <div className="ad-charts-2">
            <div className="ad-card ad-card-p">
              <h4 className="ad-card-title">Status Breakdown</h4>
              {Object.entries(analytics.statusBreakdown || {}).map(([k, v]) => {
                const t = Object.values(analytics.statusBreakdown).reduce((a, b) => a + b, 0);
                const w = pct(v, t);
                return (
                  <div key={k} className="ad-bar-row">
                    <div className="ad-bar-hd">
                      <span style={{ textTransform:'capitalize' }}>{k}</span>
                      <span>{v} ({w}%)</span>
                    </div>
                    <div className="ad-bar-track">
                      <div className="ad-bar-fill" style={{ width:`${w}%`, background: STATUS_CLR[k] || 'var(--clr-primary-500)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ad-card ad-card-p">
              <h4 className="ad-card-title">Category Performance</h4>
              {(analytics.categoryPerformance || []).map(c => {
                const clr = c.acceptRate >= 60 ? 'var(--clr-success)' : c.acceptRate >= 40 ? 'var(--clr-warning)' : 'var(--clr-error)';
                return (
                  <div key={c.category} className="ad-cat-row">
                    <div>
                      <div className="ad-cat-name">{c.label || c.category}</div>
                      <div className="ad-cat-count">{c.count} recs</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div className="ad-cat-rate" style={{ color: clr }}>{c.acceptRate}%</div>
                      <div className="ad-cat-count">conf: {c.avgConf}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {analytics.topFeedbackReasons?.length > 0 && (
            <div className="ad-card ad-card-p">
              <h4 className="ad-card-title">Top Dislike Reasons</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {analytics.topFeedbackReasons.map(r => (
                  <div key={r.reason} className="ad-reason-pill">
                    <span className="ad-reason-pill-label">{r.reason}</span>
                    <span className="ad-reason-pill-count">{r.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null)}

      {view === 'logs' && (loading ? <Spinner /> : (
        <div>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>{['User','Occasion','Status','Date','Count'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {logs.map(s => (
                  <tr key={s._id}>
                    <td style={{ fontWeight:500, color:'var(--text-primary)' }}>{s.user?.name || 'Unknown'}</td>
                    <td style={{ textTransform:'capitalize' }}>{s.context?.occasion || '—'}</td>
                    <td><Badge label={s.status} color={s.status==='complete' ? 'green' : s.status==='failed' ? 'red' : 'yellow'} /></td>
                    <td style={{ whiteSpace:'nowrap' }}>{fmtDate(s.createdAt)}</td>
                    <td>{s.recommendations?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <div className="ad-table-empty">No recommendation logs yet.</div>}
          </div>
          <Pagination page={logPage} pages={logPages} onPage={loadLogs} />
        </div>
      ))}
    </div>
  );
}

// ── ML MODEL TAB ──────────────────────────────────────────────────────────────
function MLTab({ toast }) {
  const [info,       setInfo]       = useState(null);
  const [features,   setFeatures]   = useState([]);
  const [reachable,  setReachable]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [retrained,  setRetrained]  = useState(null);
  const [rankingMetrics, setRankingMetrics] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [coverage, setCoverage] = useState(null);
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/ml/info').then(({ data }) => {
      setInfo(data.modelInfo); setFeatures(data.featureImportance || []); setReachable(data.mlServiceReachable);
    }).catch(() => setReachable(false)).finally(() => setLoading(false));
  }, []);

  const loadCoverage = useCallback(() => {
    api.get('/admin/wardrobe/ai-coverage').then(({ data }) => setCoverage(data)).catch(() => {});
  }, []);

  useEffect(load, []);
  useEffect(loadCoverage, [loadCoverage]);

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const { data } = await api.post('/admin/wardrobe/ai-backfill', { limit: 20 });
      toast(`Tagged ${data.tagged}/${data.processed} item(s)${data.failed ? ` (${data.failed} failed)` : ''}.`);
      loadCoverage();
    } catch { toast('Backfill failed.', 'error'); }
    finally { setBackfilling(false); }
  };

  const loadRankingMetrics = async () => {
    setRankingLoading(true);
    try {
      const { data } = await api.get('/admin/ml/ranking-metrics');
      setRankingMetrics(data.rankingMetrics);
      if (!data.mlServiceReachable) toast('ML service unreachable.', 'error');
    } catch { toast('Could not load ranking metrics.', 'error'); }
    finally { setRankingLoading(false); }
  };

  const retrain = async () => {
    if (!window.confirm('Retrain the ML model? This may take several minutes.')) return;
    setRetraining(true);
    try {
      const { data } = await api.post('/admin/ml/retrain');
      setRetrained(data); toast('Model retrained successfully!'); load();
    } catch (e) { toast(e.response?.data?.message || 'Retraining failed.', 'error'); }
    finally { setRetraining(false); }
  };

  const maxCoef = Math.max(...features.map(f => Math.abs(f.coefficient || 0)), 0.001);
  const trained = info?.modelLoaded && typeof info?.accuracy === 'number';

  return (
    <div>
      <div className="ad-page-hd">
        <div>
          <h3 className="ad-page-title">Machine Learning Model</h3>
          <p className="ad-page-sub">Logistic Regression acceptance-prediction model — predicts the probability a user accepts a given outfit, trained on real recommendation outcomes.</p>
        </div>
        <div className="ad-page-actions">
          <span className={`ad-status-pill ${reachable ? 'ad-status-online' : 'ad-status-offline'}`}>
            ● {reachable ? 'Online' : 'Offline'}
          </span>
          <Btn onClick={retrain} disabled={!reachable || retraining}>
            <Ic d={IC.refresh} size={14} /> {retraining ? 'Retraining…' : 'Retrain Model'}
          </Btn>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {trained ? (
            <div className="ad-stats-grid">
              <StatCard icon="check"  label="Accuracy"         value={`${Math.round((info.accuracy||0)*100)}%`}  bg="#059669" />
              <StatCard icon="bar"    label="Precision"        value={`${Math.round((info.precision||0)*100)}%`} bg="#0D9488" />
              <StatCard icon="zap"    label="Recall"           value={`${Math.round((info.recall||0)*100)}%`}    bg="#D97706" />
              <StatCard icon="ml"     label="F1 Score"         value={`${Math.round((info.f1||0)*100)}%`}        bg="#06B6D4" />
              <StatCard icon="users"  label="Training Samples" value={fmt(info.trainingSize)}                     bg="#7C3AED" />
              <StatCard icon="calendar" label="Trained"        value={info.trainedAt && info.trainedAt !== 'unknown' ? new Date(info.trainedAt).toLocaleDateString() : '—'} bg="#DB2777" />
            </div>
          ) : (
            <div className="ad-alert ad-alert-error" style={{ flexDirection:'column', alignItems:'flex-start' }}>
              <div style={{ fontWeight:700, marginBottom:4 }}>Model Not Yet Trained</div>
              <div>Needs at least {info?.minSamplesRequired || 50} labeled recommendation outcomes (accepted/rejected). Run <code style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem' }}>node scripts/seedSyntheticTrainingBehavior.js</code> to bootstrap demo data, then retrain.</div>
            </div>
          )}

          {trained && typeof info?.syntheticFraction === 'number' && (
            <div className="ad-card ad-card-p" style={{ marginTop:18, marginBottom:18 }}>
              <h4 className="ad-card-title">Training Data Provenance</h4>
              <p style={{ fontSize:'0.8rem', color:'var(--clr-text-muted)', marginBottom:10 }}>
                Honest breakdown of what this model was actually trained on — not all data is real user behavior.
              </p>
              <div className="ad-stats-grid">
                <StatCard icon="ml"    label="Synthetic Data" value={`${Math.round((info.syntheticFraction||0)*100)}%`} bg="#D97706" />
                <StatCard icon="users" label="Real Samples"   value={fmt(info.realSampleCount)}  bg="#059669" />
                <StatCard icon="bar"   label="Style Personas" value={fmt(info.personaCount)}      bg="#0EA5E9" />
              </div>
            </div>
          )}

          {coverage && (
            <div className="ad-card ad-card-p" style={{ marginTop:18, marginBottom:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div>
                  <h4 className="ad-card-title" style={{ marginBottom:2 }}>Wardrobe AI Metadata Coverage</h4>
                  <p style={{ fontSize:'0.8rem', color:'var(--clr-text-muted)', margin:0 }}>{coverage.tagged} of {coverage.total} wardrobe items have AI-extracted metadata.</p>
                </div>
                <Btn size="sm" onClick={runBackfill} disabled={backfilling || coverage.coveragePercent >= 100 || !reachable}>
                  {backfilling ? 'Tagging…' : 'Backfill Next 20'}
                </Btn>
              </div>
              <div style={{ height:8, background:'var(--bg-hover)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${coverage.coveragePercent}%`, background: coverage.coveragePercent >= 80 ? '#059669' : coverage.coveragePercent >= 40 ? '#D97706' : '#DC2626', transition:'width 0.3s' }} />
              </div>
              <p style={{ fontSize:'0.75rem', color:'var(--clr-text-muted)', marginTop:6 }}>{coverage.coveragePercent}% coverage</p>
            </div>
          )}

          {info?.confusionMatrix && (
            <div className="ad-card ad-card-p" style={{ marginTop:18, marginBottom:18 }}>
              <h4 className="ad-card-title">Confusion Matrix</h4>
              <p style={{ fontSize:'0.8rem', color:'var(--clr-text-muted)', marginBottom:10 }}>Rows = actual outcome, columns = predicted outcome. [reject, accept]</p>
              <table style={{ borderCollapse:'collapse' }}>
                <tbody>
                  {info.confusionMatrix.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding:'10px 18px', textAlign:'center', fontFamily:'var(--font-mono)',
                          border:'1px solid var(--clr-border)',
                          background: i === j ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.08)',
                          fontWeight:700,
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {features.length > 0 && (
            <div className="ad-card ad-card-p">
              <h4 className="ad-card-title">Feature Coefficients (signed — direction matters)</h4>
              <p style={{ fontSize:'0.8rem', color:'var(--clr-text-muted)', marginBottom:10 }}>Unlike Random Forest importances, these show WHICH DIRECTION each feature pushes acceptance.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {features.map((f, i) => {
                  const w = Math.round((Math.abs(f.coefficient || 0) / maxCoef) * 100);
                  const positive = (f.coefficient || 0) > 0;
                  return (
                    <div key={i} className="ad-bar-row">
                      <div className="ad-bar-hd">
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem' }}>{f.feature}</span>
                        <span style={{ color: positive ? '#059669' : '#DC2626' }}>{f.coefficient > 0 ? '+' : ''}{f.coefficient?.toFixed(3)}</span>
                      </div>
                      <div className="ad-bar-track">
                        <div className="ad-bar-fill" style={{ width:`${w}%`, background: positive ? '#059669' : '#DC2626' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {info?.algorithmComparison?.available && (
            <div className="ad-card ad-card-p" style={{ marginTop:18 }}>
              <h4 className="ad-card-title">Algorithm Comparison (5-fold cross-validation)</h4>
              <p style={{ fontSize:'0.8rem', color:'var(--clr-text-muted)', marginBottom:10 }}>
                Logistic Regression vs. Gradient Boosting, evaluated on identical folds of the same data.
                Currently deployed: <strong>{info.algorithm}</strong>.
              </p>
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead><tr><th>Algorithm</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>ROC-AUC</th></tr></thead>
                  <tbody>
                    {[
                      { key: 'logistic_regression', label: 'Logistic Regression' },
                      { key: 'gradient_boosting',    label: 'Gradient Boosting' },
                    ].map(({ key, label }) => {
                      const m = info.algorithmComparison[key];
                      const isRecommended = info.algorithmComparison.recommended === key;
                      return (
                        <tr key={key} style={isRecommended ? { fontWeight: 700 } : undefined}>
                          <td>{label}{isRecommended && ' ✓ recommended'}</td>
                          {['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].map(metric => (
                            <td key={metric}>{Math.round((m[metric]?.mean || 0) * 100)}% ± {Math.round((m[metric]?.std || 0) * 100)}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize:'0.75rem', color:'var(--clr-text-muted)', marginTop:8 }}>
                Gradient Boosting margin over Logistic Regression: {info.algorithmComparison.rocAucMargin >= 0 ? '+' : ''}{Math.round(info.algorithmComparison.rocAucMargin * 100)} ROC-AUC points
                (adoption threshold: +{Math.round(info.algorithmComparison.adoptionThreshold * 100)}).
              </p>
            </div>
          )}
          {info?.algorithmComparison?.available === false && (
            <div className="ad-alert" style={{ marginTop:18, flexDirection:'column', alignItems:'flex-start' }}>
              <div style={{ fontWeight:700, marginBottom:4 }}>Algorithm Comparison Unavailable</div>
              <div>{info.algorithmComparison.reason}</div>
            </div>
          )}

          {typeof info?.brierScore === 'number' && (
            <div className="ad-card ad-card-p" style={{ marginTop:18 }}>
              <h4 className="ad-card-title">Confidence Calibration</h4>
              <p style={{ fontSize:'0.8rem', color:'var(--clr-text-muted)', marginBottom:10 }}>
                Out-of-fold Brier score for the raw acceptance model (lower is better — 0 is perfect, ~0.25 is what a coin-flip predictor scores).
                Correction method: <strong>{info.calibrationMethod === 'none' ? 'none applied' : info.calibrationMethod}</strong>.
              </p>
              <div className="ad-stats-grid">
                <StatCard icon="check" label="Brier Score" value={info.brierScore.toFixed(3)} bg={info.brierScore < 0.20 ? '#059669' : '#DC2626'} />
              </div>
              {info.calibrationBins?.length > 0 && (
                <div className="ad-table-wrap" style={{ marginTop:12 }}>
                  <table className="ad-table">
                    <thead><tr><th>Mean Predicted</th><th>Actual Accepted Fraction</th></tr></thead>
                    <tbody>
                      {info.calibrationBins.map((b, i) => (
                        <tr key={i}><td>{Math.round(b.meanPredicted * 100)}%</td><td>{Math.round(b.actualFraction * 100)}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ fontSize:'0.75rem', color:'var(--clr-text-muted)', marginTop:8 }}>
                A well-calibrated model's "mean predicted" and "actual accepted fraction" columns track closely. Correction (Platt scaling) is opt-in via <code style={{ fontFamily:'var(--font-mono)' }}>CALIBRATE_MODEL=true</code> — off by default since this project's measured Brier score is below the miscalibration threshold used here.
              </p>
            </div>
          )}

          <div className="ad-card ad-card-p" style={{ marginTop:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div>
                <h4 className="ad-card-title" style={{ marginBottom:2 }}>Ranking Quality (experimental)</h4>
                <p style={{ fontSize:'0.8rem', color:'var(--clr-text-muted)', margin:0 }}>NDCG, diversity, and personalization — not classification accuracy.</p>
              </div>
              <Btn size="sm" variant="outline" onClick={loadRankingMetrics} disabled={rankingLoading || !reachable}>
                {rankingLoading ? 'Loading…' : rankingMetrics ? 'Refresh' : 'Load'}
              </Btn>
            </div>
            {rankingMetrics && (
              <div className="ad-stats-grid">
                <StatCard icon="ml"  label="NDCG@5 (real)"      value={rankingMetrics.ndcg_at_5_real.mean != null ? `${Math.round(rankingMetrics.ndcg_at_5_real.mean * 100)}% (n=${rankingMetrics.ndcg_at_5_real.n})` : `Insufficient data (n=${rankingMetrics.ndcg_at_5_real.n})`} bg="#059669" />
                <StatCard icon="ml"  label="NDCG@5 (synthetic)" value={rankingMetrics.ndcg_at_5_synthetic.mean != null ? `${Math.round(rankingMetrics.ndcg_at_5_synthetic.mean * 100)}% (n=${rankingMetrics.ndcg_at_5_synthetic.n})` : '—'} bg="#0EA5E9" />
                <StatCard icon="bar" label="Diversity"          value={rankingMetrics.diversity.mean != null ? `${Math.round(rankingMetrics.diversity.mean * 100)}% (n=${rankingMetrics.diversity.n})` : `Insufficient data (n=${rankingMetrics.diversity.n})`} bg="#D97706" />
                <StatCard icon="users" label="Personalization"  value={rankingMetrics.personalization.mean != null ? `${Math.round(rankingMetrics.personalization.mean * 100)}% (n=${rankingMetrics.personalization.n})` : `Insufficient data (n=${rankingMetrics.personalization.n})`} bg="#7C3AED" />
              </div>
            )}
            {rankingMetrics && (
              <p style={{ fontSize:'0.75rem', color:'var(--clr-text-muted)', marginTop:10 }}>{rankingMetrics.note} Low sample sizes (n) mean these numbers should be treated as low-confidence until more real usage accumulates.</p>
            )}
          </div>

          {!reachable && (
            <div className="ad-alert ad-alert-error" style={{ marginTop:18, flexDirection:'column', alignItems:'flex-start' }}>
              <div style={{ fontWeight:700, marginBottom:4 }}>ML Service Offline</div>
              <div>Start with <code style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem' }}>python app.py</code> in the ml-service directory.</div>
            </div>
          )}

          {retrained && (
            <div className="ad-alert ad-alert-success" style={{ marginTop:18, flexDirection:'column', alignItems:'flex-start' }}>
              <div style={{ fontWeight:700, marginBottom:4 }}>Retraining Complete</div>
              <div>Accuracy: {Math.round((retrained.metrics?.accuracy||0)*100)}% · Samples: {fmt(retrained.metrics?.trainingSize)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── FEEDBACK TAB ──────────────────────────────────────────────────────────────
function FeedbackTab({ toast }) {
  const [feedback, setFeedback] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(1);
  const [statusF,  setStatusF]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/feedback', { params: { page: p, limit: 15, status: statusF } });
      setFeedback(data.feedback); setTotal(data.total); setPages(data.pages); setPage(p);
    } catch { toast('Failed to load feedback.', 'error'); }
    finally { setLoading(false); }
  }, [statusF]);

  useEffect(() => { load(1); }, [statusF]);

  const approve  = async id => { try { await api.patch(`/admin/feedback/${id}/approve`); toast('Feedback published.');          load(page); } catch { toast('Failed.','error'); } };
  const resolve  = async id => { try { await api.patch(`/admin/feedback/${id}/resolve`); toast('Feedback resolved.');           load(page); } catch { toast('Failed.','error'); } };
  const deleteFb = async id => { try { await api.delete(`/admin/feedback/${id}`);        toast('Deleted.','warning'); setSelected(null); load(page); } catch { toast('Failed.','error'); } };

  const statusColor = s => ({ pending:'yellow', reviewed:'blue', resolved:'green' }[s] || 'gray');
  const typeColor   = t => ({ suggestion:'blue', improvement:'teal', complaint:'red' }[t] || 'gray');

  return (
    <div>
      <div className="ad-toolbar">
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className="ad-select">
          <option value="">All feedback</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Published</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="ad-toolbar-count">{fmt(total)} total</span>
      </div>

      {loading ? <Spinner /> : feedback.length === 0 ? (
        <div className="ad-empty">
          <div className="ad-empty-icon"><Ic d={IC.feedback} size={26} /></div>
          <div className="ad-empty-title">No feedback found</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {feedback.map(fb => (
            <div key={fb._id} className="ad-list-card">
              <div className="ad-list-card-body">
                <div className="ad-list-card-hd">
                  <Badge label={fb.type||'feedback'} color={typeColor(fb.type)} />
                  <Badge label={fb.status} color={statusColor(fb.status)} />
                  {fb.isPublic && <Badge label="Public" color="green" />}
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                    {fb.user?.name||'Anonymous'} · {fmtDate(fb.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize:'0.845rem', color:'var(--text-secondary)', marginTop:2 }}>
                  {fb.message || fb.subject}
                </div>
              </div>
              <div className="ad-list-card-btns">
                <Btn size="sm" variant="ghost" onClick={() => setSelected(fb)}><Ic d={IC.eye} size={13} /></Btn>
                {fb.status === 'pending' && <Btn size="sm" variant="success" onClick={() => approve(fb._id)}>Publish</Btn>}
                {fb.status !== 'resolved' && <Btn size="sm" variant="outline" onClick={() => resolve(fb._id)}>Resolve</Btn>}
                <Btn size="sm" variant="danger" onClick={() => deleteFb(fb._id)}><Ic d={IC.trash} size={13} /></Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={load} />

      {selected && (
        <Modal title="Feedback Details" onClose={() => setSelected(null)}>
          <div className="ad-info-row"><span className="ad-info-key">From</span><span className="ad-info-val">{selected.user?.name||'Anonymous'}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Email</span><span className="ad-info-val" style={{ textTransform:'none' }}>{selected.user?.email||'—'}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Type</span><span className="ad-info-val">{selected.type}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Status</span><span className="ad-info-val">{selected.status}</span></div>
          <div className="ad-info-row"><span className="ad-info-key">Date</span><span className="ad-info-val">{fmtDate(selected.createdAt)}</span></div>
          <div className="ad-section-hd">Message</div>
          <div className="ad-msg-block">{selected.message || '—'}</div>
          <div className="ad-modal-footer">
            <Btn variant="danger" onClick={() => deleteFb(selected._id)}>Delete</Btn>
            <Btn variant="outline" onClick={() => setSelected(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── EVALUATION TAB ────────────────────────────────────────────────────────────
const EVAL_QUESTIONS = [
  { key: 'recommendationQuality', label: 'Recommendation Quality' },
  { key: 'easeOfUse',             label: 'Ease of Use' },
  { key: 'visualDesign',          label: 'Visual Design' },
  { key: 'systemSpeed',           label: 'System Speed' },
  { key: 'overallSatisfaction',   label: 'Overall Satisfaction' },
];

function EvaluationTab({ toast }) {
  const [count,     setCount]     = useState(0);
  const [averages,  setAverages]  = useState({});
  const [responses, setResponses] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/evaluation-results')
      .then(({ data }) => { setCount(data.count); setAverages(data.averages); setResponses(data.responses); })
      .catch(() => toast('Failed to load evaluation results.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, []);

  return (
    <div>
      <div className="ad-page-hd">
        <div>
          <h3 className="ad-page-title">Usability Evaluation</h3>
          <p className="ad-page-sub">Participant responses from the public usability survey at /evaluation.</p>
        </div>
        <div className="ad-page-actions">
          <Btn variant="outline" onClick={() => window.open('/api/admin/reports/evaluation', '_blank')}>
            <Ic d={IC.download} size={14} /> Export CSV
          </Btn>
        </div>
      </div>

      {loading ? <Spinner /> : count === 0 ? (
        <div className="ad-empty">
          <div className="ad-empty-icon"><Ic d={IC.clipboard} size={26} /></div>
          <div className="ad-empty-title">No evaluation responses yet</div>
        </div>
      ) : (
        <>
          <div className="ad-stats-grid">
            <StatCard icon="users" label="Total Responses" value={fmt(count)} bg="#7C3AED" />
            {EVAL_QUESTIONS.map(q => (
              <StatCard key={q.key} icon="bar" label={q.label} value={`${averages[q.key]?.toFixed(2) ?? '—'} / 5`} bg="#0D9488" />
            ))}
          </div>

          <div className="ad-card ad-card-p" style={{ marginTop: 18, marginBottom: 18 }}>
            <h4 className="ad-card-title">Average Rating by Question</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EVAL_QUESTIONS.map(q => {
                const avg = averages[q.key] || 0;
                const w = Math.round((avg / 5) * 100);
                return (
                  <div key={q.key} className="ad-bar-row">
                    <div className="ad-bar-hd"><span>{q.label}</span><span>{avg.toFixed(2)} / 5</span></div>
                    <div className="ad-bar-track"><div className="ad-bar-fill" style={{ width: `${w}%`, background: '#0D9488' }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ad-card ad-card-p">
            <h4 className="ad-card-title">Responses</h4>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    {EVAL_QUESTIONS.map(q => <th key={q.key}>{q.label}</th>)}
                    <th>Comments</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map(r => (
                    <tr key={r._id}>
                      <td>{r.participantLabel || 'Anonymous'}</td>
                      {EVAL_QUESTIONS.map(q => <td key={q.key}>{r[q.key]}</td>)}
                      <td style={{ maxWidth: 240, whiteSpace: 'normal' }}>{r.comments || '—'}</td>
                      <td>{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── LOGS TAB ──────────────────────────────────────────────────────────────────
function LogsTab({ toast }) {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [catF,    setCatF]    = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/logs', { params: { page: p, limit: 20, search, category: catF } });
      setLogs(data.logs); setTotal(data.total); setPages(data.pages); setPage(p);
    } catch { toast('Failed to load logs.', 'error'); }
    finally { setLoading(false); }
  }, [search, catF]);

  useEffect(() => { load(1); }, [search, catF]);

  const catColor = c => ({ auth:'blue', users:'purple', wardrobe:'green', feedback:'yellow', system:'gray' }[c] || 'gray');

  return (
    <div>
      <div className="ad-toolbar">
        <div className="ad-search">
          <span className="ad-search-icon"><Ic d={IC.search} size={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions…" />
        </div>
        <select value={catF} onChange={e => setCatF(e.target.value)} className="ad-select">
          <option value="">All categories</option>
          {['auth','users','wardrobe','feedback','system'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="ad-toolbar-count">{fmt(total)} entries</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>{['Category','Action','Detail','Date'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l._id}>
                  <td><Badge label={l.category||'system'} color={catColor(l.category)} /></td>
                  <td style={{ fontWeight:500, color:'var(--text-primary)' }}>{l.action}</td>
                  <td style={{ maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.detail||'—'}</td>
                  <td style={{ whiteSpace:'nowrap' }}>{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="ad-table-empty">No logs found.</div>}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={load} />
    </div>
  );
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────────────
function SettingsAdminTab({ toast }) {
  const [profile,   setProfile]   = useState({ name:'', email:'' });
  const [passwords, setPasswords] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [savingPw,  setSavingPw]  = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setProfile({ name: data.user.name, email: data.user.email }))
      .catch(() => toast('Failed to load profile.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async e => {
    e.preventDefault(); setSaving(true);
    try { await api.put('/admin/profile', profile); toast('Profile updated.'); }
    catch (err) { toast(err.response?.data?.message || 'Update failed.', 'error'); }
    finally { setSaving(false); }
  };

  const savePassword = async e => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return toast('Passwords do not match.', 'error');
    setSavingPw(true);
    try {
      await api.put('/admin/password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast('Password changed.');
      setPasswords({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) { toast(err.response?.data?.message || 'Change failed.', 'error'); }
    finally { setSavingPw(false); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <div className="ad-page-hd">
        <div>
          <h3 className="ad-page-title">Settings</h3>
          <p className="ad-page-sub">Manage your administrator account and export system data.</p>
        </div>
      </div>

      <div className="ad-settings-grid">
        <div className="ad-settings-card">
          <h3 className="ad-settings-title"><Ic d={IC.user} size={15} /> Administrator Profile</h3>
          <form onSubmit={saveProfile}>
            <Inp label="Name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            <Inp label="Email" type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            <Btn disabled={saving}>{saving ? 'Saving…' : 'Update Profile'}</Btn>
          </form>
        </div>

        <div className="ad-settings-card">
          <h3 className="ad-settings-title"><Ic d={IC.lock} size={15} /> Change Password</h3>
          <form onSubmit={savePassword}>
            <Inp label="Current Password" type="password" value={passwords.currentPassword} onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} />
            <Inp label="New Password" type="password" value={passwords.newPassword} onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} placeholder="8+ chars, uppercase, number, symbol" />
            <Inp label="Confirm New Password" type="password" value={passwords.confirmPassword} onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} />
            <Btn disabled={savingPw}>{savingPw ? 'Changing…' : 'Change Password'}</Btn>
          </form>
        </div>

        <div className="ad-settings-card ad-settings-card-wide">
          <h3 className="ad-settings-title"><Ic d={IC.download} size={15} /> Data Exports</h3>
          <p className="ad-settings-hint">Download system data as CSV for analysis or backup.</p>
          <div className="ad-settings-actions">
            <Btn variant="outline" onClick={() => window.open('/api/admin/reports/users', '_blank')}>
              <Ic d={IC.download} size={14} /> Export Users CSV
            </Btn>
            <Btn variant="outline" onClick={() => window.open('/api/admin/reports/recommendations', '_blank')}>
              <Ic d={IC.download} size={14} /> Export Recs CSV
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}

// ── MAIN ADMIN DASHBOARD ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { logout: authLogout, user }   = useAuth();
  const [tab,          setTab]          = useState('overview');
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [adminName,    setAdminName]    = useState('Admin');
  const [profileOpen,  setProfileOpen]  = useState(false);
  const profileRef = React.useRef(null);
  const { toasts, toast, remove }      = useToast();

  useEffect(() => {
    if (user?.name) setAdminName(user.name);
  }, [user]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = e => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileOpen]);

  const initial = adminName.charAt(0).toUpperCase();

  const logout = async () => {
    await authLogout();
    window.location.href = '/';
  };

  const navigate = key => { setTab(key); setMobileOpen(false); };

  const CONTENT = {
    overview:   <OverviewTab      toast={toast} />,
    users:      <UsersTab         toast={toast} />,
    moderation: <ModerationTab    toast={toast} />,
    catalog:    <CatalogTab       toast={toast} />,
    kathmandu:  <KathmanduTab     toast={toast} />,
    recs:      <RecsTab          toast={toast} />,
    ml:        <MLTab            toast={toast} />,
    feedback:  <FeedbackTab      toast={toast} />,
    evaluation:<EvaluationTab    toast={toast} />,
    logs:      <LogsTab          toast={toast} />,
    settings:  <SettingsAdminTab toast={toast} />,
  };

  const activeTab = TABS.find(t => t.key === tab);

  const rootClass = [
    'ad-root',
    collapsed ? 'sb-collapsed' : '',
    mobileOpen ? 'sb-mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {/* Mobile overlay */}
      <div className="ad-mobile-overlay" onClick={() => setMobileOpen(false)} />

      {/* Sidebar */}
      <aside className="ad-sidebar">
        {/* Logo */}
        <div className="ad-sb-logo">
          <div className="ad-sb-logo-icon">
            <Ic d={IC.zap} size={16} />
          </div>
          {!collapsed && (
            <>
              <span className="ad-sb-logo-text">StyleAI</span>
              <span className="ad-sb-logo-badge">ADMIN</span>
            </>
          )}
          <button className="ad-sb-collapse" onClick={() => setCollapsed(s => !s)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Ic d={collapsed ? IC.chevRight : IC.chevLeft} size={13} />
          </button>
        </div>

        {/* Nav */}
        <nav className="ad-sb-nav">
          {TABS.map(t => (
            <button key={t.key} onClick={() => navigate(t.key)}
              className={`ad-sb-item${tab === t.key ? ' active' : ''}`}
              title={collapsed ? t.label : undefined}>
              <span className="ad-sb-item-icon">
                <Ic d={IC[t.icon] || IC.bar} size={16} />
              </span>
              {!collapsed && t.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="ad-sb-footer">
          <div className="ad-sb-avatar">{initial}</div>
          {!collapsed && (
            <div className="ad-sb-user">
              <span className="ad-sb-user-name">{adminName}</span>
              <span className="ad-sb-user-role">Administrator</span>
            </div>
          )}
          <button className="ad-sb-logout" onClick={logout} title="Sign out">
            <Ic d={IC.logout} size={15} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ad-main">
        {/* Topbar */}
        <header className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-menu-btn" onClick={() => setMobileOpen(s => !s)}>
              <Ic d={IC.menu} size={18} />
            </button>
            <span className="ad-topbar-title">{activeTab?.label}</span>
          </div>
          <div className="ad-topbar-right">
            <button className="ad-icon-btn" title="Refresh page" onClick={() => window.location.reload()}>
              <Ic d={IC.refresh} size={15} />
            </button>
            <div className="ad-profile-wrap" ref={profileRef}>
              <button className="ad-topbar-avatar ad-profile-btn" onClick={() => setProfileOpen(s => !s)}
                title="Account menu" aria-expanded={profileOpen}>
                {initial}
              </button>
              {profileOpen && (
                <div className="ad-profile-menu">
                  <div className="ad-profile-menu-hd">
                    <div className="ad-profile-menu-avatar">{initial}</div>
                    <div>
                      <div className="ad-profile-menu-name">{adminName}</div>
                      <div className="ad-profile-menu-role">Administrator</div>
                    </div>
                  </div>
                  <div className="ad-profile-menu-divider" />
                  <button className="ad-profile-menu-item ad-profile-menu-logout" onClick={logout}>
                    <Ic d={IC.logout} size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="ad-content">
          {CONTENT[tab]}
        </div>
      </main>

      <ToastContainer toasts={toasts} remove={remove} />
    </div>
  );
}
