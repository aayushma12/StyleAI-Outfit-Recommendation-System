import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Wardrobe from './Wardrobe';
import OutfitBuilder from './OutfitBuilder';
import SavedOutfits from './SavedOutfits';
import OutfitCalendar from './OutfitCalendar';
import FeedbackView from './FeedbackView';
import SettingsView from './SettingsView';
import StyleProfileView from './StyleProfileView';
import History from './History';
import AIAssistant from './AIAssistant';
import RecommendationPanel from '../components/RecommendationPanel';
import InsightsPanel from '../components/InsightsPanel';
import DailyOutfitCard from '../components/DailyOutfitCard';
import './Dashboard.css';

const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Icons = {
  grid:     "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  hanger:   "M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z",
  layers:   "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  clock:    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14v4l3 3",
  message:  "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zm0 0v3m0-12V3m9 9h-3M6 12H3m14.1-5.1l-2.1 2.1M8 8L5.9 5.9m10.2 10.2L14 14m-4 4l-2.1 2.1",
  logout:   "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  menu:     "M3 12h18M3 6h18M3 18h18",
  x:        "M18 6L6 18M6 6l12 12",
  search:   "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  bell:     "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9m-4.27 13a2 2 0 01-3.46 0",
  sun:      "M12 17a5 5 0 100-10 5 5 0 000 10zm0-15v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon:     "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  user:     "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z",
  edit2:    "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  profile:  "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  lock:     "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-7-7a4 4 0 00-4 4v3h8V8a4 4 0 00-4-4z",
  sparkle:  "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z",
  star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
  brain:    "M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7H4a2 2 0 00-2 2v0a2 2 0 002 2h.5A2.5 2.5 0 017 13.5v0A2.5 2.5 0 019.5 16H10a2 2 0 002-2v-4a2 2 0 00-2-2h-.5zM14.5 2A2.5 2.5 0 0117 4.5v0A2.5 2.5 0 0119.5 7H20a2 2 0 012 2v0a2 2 0 01-2 2h-.5A2.5 2.5 0 0117 13.5v0A2.5 2.5 0 0114.5 16H14a2 2 0 01-2-2v-4a2 2 0 012-2h.5z",
};

const NAV_ITEMS = [
  { id: 'overview',  label: 'Dashboard',       icon: 'grid' },
  { divider: true },
  { id: 'wardrobe',  label: 'My Wardrobe',     icon: 'hanger' },
  { id: 'builder',   label: 'Outfit Builder',  icon: 'layers' },
  { id: 'calendar',  label: 'Outfit Calendar', icon: 'calendar' },
  { divider: true },
  { id: 'ai',        label: 'AI Assistant',    icon: 'sparkle' },
  { id: 'insights',  label: 'My Insights',     icon: 'trending' },
  { divider: true },
  { id: 'saved',     label: 'Saved Outfits',   icon: 'bookmark' },
  { id: 'history',   label: 'History',         icon: 'clock' },
  { divider: true },
  { id: 'feedback',  label: 'Feedback',        icon: 'message' },
  { id: 'profile',   label: 'Style Profile',   icon: 'profile' },
  { id: 'settings',  label: 'Settings',        icon: 'settings' },
];

const COLOR_MAP = {
  red:'#EF4444', pink:'#06B6D4', orange:'#F97316', yellow:'#EAB308',
  green:'#22C55E', teal:'#14B8A6', blue:'#3B82F6', purple:'#A855F7',
  black:'#1F2937', white:'#F3F4F6', beige:'#D4B896', maroon:'#7F1D1D',
  navy:'#1E3A5F', olive:'#808000', gold:'#D97706', rose:'#FB7185',
};

