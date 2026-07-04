import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Onboarding.css';

const STYLE_CARDS = [
  { id: 'casual',      label: 'Casual',      emoji: '👟', desc: 'Effortless everyday comfort',       img: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80' },
  { id: 'formal',      label: 'Formal',      emoji: '💼', desc: 'Sharp, polished & professional',    img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80' },
  { id: 'elegant',     label: 'Elegant',     emoji: '💎', desc: 'Refined, sophisticated & chic',     img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80' },
  { id: 'traditional', label: 'Traditional', emoji: '🪷', desc: 'Cultural heritage with modern flair', img: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80' },
  { id: 'streetwear',  label: 'Streetwear',  emoji: '🔥', desc: 'Urban, bold & trend-forward',       img: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&q=80' },
];

const COLORS = [
  { name: 'red',    hex: '#EF4444', label: 'Red' },
  { name: 'pink',   hex: '#EC4899', label: 'Pink' },
  { name: 'orange', hex: '#F97316', label: 'Orange' },
  { name: 'yellow', hex: '#EAB308', label: 'Yellow' },
  { name: 'green',  hex: '#22C55E', label: 'Green' },
  { name: 'teal',   hex: '#14B8A6', label: 'Teal' },
  { name: 'blue',   hex: '#3B82F6', label: 'Blue' },
  { name: 'purple', hex: '#A855F7', label: 'Purple' },
  { name: 'black',  hex: '#1F2937', label: 'Black' },
  { name: 'white',  hex: '#F3F4F6', label: 'White', outline: true },
  { name: 'beige',  hex: '#D4B896', label: 'Beige' },
  { name: 'maroon', hex: '#7F1D1D', label: 'Maroon' },
  { name: 'navy',   hex: '#1E3A5F', label: 'Navy' },
  { name: 'olive',  hex: '#808000', label: 'Olive' },
  { name: 'gold',   hex: '#D97706', label: 'Gold' },
  { name: 'rose',   hex: '#FB7185', label: 'Rose' },
];

const OCCASIONS = [
  { id: 'college', label: 'College',  icon: '🎓', desc: 'Campus & student life' },
  { id: 'office',  label: 'Office',   icon: '💼', desc: 'Professional workspace' },
  { id: 'party',   label: 'Party',    icon: '🎉', desc: 'Celebrations & socials' },
  { id: 'wedding', label: 'Wedding',  icon: '💒', desc: 'Ceremonies & receptions' },
  { id: 'festival',label: 'Festival', icon: '🪔', desc: 'Dashain, Tihar & cultural events' },
];

const BUDGETS = [
  { id: 'budget',   label: 'Budget Friendly', range: 'NPR 500 – 2,000',   icon: '💚', desc: 'Affordable everyday finds',       min: 500,   max: 2000  },
  { id: 'midrange', label: 'Mid Range',        range: 'NPR 2,000 – 5,000', icon: '💛', desc: 'Quality meets great value',       min: 2000,  max: 5000  },
  { id: 'premium',  label: 'Premium',          range: 'NPR 5,000 – 15,000',icon: '🔶', desc: 'Elevated fashion pieces',         min: 5000,  max: 15000 },
  { id: 'luxury',   label: 'Luxury',           range: 'NPR 15,000+',       icon: '💎', desc: 'Designer & exclusive labels',     min: 15000, max: 99999 },
];

const COMFORT = [
  { id: 1, label: 'Super Casual',  desc: 'Loungewear & athleisure', icon: '😌' },
  { id: 2, label: 'Casual',        desc: 'Jeans, tees & everyday',  icon: '😊' },
  { id: 3, label: 'Smart Casual',  desc: 'Put-together & comfy',    icon: '🙂' },
  { id: 4, label: 'Semi Formal',   desc: 'Structured & polished',   icon: '😎' },
  { id: 5, label: 'Fully Formal',  desc: 'Power outfit & statement',icon: '💅' },
];

const INSPIRATIONS = [
  { id: 'kpop',      label: 'K-Pop Chic',           emoji: '🌸', desc: 'Bold, colorful & trend-forward',       grad: 'linear-gradient(135deg,#06B6D4,#0D9488)' },
  { id: 'bollywood', label: 'Bollywood Glam',        emoji: '✨', desc: 'Glamorous, embellished & dramatic',    grad: 'linear-gradient(135deg,#f97316,#dc2626)' },
  { id: 'minimalist',label: 'Western Minimalist',    emoji: '🤍', desc: 'Clean lines, neutral & timeless',      grad: 'linear-gradient(135deg,#6b7280,#374151)' },
  { id: 'boho',      label: 'Boho Goddess',          emoji: '🌿', desc: 'Flowing fabrics & earthy tones',       grad: 'linear-gradient(135deg,#16a34a,#d97706)' },
  { id: 'power',     label: 'Power Executive',       emoji: '⚡', desc: 'Sharp, authoritative & confident',     grad: 'linear-gradient(135deg,#0F766E,#0D9488)' },
  { id: 'street',    label: 'Street Royalty',        emoji: '👑', desc: 'Urban edge & self-expression',         grad: 'linear-gradient(135deg,#1F2937,#0D9488)' },
];

const ANALYZE_MSGS = [
  'Analyzing your fashion DNA…',
  'Mapping your color story…',
  'Matching occasion styles…',
  'Curating AI recommendations…',
  'Building your style profile…',
  'Finalizing your look…',
];

const STYLE_PROFILES = {
  casual:      { type: 'Effortless Cool',    desc: 'You embrace comfort without sacrificing style. Your wardrobe flows naturally with real life.',           categories: ['Casual Co-ords','Denim Sets','Sneaker Outfits','Relaxed Tees'],    accent: '#0D9488' },
  formal:      { type: 'Power Professional', desc: 'You dress with intention — sharp, polished, and always camera-ready for what matters.',                categories: ['Office Blazers','Formal Trousers','Structured Bags','Power Tops'], accent: '#1E3A5F' },
  elegant:     { type: 'Timeless Elegance',  desc: 'You choose refined, sophisticated pieces that turn every entrance into a moment.',                       categories: ['Evening Gowns','Maxi Dresses','Silk Tops','Statement Jewellery'], accent: '#9D174D' },
  traditional: { type: 'Cultural Queen',     desc: 'You celebrate your heritage through fashion — blending tradition with a fresh modern sensibility.',     categories: ['Designer Sarees','Fusion Kurtas','Lehenga Sets','Ethnic Jewellery'], accent: '#92400E' },
  streetwear:  { type: 'Urban Royalty',      desc: 'You set trends, not follow them. Bold, contemporary street style is your natural language.',            categories: ['Graphic Tees','Cargo Co-ords','Chunky Sneakers','Statement Caps'], accent: '#1F2937' },
};

const STYLE_MAP = { casual:'casual', formal:'formal', elegant:'fusion', traditional:'traditional', streetwear:'western' };
const INSP_MAP  = { kpop:'western', bollywood:'fusion', minimalist:'minimalist', boho:'bohemian', power:'formal', street:'casual' };

const QUESTIONS = [
  { key: 'fashionStyle', title: 'What fashion style are you?', sub: 'Pick the one that feels most like you.' },
  { key: 'favoriteColors', title: 'What are your favourite colours?', sub: 'Choose all that speak to your wardrobe.' },
  { key: 'occasion', title: 'Where do you dress up most?', sub: 'Pick your most frequent occasion.' },
  { key: 'budget', title: "What's your outfit budget?", sub: 'Choose the range that fits you best.' },
  { key: 'comfortLevel', title: 'How dressed-up do you like to be?', sub: 'Slide your style comfort scale.' },
  { key: 'inspiration', title: "Who's your fashion inspiration?", sub: 'Pick the vibe that matches your inner style icon.' },
];

export default function StyleQuiz() {
  const [phase, setPhase] = useState('intro');   // 'intro' | 0-5 | 'analyzing' | 'result'
  const [answers, setAnswers] = useState({ fashionStyle: null, favoriteColors: [], occasion: null, budget: null, comfortLevel: null, inspiration: null });
  const [msgIdx, setMsgIdx] = useState(0);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  /* Smooth scroll to top on question change */
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [phase]);

  /* Analyzing animation */
  useEffect(() => {
    if (phase !== 'analyzing') return;
    let i = 0;
    const msgTimer = setInterval(() => { i++; setMsgIdx(i % ANALYZE_MSGS.length); }, 480);
    const progTimer = setInterval(() => { setAnalyzeProgress(p => Math.min(p + 2, 100)); }, 55);
    const doneTimer = setTimeout(() => {
      clearInterval(msgTimer);
      clearInterval(progTimer);
      setAnalyzeProgress(100);
      setTimeout(() => setPhase('result'), 400);
    }, 2900);
    return () => { clearInterval(msgTimer); clearInterval(progTimer); clearTimeout(doneTimer); };
  }, [phase]);

  /* Post profile when analyzing starts */
  useEffect(() => {
    if (phase !== 'analyzing') return;
    (async () => {
      setSaving(true);
      setError('');
      try {
        const budget = BUDGETS.find(b => b.id === answers.budget);
        const styles = [...new Set([STYLE_MAP[answers.fashionStyle], INSP_MAP[answers.inspiration]].filter(Boolean))];
        await api.post('/users/onboarding', {
          // bodyType is collected once, at registration (Register.jsx) — this
          // quiz never asks about it, so it must pass the real value through
          // rather than a hardcoded guess, or it would silently overwrite
          // every user's real body type on every retake.
          bodyType: user?.bodyType,
          stylePreferences: styles,
          occasionPreferences: answers.occasion ? [answers.occasion] : ['daily'],
          colorPreferences: answers.favoriteColors,
          budgetRange: { min: budget?.min ?? 500, max: budget?.max ?? 5000 },
          culturalBackground: 'Nepali',
        });
        await refreshUser();
      } catch (e) {
        setError('Your style profile couldn’t be saved. You can still explore, or retake the quiz to try again.');
      } finally {
        setSaving(false);
      }
    })();
  }, [phase]);

  const set = (key, val) => setAnswers(p => ({ ...p, [key]: val }));
  const toggle = (key, val) => setAnswers(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val] }));

  const canNext = () => {
    if (typeof phase !== 'number') return true;
    const q = QUESTIONS[phase];
    const val = answers[q.key];
    if (q.key === 'favoriteColors') return val.length > 0;
    return val !== null && val !== undefined;
  };

  const goNext = () => {
    if (!canNext()) return;
    if (typeof phase === 'number' && phase < 5) { setPhase(phase + 1); return; }
    if (phase === 5) { setPhase('analyzing'); }
  };

  // Skipping must still mark onboarding complete with the user's real
  // bodyType — otherwise Dashboard's `!user.onboardingCompleted` guard
  // immediately redirects back here, trapping the user in a loop.
  const skipQuiz = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/users/onboarding', {
        bodyType: user?.bodyType,
        stylePreferences: [],
        occasionPreferences: ['daily'],
        colorPreferences: [],
        budgetRange: { min: 500, max: 5000 },
        culturalBackground: 'Nepali',
      });
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      setError('Could not skip right now — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (phase === 'intro') return;
    if (phase === 0) { setPhase('intro'); return; }
    if (typeof phase === 'number') setPhase(phase - 1);
  };

  const profile = STYLE_PROFILES[answers.fashionStyle] || STYLE_PROFILES.casual;
  const progress = typeof phase === 'number' ? ((phase + 1) / 6) * 100 : phase === 'analyzing' || phase === 'result' ? 100 : 0;

  return (
    <div className="sq-root">
      {/* Faint background image */}
      <div className="sq-bg" style={{ backgroundImage: 'url(/hero-bg.png)' }} />

      {/* Top progress bar */}
      {phase !== 'intro' && (
        <div className="sq-topbar">
          <div className="sq-topbar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {phase === 'intro' && (
        <div className="sq-center">
          <div className="sq-intro-card">
            <div className="sq-intro-brand">✦ StyleAI</div>
            <div className="sq-intro-glow" />
            <div className="sq-intro-icon">
              <span>👗</span>
            </div>
            <h1 className="sq-intro-title">Discover Your<br /><em>Style DNA</em></h1>
            <p className="sq-intro-sub">Answer 6 fun questions and unlock a personalized AI fashion profile curated just for you.</p>
            <div className="sq-intro-chips">
              <span>⚡ 2 minutes</span>
              <span>🎯 6 questions</span>
              <span>✨ Free forever</span>
            </div>
            <button className="sq-btn-primary" onClick={() => setPhase(0)}>
              Start My Style Quiz →
            </button>
            <button className="sq-btn-skip" onClick={skipQuiz} disabled={saving}>
              {saving ? 'Skipping…' : 'Skip for now'}
            </button>
            {error && <p className="sq-result-error">{error}</p>}
          </div>
        </div>
      )}

      {typeof phase === 'number' && (
        <div className="sq-center sq-question-wrap">
          {/* Nav header */}
          <div className="sq-qnav">
            <button className="sq-nav-back" onClick={goBack}>← Back</button>
            <div className="sq-qcount">
              {QUESTIONS.map((_, i) => (
                <span key={i} className={`sq-qdot ${i < phase ? 'done' : i === phase ? 'active' : ''}`} />
              ))}
            </div>
            <button className="sq-nav-skip" onClick={skipQuiz} disabled={saving}>
              {saving ? 'Skipping…' : 'Skip quiz'}
            </button>
          </div>

          {/* Question heading */}
          <div className="sq-qhead">
            <span className="sq-qnum">Question {phase + 1} of 6</span>
            <h2 className="sq-qtitle">{QUESTIONS[phase].title}</h2>
            <p className="sq-qsub">{QUESTIONS[phase].sub}</p>
          </div>
          {error && <p className="sq-result-error">{error}</p>}

          {phase === 0 && (
            <div className="sq-style-grid">
              {STYLE_CARDS.map(s => (
                <button key={s.id} type="button"
                  className={`sq-style-card ${answers.fashionStyle === s.id ? 'active' : ''}`}
                  onClick={() => set('fashionStyle', s.id)}>
                  <div className="sq-style-img">
                    <img src={s.img} alt={s.label} />
                    {answers.fashionStyle === s.id && <div className="sq-style-check">✓</div>}
                  </div>
                  <div className="sq-style-body">
                    <span className="sq-style-emoji">{s.emoji}</span>
                    <span className="sq-style-label">{s.label}</span>
                    <span className="sq-style-desc">{s.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {phase === 1 && (
            <div className="sq-colors-wrap">
              <div className="sq-color-grid">
                {COLORS.map(c => (
                  <button key={c.name} type="button"
                    className={`sq-color-btn ${answers.favoriteColors.includes(c.name) ? 'active' : ''}`}
                    onClick={() => toggle('favoriteColors', c.name)}
                    title={c.label}>
                    <span className="sq-color-swatch"
                      style={{ background: c.hex, boxShadow: c.outline ? 'inset 0 0 0 1.5px #D1D5DB' : 'none' }} />
                    <span className="sq-color-label">{c.label}</span>
                  </button>
                ))}
              </div>
              {answers.favoriteColors.length > 0 && (
                <div className="sq-color-selected">
                  <span>Selected:</span>
                  {answers.favoriteColors.map(n => {
                    const c = COLORS.find(x => x.name === n);
                    return <span key={n} className="sq-color-chip" style={{ background: c?.hex }} title={c?.label} />;
                  })}
                </div>
              )}
            </div>
          )}

          {phase === 2 && (
            <div className="sq-occasion-grid">
              {OCCASIONS.map(o => (
                <button key={o.id} type="button"
                  className={`sq-occ-card ${answers.occasion === o.id ? 'active' : ''}`}
                  onClick={() => set('occasion', o.id)}>
                  <span className="sq-occ-icon">{o.icon}</span>
                  <span className="sq-occ-label">{o.label}</span>
                  <span className="sq-occ-desc">{o.desc}</span>
                  {answers.occasion === o.id && <span className="sq-occ-check">✓</span>}
                </button>
              ))}
            </div>
          )}

          {phase === 3 && (
            <div className="sq-budget-grid">
              {BUDGETS.map(b => (
                <button key={b.id} type="button"
                  className={`sq-budget-card ${answers.budget === b.id ? 'active' : ''}`}
                  onClick={() => set('budget', b.id)}>
                  <span className="sq-budget-icon">{b.icon}</span>
                  <div className="sq-budget-body">
                    <span className="sq-budget-label">{b.label}</span>
                    <span className="sq-budget-range">{b.range}</span>
                    <span className="sq-budget-desc">{b.desc}</span>
                  </div>
                  {answers.budget === b.id && <span className="sq-budget-check">✓</span>}
                </button>
              ))}
            </div>
          )}

          {phase === 4 && (
            <div className="sq-comfort-wrap">
              <div className="sq-comfort-scale">
                {COMFORT.map(c => (
                  <button key={c.id} type="button"
                    className={`sq-comfort-btn ${answers.comfortLevel === c.id ? 'active' : ''}`}
                    onClick={() => set('comfortLevel', c.id)}>
                    <span className="sq-comfort-icon">{c.icon}</span>
                    <span className="sq-comfort-label">{c.label}</span>
                    <span className="sq-comfort-desc">{c.desc}</span>
                  </button>
                ))}
              </div>
              <div className="sq-comfort-axis">
                <span>Laid-back</span>
                <div className="sq-comfort-line">
                  <div className="sq-comfort-line-fill"
                    style={{ width: answers.comfortLevel ? `${((answers.comfortLevel - 1) / 4) * 100}%` : '0%' }} />
                </div>
                <span>High Fashion</span>
              </div>
            </div>
          )}

          {phase === 5 && (
            <div className="sq-insp-grid">
              {INSPIRATIONS.map(ins => (
                <button key={ins.id} type="button"
                  className={`sq-insp-card ${answers.inspiration === ins.id ? 'active' : ''}`}
                  onClick={() => set('inspiration', ins.id)}>
                  <div className="sq-insp-glow" style={{ background: ins.grad }} />
                  <span className="sq-insp-emoji">{ins.emoji}</span>
                  <span className="sq-insp-label">{ins.label}</span>
                  <span className="sq-insp-desc">{ins.desc}</span>
                  {answers.inspiration === ins.id && <span className="sq-insp-check">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Next button */}
          <div className="sq-qfooter">
            <button className="sq-btn-primary" onClick={goNext} disabled={!canNext()}>
              {phase === 5 ? 'Generate My Style Profile ✨' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="sq-center">
          <div className="sq-analyze-wrap">
            <div className="sq-analyze-rings">
              <div className="sq-ring sq-ring-1" />
              <div className="sq-ring sq-ring-2" />
              <div className="sq-ring sq-ring-3" />
              <div className="sq-analyze-core">
                <span>✦</span>
              </div>
            </div>
            <h2 className="sq-analyze-title">Analyzing Your<br />Fashion Personality</h2>
            <p className="sq-analyze-msg">{ANALYZE_MSGS[msgIdx]}</p>
            <div className="sq-analyze-bar">
              <div className="sq-analyze-fill" style={{ width: `${analyzeProgress}%` }} />
            </div>
            <span className="sq-analyze-pct">{analyzeProgress}%</span>
            <div className="sq-analyze-tags">
              {['Fashion DNA', 'Color Mapping', 'Style Match', 'AI Curation'].map((t, i) => (
                <span key={t} className="sq-analyze-tag" style={{ animationDelay: `${i * 0.3}s` }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="sq-center sq-result-wrap">
          <div className="sq-result-card">

            {/* Header */}
            <div className="sq-result-header">
              <div className="sq-result-badge">✦ Your Style DNA</div>
              <div className="sq-result-type-wrap" style={{ '--accent': profile.accent }}>
                <div className="sq-result-type-glow" />
                <h2 className="sq-result-type">{profile.type}</h2>
              </div>
              <p className="sq-result-desc">{profile.desc}</p>
            </div>

            {/* Color story */}
            <div className="sq-result-section">
              <div className="sq-result-sec-label">Your Colour Story</div>
              <div className="sq-result-colors">
                {answers.favoriteColors.length > 0
                  ? answers.favoriteColors.map(n => {
                      const c = COLORS.find(x => x.name === n);
                      return (
                        <div key={n} className="sq-result-clr" title={c?.label}>
                          <span style={{ background: c?.hex, boxShadow: c?.outline ? 'inset 0 0 0 1.5px #D1D5DB' : 'none' }} />
                          <small>{c?.label}</small>
                        </div>
                      );
                    })
                  : <span className="sq-result-empty">No colours selected</span>
                }
              </div>
            </div>

            {/* Style stats */}
            <div className="sq-result-stats">
              {[
                { label: 'Style', val: STYLE_CARDS.find(s => s.id === answers.fashionStyle)?.label || '—' },
                { label: 'Occasion', val: OCCASIONS.find(o => o.id === answers.occasion)?.label || '—' },
                { label: 'Vibe', val: INSPIRATIONS.find(i => i.id === answers.inspiration)?.label || '—' },
                { label: 'Budget', val: BUDGETS.find(b => b.id === answers.budget)?.label || '—' },
              ].map(s => (
                <div key={s.label} className="sq-result-stat">
                  <span>{s.val}</span>
                  <small>{s.label}</small>
                </div>
              ))}
            </div>

            {/* Recommended categories */}
            <div className="sq-result-section">
              <div className="sq-result-sec-label">Recommended For You</div>
              <div className="sq-result-cats">
                {profile.categories.map((c, i) => (
                  <span key={c} className="sq-result-cat" style={{ animationDelay: `${i * 0.1}s` }}>
                    ✦ {c}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA */}
            {error && <p className="sq-result-error">{error}</p>}
            <button className="sq-btn-primary sq-btn--full" disabled={saving}
              onClick={() => navigate('/dashboard')}>
              {saving ? <span className="sq-spinner" /> : 'Explore My Outfits →'}
            </button>
            <button className="sq-btn-retake" onClick={() => {
              setAnswers({ fashionStyle: null, favoriteColors: [], occasion: null, budget: null, comfortLevel: null, inspiration: null });
              setAnalyzeProgress(0); setMsgIdx(0); setPhase('intro');
            }}>
              Retake quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