const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const formatDate  = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const OUTFIT_CATEGORIES = [
  { emoji: '👕', label: 'Casual',             desc: 'Everyday relaxed style',        prompt: 'Generate a casual everyday outfit for me based on my wardrobe and preferences' },
  { emoji: '💼', label: 'Formal',             desc: 'Elegant and professional',       prompt: 'Generate a formal elegant outfit for me' },
  { emoji: '🏢', label: 'Office Wear',        desc: 'Smart professional look',        prompt: 'Generate an office-appropriate professional outfit for me' },
  { emoji: '🎒', label: 'College',            desc: 'Cool campus style',              prompt: 'Generate a stylish college campus outfit for me' },
  { emoji: '🎉', label: 'Party',              desc: 'Stand out & have fun',           prompt: 'Generate a fun party outfit for me' },
  { emoji: '💒', label: 'Wedding Guest',      desc: 'Celebratory & tasteful',         prompt: 'Generate a wedding guest outfit for me' },
  { emoji: '🎪', label: 'Festival',           desc: 'Vibrant & expressive',           prompt: 'Generate a vibrant festival outfit for me' },
  { emoji: '🪔', label: 'Traditional',        desc: 'Cultural & ethnic styles',       prompt: 'Generate a traditional cultural outfit for me' },
  { emoji: '✈️', label: 'Travel',             desc: 'Comfortable yet chic',           prompt: 'Generate a comfortable travel outfit for me' },
  { emoji: '💕', label: 'Date Night',         desc: 'Romantic & confident',           prompt: 'Generate a romantic date night outfit for me' },
  { emoji: '🏋️', label: 'Gym & Sport',        desc: 'Active & performance-ready',     prompt: 'Generate an activewear gym outfit for me' },
  { emoji: '🌧️', label: 'Rainy Day',          desc: 'Stylish rain-ready look',        prompt: 'Generate a stylish rainy day outfit for me' },
  { emoji: '🤝', label: 'Business Meeting',   desc: 'Confident & polished',           prompt: 'Generate a business meeting outfit for me' },
  { emoji: '🌙', label: 'Evening Wear',       desc: 'Sophisticated night look',       prompt: 'Generate a sophisticated evening outfit for me' },
  { emoji: '✨', label: 'Smart Casual',       desc: 'Effortlessly put-together',      prompt: 'Generate a smart casual outfit for me' },
  { emoji: '🛹', label: 'Streetwear',         desc: 'Urban cool & trendy',            prompt: 'Generate a trendy streetwear outfit for me' },
  { emoji: '📋', label: 'Interview',          desc: 'Make a great first impression',  prompt: 'Generate an interview outfit for me' },
  { emoji: '🏕️', label: 'Outdoor Adventure',  desc: 'Ready for the outdoors',         prompt: 'Generate an outdoor adventure outfit for me' },
  { emoji: '🎯', label: 'Minimalist',         desc: 'Clean lines, less is more',      prompt: 'Generate a minimalist capsule outfit for me' },
  { emoji: '☕', label: 'Weekend Casual',     desc: 'Relaxed weekend vibes',          prompt: 'Generate a relaxed weekend casual outfit for me' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [darkMode, setDarkMode]           = useState(() => localStorage.getItem('styleai_dark') === '1');
  const [showProfile, setShowProfile]     = useState(false);
  const profileRef = useRef(null);

  const [stats, setStats] = useState({ wardrobe: 0, saved: 0, calendar: 0, feedback: 0 });
  // Tracks which stats failed to load, so the UI can show "—" instead of a
  // misleading "0" (a failed request and a genuinely empty wardrobe/saved
  // list previously looked identical to the user).
  const [statsFailed, setStatsFailed]   = useState({ wardrobe: false, saved: false });
  const [statsLoading, setStatsLoading] = useState(true);
  const [aiInitialPrompt, setAiInitialPrompt] = useState(null);

  const firstName  = user?.name?.split(' ')[0] || 'there';
  const colors     = user?.colorPreferences?.slice(0, 8) || [];

  useEffect(() => {
    Promise.all([
      api.get('/wardrobe/stats').catch(() => null),
      api.get('/wardrobe/outfits/saved').catch(() => null),
      api.get(`/calendar?year=${new Date().getFullYear()}&month=${new Date().getMonth()+1}`).catch(() => null),
      api.get('/app-feedback').catch(() => null),
    ]).then(([wardrobeRes, savedRes, calendarRes, feedbackRes]) => {
      setStats({
        wardrobe: wardrobeRes?.data?.total              || 0,
        saved:    savedRes?.data?.combinations?.length  || 0,
        calendar: calendarRes?.data?.entries?.length    || 0,
        feedback: feedbackRes?.data?.feedbacks?.length  || 0,
      });
      setStatsFailed({ wardrobe: !wardrobeRes, saved: !savedRes });
      setStatsLoading(false);
    });
  }, []);


  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('styleai_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  useEffect(() => {
    const handler = e => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (user && !user.onboardingCompleted) navigate('/onboarding');
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className={`db-root ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

      <aside className="db-sidebar">
        <div className="db-sb-logo">
          <span className="db-sb-logo-icon"><Icon d={Icons.sparkle} size={18} /></span>
          {sidebarOpen && <span className="db-sb-logo-text">StyleAI</span>}
        </div>

        <nav className="db-sb-nav">
          {NAV_ITEMS.map((item, i) => {
            if (item.divider) {
              return sidebarOpen
                ? <div key={`div-${i}`} className="db-sb-divider" />
                : <div key={`div-${i}`} className="db-sb-divider-dot" />;
            }
            const isActive = activeSection === item.id;
            return (
              <button key={item.id}
                className={`db-sb-item${isActive ? ' active' : ''}`}
                onClick={() => setActiveSection(item.id)}
                title={!sidebarOpen ? item.label : undefined}>
                <span className="db-sb-item-icon"><Icon d={Icons[item.icon]} size={18} /></span>
                {sidebarOpen && <span className="db-sb-item-label">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="db-sb-footer">
          <div className="db-sb-user">
            <div className="db-sb-avatar">{firstName[0]}</div>
            {sidebarOpen && (
              <div className="db-sb-user-info">
                <span className="db-sb-user-name">{user?.name}</span>
                <span className="db-sb-user-role">Style Member</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button className="db-sb-logout" onClick={handleLogout} title="Logout">
              <Icon d={Icons.logout} size={16} />
            </button>
          )}
        </div>
      </aside>

      <div className="db-main">

        {/* TOP BAR */}
        <header className="db-topbar">
          <div className="db-topbar-left">
            <button className="db-toggle-btn" onClick={() => setSidebarOpen(p => !p)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
              <Icon d={sidebarOpen ? Icons.x : Icons.menu} size={20} />
            </button>
            <div className="db-topbar-date">{formatDate()}</div>
          </div>
          <div className="db-topbar-right">
            <button className="db-topbar-btn" onClick={() => {
              const next = !darkMode;
              setDarkMode(next);
              api.patch('/users/theme', { theme: next ? 'dark' : 'light' }).catch(() => {});
            }} title={darkMode ? 'Light mode' : 'Dark mode'} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              <Icon d={darkMode ? Icons.sun : Icons.moon} size={19} />
            </button>
            <div className="db-topbar-profile" ref={profileRef}>
              <button className="db-topbar-avatar" onClick={() => setShowProfile(p => !p)}
                aria-label="Open profile menu" aria-haspopup="true" aria-expanded={showProfile}>
                {firstName[0]}
                <span className="db-topbar-avatar-ring" />
              </button>
              {showProfile && (
                <div className="db-profile-dropdown">
                  <div className="db-pd-header">
                    <div className="db-pd-avatar">{firstName[0]}</div>
                    <div>
                      <div className="db-pd-name">{user?.name}</div>
                      <div className="db-pd-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="db-pd-divider" />
                  <button className="db-pd-item" onClick={() => { setShowProfile(false); setActiveSection('profile'); }}>
                    <Icon d={Icons.edit2} size={16} /> Style Profile
                  </button>
                  <div className="db-pd-divider" />
                  <button className="db-pd-item db-pd-logout" onClick={handleLogout}>
                    <Icon d={Icons.logout} size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className={`db-content${activeSection === 'ai' ? ' db-content--fullbleed' : ''}`}>

          {activeSection === 'overview' && (
            <div className="db-overview">
              {/* Greeting */}
              <div className="db-greeting-card">
                <div className="db-greeting-text">
                  <h2>{getGreeting()}, {firstName}!</h2>
                  <p>Welcome to your personal wardrobe & outfit planner.</p>
                </div>
                <div className="db-greeting-icon">
                  <Icon d={Icons.sparkle} size={36} />
                </div>
              </div>

              {/* Daily AI Outfit — hero position */}
              <DailyOutfitCard
                userName={user?.name}
                onNavigate={setActiveSection}
              />

              {/* Stats */}
              <div className="db-stats-row">
                {[
                  { label: 'Wardrobe Items',  val: stats.wardrobe,  icon: 'hanger',   color: '#D97706', section: 'wardrobe', failed: statsFailed.wardrobe },
                  { label: 'Saved Outfits',   val: stats.saved,     icon: 'bookmark',  color: '#0D9488', section: 'saved',    failed: statsFailed.saved },
                  { label: 'Outfit Builder',  val: '',              icon: 'layers',    color: '#0EA5E9', section: 'builder' },
                  { label: 'Outfit Calendar', val: '',              icon: 'calendar',  color: '#059669', section: 'calendar' },
                ].map(s => (
                  <div key={s.label} className="db-stat-card" onClick={() => setActiveSection(s.section)} style={{ cursor: 'pointer' }}
                    role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setActiveSection(s.section)}>
                    <div className="db-stat-icon" style={{ '--c': s.color }}>
                      <Icon d={Icons[s.icon]} size={20} />
                    </div>
                    <div className="db-stat-body">
                      {s.val !== '' && (
                        statsLoading ? (
                          <span className="skeleton skeleton-text" style={{ width: 28, height: 18, display: 'inline-block' }} />
                        ) : s.failed ? (
                          <span className="db-stat-val" style={{ color: 'var(--text-muted)' }} title="Couldn't load this — try refreshing">—</span>
                        ) : (
                          <span className="db-stat-val" style={{ color: s.color }}>{s.val}</span>
                        )
                      )}
                      <span className="db-stat-lbl">{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Personalized Outfit Recommendations */}
              <div className="db-outfit-cats-section">
                <div className="db-outfit-cats-header">
                  <h3 className="db-outfit-cats-title">
                    <Icon d={Icons.sparkle} size={16} /> Personalized Outfit Recommendations
                  </h3>
                  <p className="db-outfit-cats-sub">Pick a style and let StyleAI create the perfect outfit for you</p>
                </div>
                <div className="db-outfit-cats-grid">
                  {OUTFIT_CATEGORIES.map(cat => (
                    <button
                      key={cat.label}
                      className="db-outfit-cat-card"
                      onClick={() => { setAiInitialPrompt(cat.prompt); setActiveSection('ai'); }}
                    >
                      <span className="db-outfit-cat-icon">{cat.emoji}</span>
                      <span className="db-outfit-cat-name">{cat.label}</span>
                      <span className="db-outfit-cat-desc">{cat.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <RecommendationPanel />

              {/* Style Profile Card */}
              <div className="db-two-row">
                <div className="db-card db-profile-card">
                  <div className="db-card-header">
                    <div className="db-card-title">Your Style Profile</div>
                    <button className="db-card-btn" onClick={() => setActiveSection('profile')}>Edit →</button>
                  </div>
                  <div className="db-profile-type">
                    <div className="db-profile-type-badge"><Icon d={Icons.star} size={16} /></div>
                    <div>
                      <div className="db-profile-type-name">{user?.name}</div>
                      <div className="db-profile-type-sub">{user?.email}</div>
                    </div>
                  </div>
                  {colors.length > 0 && (
                    <div className="db-profile-section">
                      <div className="db-profile-lbl">Favourite Colors</div>
                      <div className="db-profile-colors">
                        {colors.map(c => (
                          <span key={c} className="db-color-dot" title={c}
                            style={{ background: COLOR_MAP[c] || '#999', boxShadow: c === 'white' ? 'inset 0 0 0 1px #D1D5DB' : 'none' }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {(user?.occasionPreferences || []).length > 0 && (
                    <div className="db-profile-section">
                      <div className="db-profile-lbl">Occasions</div>
                      <div className="db-profile-occ">
                        {(user.occasionPreferences || []).slice(0, 4).map(o => (
                          <span key={o} className="db-occ-chip">{cap(o)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Getting Started */}
                <div className="db-card db-insight-card">
                  <div className="db-card-header">
                    <div className="db-card-title">Getting Started</div>
                  </div>
                  <div className="db-insight-body">
                    {[
                      { step: '1', text: 'Upload your clothing items to My Wardrobe',  section: 'wardrobe' },
                      { step: '2', text: 'Use Outfit Builder to create combinations',   section: 'builder' },
                      { step: '3', text: 'Plan your week with Outfit Calendar',         section: 'calendar' },
                    ].map(s => (
                      <div key={s.step} className="db-step" onClick={() => setActiveSection(s.section)}
                        role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setActiveSection(s.section)}>
                        <span className="db-step-num">{s.step}</span>
                        <span className="db-step-text">{s.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'wardrobe'  && <Wardrobe />}
          {activeSection === 'builder'   && <OutfitBuilder />}
          {activeSection === 'calendar'  && <OutfitCalendar />}
          {activeSection === 'ai'        && (
            <AIAssistant
              initialPrompt={aiInitialPrompt}
              onPromptConsumed={() => setAiInitialPrompt(null)}
            />
          )}
          {activeSection === 'insights'  && (
            <div className="db-overview">
              <div className="db-greeting-card">
                <div className="db-greeting-text">
                  <h2>My Style Insights</h2>
                  <p>How StyleAI understands and learns from your fashion preferences</p>
                </div>
                <div className="db-greeting-icon"><Icon d={Icons.brain} size={36} /></div>
              </div>
              <InsightsPanel onNavigate={setActiveSection} />
            </div>
          )}
          {activeSection === 'saved'     && <SavedOutfits />}
          {activeSection === 'history'   && <History />}
          {activeSection === 'feedback'  && <FeedbackView />}
          {activeSection === 'profile'   && <StyleProfileView />}
          {activeSection === 'settings'  && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
