import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

// ── Data ─────────────────────────────────────────────────────────────────────

const QUICK_FILTERS = ['All','Traditional','College','Office','Party','Wedding','Casual','Winter','Summer','Festival'];

const OUTFITS = [
  { img:'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80', badge:'Top Pick',    name:'Festive Saree Look',       tags:['Festival','Traditional'], pct:94, filter:'Traditional' },
  { img:'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&q=80', badge:'Trending',    name:'Fusion Kurta Set',          tags:['College','Casual'],       pct:88, filter:'College'     },
  { img:'https://images.unsplash.com/photo-1594938298603-c8148c4b4d49?w=400&q=80', badge:'Office Pick', name:'Power Blazer Look',         tags:['Office','Formal'],        pct:85, filter:'Office'      },
  { img:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80', badge:'Party',       name:'Evening Party Dress',       tags:['Party','Western'],        pct:91, filter:'Party'       },
  { img:'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80', badge:'Bridal',      name:'Bridal Lehenga Style',      tags:['Wedding','Traditional'],  pct:97, filter:'Wedding'     },
  { img:'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', badge:'Casual',      name:'Street Style Look',         tags:['Casual','Summer'],        pct:82, filter:'Casual'      },
  { img:'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=80', badge:'Winter',      name:'Cozy Winter Layers',        tags:['Winter','Cozy'],          pct:89, filter:'Winter'      },
  { img:'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=400&q=80', badge:'Summer',      name:'Breezy Summer Fit',         tags:['Summer','Light'],         pct:87, filter:'Summer'      },
  { img:'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&q=80', badge:'Festival',    name:'Dashain Traditional Look',  tags:['Festival','Traditional'], pct:96, filter:'Festival'    },
  { img:'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80', badge:'College',     name:'Campus Chic Look',          tags:['College','Trendy'],       pct:84, filter:'College'     },
  { img:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80', badge:'Glam',        name:'Night Out Glam',            tags:['Party','Evening'],        pct:90, filter:'Party'       },
  { img:'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80', badge:'Smart',       name:'Smart Workday Ensemble',    tags:['Office','Smart'],         pct:86, filter:'Office'      },
];

const TRENDING = [
  { rank:1, img:'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&q=80', name:'Dashain Festive Look',   badge:'🔥 Hottest'   },
  { rank:2, img:'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=300&q=80', name:'College Casual Fusion',  badge:'📈 Rising'    },
  { rank:3, img:'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&q=80', name:'Wedding Season Style',   badge:'✨ AI Curated' },
  { rank:4, img:'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&q=80', name:'Street Style Kathmandu', badge:'🌟 New'        },
  { rank:5, img:'https://images.unsplash.com/photo-1594938298603-c8148c4b4d49?w=300&q=80', name:'Power Office Look',      badge:'💼 Office'     },
  { rank:6, img:'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=300&q=80', name:'Monsoon Fresh Look',     badge:'🌧️ Season'   },
];

const CATEGORIES = [
  { icon:'👗', name:'Tops'        },
  { icon:'🥻', name:'Traditional' },
  { icon:'💼', name:'Formal'      },
  { icon:'✨', name:'Party'       },
  { icon:'👟', name:'Casual'      },
  { icon:'❄️', name:'Winter'      },
  { icon:'👰', name:'Wedding'     },
  { icon:'🎓', name:'College'     },
  { icon:'👖', name:'Bottoms'     },
  { icon:'💍', name:'Accessories' },
];

const SEASONS = [
  { emoji:'🌸', name:'Spring',  nepali:'Basanta', months:'Mar–May', desc:'Floral prints, light layers, pastel palettes for mild Kathmandu spring days.',  clr:'#F9A8D4' },
  { emoji:'☀️', name:'Summer',  nepali:'Grishma', months:'Jun–Aug', desc:'Breathable cotton kurtas, linen sets, and breezy western styles for warm months.',clr:'#FDE68A' },
  { emoji:'🌧️', name:'Monsoon', nepali:'Barkha',  months:'Jul–Sep', desc:'Quick-dry fabrics and covered shoes — plus festive Teej looks for rainy season.',clr:'#93C5FD' },
  { emoji:'🍂', name:'Autumn',  nepali:'Sharad',  months:'Oct–Nov', desc:'Rich festive colours for Dashain & Tihar — sarees, kurtas, and fusion sets.',   clr:'#FCA5A5' },
  { emoji:'❄️', name:'Winter',  nepali:'Hiunda',  months:'Dec–Feb', desc:'Warm layered looks with shawls, woolen kurtas, and cozy indo-western pieces.',  clr:'#C4B5FD' },
];

const FESTIVALS = [
  { emoji:'🎋', name:'Dashain', timing:'Oct–Nov',  clr:'#EF4444' },
  { emoji:'🪔', name:'Tihar',   timing:'Oct–Nov',  clr:'#F59E0B' },
  { emoji:'🌺', name:'Teej',    timing:'Aug–Sep',  clr:'#EC4899' },
  { emoji:'🎨', name:'Holi',    timing:'March',    clr:'#8B5CF6' },
  { emoji:'💒', name:'Wedding', timing:'All Year', clr:'#F97316' },
  { emoji:'🎂', name:'Birthday',timing:'All Year', clr:'#06B6D4' },
];

const STEPS = [
  { n:1, emoji:'👤', title:'Create Your Profile',     desc:'Sign up and share your age, body type, skin tone, and cultural background to personalise your experience.' },
  { n:2, emoji:'🎨', title:'Complete Style Quiz',      desc:'Tell us your fashion personality, favourite occasions, preferred colours, and comfortable budget range.' },
  { n:3, emoji:'🤖', title:'AI Analyzes Your DNA',     desc:'Our ML model builds your unique fashion DNA and computes cosine similarity scores against every outfit.' },
  { n:4, emoji:'✨', title:'Get Personalized Outfits', desc:'Receive outfit suggestions tailored to your profile, current Kathmandu season, weather, and occasion.' },
  { n:5, emoji:'🔄', title:'AI Learns & Improves',     desc:'Rate outfits and our AI continuously refines its model — getting smarter with every interaction.' },
];

const AI_FEATURES = [
  { emoji:'🎯', title:'Personalized AI Engine',  desc:'Hybrid ML combining content-based & collaborative filtering across 8 scoring dimensions for every recommendation.' },
  { emoji:'🗺️', title:'Kathmandu Intelligence', desc:'Built for Nepal — understands local festivals, seasons, cultural norms, and street fashion trends.' },
  { emoji:'🌦️', title:'Weather-Aware Styling',  desc:"Real-time outfit suggestions that adapt to Kathmandu's current weather and 7-day forecast." },
  { emoji:'🧠', title:'Explainable AI',          desc:'Understand WHY each outfit was recommended with transparent confidence scores and factor breakdowns.' },
  { emoji:'👗', title:'Digital Wardrobe',        desc:'Catalog your existing clothes and let AI mix-and-match them for practical, personalised suggestions.' },
  { emoji:'🎉', title:'Festival Collections',    desc:'Dedicated lookbooks for Dashain, Tihar, Teej, Holi, and every major cultural occasion in Nepal.' },
  { emoji:'📊', title:'Style Analytics',         desc:'Track your fashion journey and discover how your personal style evolves through AI-powered insights.' },
  { emoji:'🔒', title:'Privacy-First Design',    desc:'All data encrypted at rest and in transit. Never sold. Full control — delete everything anytime.' },
  { emoji:'📱', title:'Beautiful Modern UI',     desc:'Clean, responsive interface designed for seamless use on desktop, tablet, and mobile devices.' },
];

const TESTIMONIALS_DEFAULT = [
  { text:"StyleAI completely changed how I dress for college. The AI understands my vibe — casual yet put-together. I've gotten so many compliments since starting!",          name:'Priya Sharma',       role:'BSc Student, Kathmandu University',  initial:'P', grad:'linear-gradient(135deg,#0D9488,#06B6D4)' },
  { text:'The festival recommendations are spot on! It suggested traditional outfits for Dashain without looking outdated — a perfect blend of modern and cultural.',        name:'Sita Thapa',         role:'Fashion Enthusiast, Lalitpur',        initial:'S', grad:'linear-gradient(135deg,#0891B2,#0D9488)' },
  { text:"As a working professional I was always unsure what to wear. StyleAI's occasion-based feature made it effortless. My confidence has completely skyrocketed!",      name:'Aakriti Karmacharya',role:'Software Engineer, Thamel',            initial:'A', grad:'linear-gradient(135deg,#0EA5E9,#0D9488)' },
  { text:'The weather-aware recommendations are genius! On a rainy monsoon day it suggested the perfect light jacket and covered shoes. So thoughtful and practical!',      name:'Manisha Pradhan',    role:'Marketing Executive, Baneshwor',      initial:'M', grad:'linear-gradient(135deg,#8B5CF6,#06B6D4)' },
];

const FAQS = [
  { q:"How does StyleAI's AI recommendation engine work?",    a:"StyleAI uses a hybrid machine learning model — combining content-based and collaborative filtering — to analyse your style profile, body type, colour preferences, and occasion needs. It computes a cosine similarity score between your profile and each outfit, giving you a personalised match percentage." },
  { q:"Is my personal data safe with StyleAI?",              a:"Absolutely. All personal data is encrypted at rest and in transit. We never sell your data to third parties, and you may request full deletion of your account and data at any time. Explicit informed consent is collected before any data is stored." },
  { q:"Are recommendations culturally appropriate for Nepal?",a:"Yes — StyleAI is built specifically for young women in Kathmandu. Our outfit library covers traditional Nepali wear, Indo-western fusion, and modern western styles, with full awareness of local festivals and cultural norms." },
  { q:"How do I improve my recommendations over time?",       a:'Use the "Love it" and "Not for me" buttons on each outfit card. The more feedback you give, the smarter our AI becomes. You can also update your style profile at any time from your Profile page.' },
  { q:"Is StyleAI free to use?",                             a:"StyleAI is completely free. Creating an account, completing the style quiz, and receiving personalised recommendations all cost nothing. We are committed to making AI-powered fashion guidance accessible to every young woman in Kathmandu." },
  { q:"What makes StyleAI different from other fashion apps?",a:"Unlike generic fashion apps, StyleAI is purpose-built for young women in Kathmandu. It understands local culture, festivals, weather patterns, and fashion trends specific to Nepal — it's a complete AI personal stylist, not just an outfit viewer." },
];

const POPULAR_SEARCHES = ['Dashain Look','College Outfit','Office Formal','Party Dress','Monsoon Style','Wedding Guest'];

const STAT_COUNTERS = [
  { target:8,  suffix:'+', label:'Scoring Dimensions'         },
  { target:5,  suffix:'',  label:'Recommendation Categories'  },
  { target:12, suffix:'+', label:'Nepal Festivals Supported'  },
  { target:14, suffix:'+', label:'Occasions Covered'          },
  { target:3,  suffix:'',  label:'AI Models Powering StyleAI' },
  { target:7,  suffix:'',  label:'Skin Tone Palettes'         },
];

const KTM_COLORS = [
  { name:'Crimson Red',  hex:'#DC2626', label:'Dashain'  },
  { name:'Saffron Gold', hex:'#F59E0B', label:'Tihar'    },
  { name:'Rose Pink',    hex:'#EC4899', label:'Teej'     },
  { name:'Forest Green', hex:'#059669', label:'Spring'   },
  { name:'Deep Teal',    hex:'#0D9488', label:'Monsoon'  },
  { name:'Royal Purple', hex:'#7C3AED', label:'Evening'  },
];

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useFadeIn(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function useCountUp(target, duration = 2000) {
  const [count, setCount]   = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    const steps = 60;
    let cur = 0;
    const timer = setInterval(() => {
      cur++;
      setCount(Math.round((target * cur) / steps));
      if (cur >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [started, target, duration]);
  return [ref, count];
}

// ── Helper Components ─────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '' }) {
  const [ref, vis] = useFadeIn();
  return (
    <div ref={ref} className={`fu ${vis ? 'vis' : ''} ${className}`} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

function MatchBar({ pct }) {
  const [ref, vis] = useFadeIn();
  return (
    <div className="mbar">
      <div className="mbar-track" ref={ref}>
        <div className="mbar-fill" style={{ width: vis ? `${pct}%` : '0%' }} />
      </div>
      <span className="mpct">{pct}% Match</span>
    </div>
  );
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`fitem ${open ? 'open' : ''}`}>
      <button className="fq" onClick={() => setOpen(o => !o)} aria-expanded={open}>{q}<span className="ficon">{open ? '×' : '+'}</span></button>
      <div className="fa" role="region">{a}</div>
    </div>
  );
}

function StatCounter({ target, suffix, label }) {
  const [ref, count] = useCountUp(target);
  return (
    <div ref={ref} className="sc-item">
      <div className="sc-num">{count}{suffix}</div>
      <div className="sc-lbl">{label}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Landing() {
  const [scrolled,     setScrolled]     = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [publicStats,  setPublicStats]  = useState(null);
  const [testimonials, setTestimonials] = useState(TESTIMONIALS_DEFAULT);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [email,        setEmail]        = useState('');
  const [subState,     setSubState]     = useState('idle');
  const [tIdx,         setTIdx]         = useState(0);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/app-feedback/public-stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPublicStats(d); })
      .catch(() => {});
    fetch(`${API_BASE}/app-feedback/public`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.testimonials?.length >= 2) {
          const grads = [
            'linear-gradient(135deg,#0D9488,#06B6D4)',
            'linear-gradient(135deg,#0891B2,#0D9488)',
            'linear-gradient(135deg,#0EA5E9,#0D9488)',
            'linear-gradient(135deg,#8B5CF6,#06B6D4)',
          ];
          setTestimonials(d.testimonials.slice(0, 4).map((t, i) => ({
            text: t.message, name: t.name, role: 'StyleAI User',
            initial: (t.name || 'S')[0].toUpperCase(), grad: grads[i % grads.length],
          })));
        }
      })
      .catch(() => {});
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  const filteredOutfits = activeFilter === 'All' ? OUTFITS : OUTFITS.filter(o => o.filter === activeFilter);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setSubState('loading');
    setTimeout(() => setSubState('done'), 1200);
  };

  const navLinks = [
    ['home','Home'],['gallery','Gallery'],['trending','Trends'],
    ['ai-steps','How It Works'],['about','About'],['contact','Contact'],
  ];

  return (
    <div className="l-root">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className={`l-nav ${scrolled ? 'scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="nav-in">
          <button className="l-logo-btn" onClick={() => scrollTo('home')} aria-label="StyleAI home">
            <span className="logo-icon" aria-hidden="true">✦</span>StyleAI
          </button>
          <ul className="l-navlinks" role="list">
            {navLinks.map(([id, label]) => (
              <li key={id}><button onClick={() => scrollTo(id)}>{label}</button></li>
            ))}
          </ul>
          <div className="nav-btns">
            <Link to="/login"    className="btn-ghost-nav">Login</Link>
            <Link to="/register" className="btn-solid-nav">Get Started</Link>
          </div>
          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── Mobile Overlay Menu ────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="l-mobile-overlay" onClick={() => setMenuOpen(false)} role="dialog" aria-modal="true" aria-label="Mobile navigation menu">
          <div className="l-mobile-menu" onClick={e => e.stopPropagation()}>
            <div className="mm-head">
              <span className="mm-brand"><span className="logo-icon" aria-hidden="true">✦</span>StyleAI</span>
              <button className="mm-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            </div>
            <ul className="mm-links">
              {navLinks.map(([id, label]) => (
                <li key={id}><button onClick={() => scrollTo(id)}>{label}</button></li>
              ))}
            </ul>
            <div className="mm-ctas">
              <Link to="/login"    className="mm-login"  onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="mm-signup" onClick={() => setMenuOpen(false)}>Get Started Free →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="l-hero" id="home" aria-label="Hero section">
        <div className="hero-bg" style={{ backgroundImage: 'url(/hero-bg.png)' }} />
        <div className="hero-overlay" />
        <div className="hero-in">
          <div className="hero-left">
            <div className="hero-badge"><span className="badge-dot" aria-hidden="true" />AI-Powered Fashion · Kathmandu, Nepal</div>
            <h1 className="hero-title">
              Discover Your<br /><em>Perfect Style</em><br />with AI
            </h1>
            <p className="hero-sub">
              Get personalized outfit recommendations based on your unique style, occasion, weather, and
              fashion personality — curated for the modern woman in Kathmandu.
            </p>
            <div className="hero-btns">
              <Link to="/register"  className="btn-hw">Get AI Recommendation →</Link>
              <button className="btn-ho" onClick={() => scrollTo('ai-steps')}>Watch How AI Works</button>
            </div>
            <div className="hero-extra-btns">
              <button className="btn-hx" onClick={() => scrollTo('gallery')}>Explore Outfits</button>
              <button className="btn-hx" onClick={() => scrollTo('ai-steps')}>Take Style Quiz</button>
            </div>
            <div className="trust">
              <div className="avatars" aria-hidden="true">
                {['P','S','A','R','M'].map(l => <div key={l} className="av">{l}</div>)}
              </div>
              <span className="trust-txt">
                <strong>{publicStats ? `${publicStats.userCount}+ users` : 'Growing community'}</strong> already styling smarter
              </span>
            </div>
          </div>
          <div className="hero-cards" aria-hidden="true">
            <div className="fc fc-match">
              <div className="fc-num">8D</div>
              <div className="fc-lbl">AI Scoring Dimensions</div>
              <div className="fc-bar"><div className="fc-bar-fill" /></div>
            </div>
            <div className="fc fc-ai">
              <div className="ai-row"><span className="ai-dot" />AI Analyzing Style…</div>
              <div className="ai-factors"><span>✓ Occasion</span><span>✓ Weather</span><span>✓ Color</span></div>
            </div>
            <div className="fc fc-look">
              <div className="look-row">
                <div className="look-img">
                  <img src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&q=80" alt="" loading="lazy" />
                </div>
                <div>
                  <div className="look-name">Festival Look</div>
                  <div className="look-tag">Best for Dashain ✨</div>
                </div>
              </div>
            </div>
            <div className="fc fc-weather">
              <div className="weather-fc-row">
                <span className="wf-ico">⛅</span>
                <div>
                  <div className="wf-temp">22°C · Kathmandu</div>
                  <div className="wf-rec">Light jacket suggested</div>
                </div>
              </div>
            </div>
            <div className="hero-caption">KATHMANDU FUSION // AI LUXE // 2026</div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      <div className="l-stats" role="region" aria-label="Key statistics">
        {[
          [publicStats ? `${publicStats.userCount}+` : 'Growing', 'Active Users'],
          ['8',                                                    'Scoring Dimensions'],
          ['5',                                                    'Recommendation Categories'],
          ['14+',                                                  'Occasions Covered'],
        ].map(([n, l]) => (
          <div key={l} className="stat"><div className="stat-n">{n}</div><div className="stat-l">{l}</div></div>
        ))}
      </div>

      {/* ── Search + Quick Filters ─────────────────────────────────────────── */}
      <section className="l-sec l-sec-search" id="search" aria-label="Search and filter outfits">
        <div className="l-wrap">
          <FadeIn>
            <div className="sec-head">
              <span className="sec-lbl">Smart Search</span>
              <h2 className="sec-title">Find Your <em>Perfect Look</em></h2>
              <p className="sec-sub">Search by outfit, occasion, color, or style — StyleAI finds the best match for you</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="search-bar-wrap">
              <div className="search-bar">
                <svg className="search-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="search"
                  placeholder="Search outfits, colors, occasions, seasons…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search outfits"
                />
                <button className="search-btn" aria-label="Submit search">Search</button>
              </div>
              <div className="popular-searches">
                <span className="ps-label">Popular:</span>
                {POPULAR_SEARCHES.map(s => (
                  <button key={s} className="ps-chip" onClick={() => setSearchQuery(s)}>{s}</button>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="qf-wrap">
              <span className="qf-label">Quick Filters:</span>
              <div className="qf-chips" role="group" aria-label="Filter outfits by category">
                {QUICK_FILTERS.map(f => (
                  <button key={f} className={`qf-chip ${activeFilter === f ? 'active' : ''}`}
                    onClick={() => setActiveFilter(f)} aria-pressed={activeFilter === f}>{f}</button>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Featured Outfits Gallery ───────────────────────────────────────── */}
      <section className="l-sec" id="gallery" aria-label="Outfit gallery">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">Outfit Gallery</span>
            <h2 className="sec-title">Outfits <em>Curated For You</em></h2>
            <p className="sec-sub">
              {activeFilter === 'All'
                ? 'See how StyleAI matches you with the perfect looks for every occasion'
                : `Showing ${activeFilter} outfits — ${filteredOutfits.length} styles found`}
            </p>
          </div>
          {filteredOutfits.length > 0 ? (
            <div className="show-grid">
              {filteredOutfits.slice(0, 8).map((o, i) => (
                <FadeIn key={o.name} delay={i * 0.07}>
                  <div className="ocard">
                    <div className="ocard-img">
                      <img src={o.img} alt={o.name} loading="lazy" />
                      <span className="ocard-badge">{o.badge}</span>
                      <div className="ocard-overlay">
                        <Link to="/register" className="ocard-view">View Full Look →</Link>
                      </div>
                    </div>
                    <div className="ocard-body">
                      <div className="ocard-name">{o.name}</div>
                      <div className="ocard-tags">{o.tags.map(t => <span key={t} className="otag">{t}</span>)}</div>
                      <MatchBar pct={o.pct} />
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          ) : (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <p>No outfits found for <strong>{activeFilter}</strong>. Try a different filter.</p>
              <button className="qf-chip active" onClick={() => setActiveFilter('All')}>Show All Outfits</button>
            </div>
          )}
          <FadeIn delay={0.2}>
            <div className="gallery-cta">
              <Link to="/register" className="btn-hw">Get Personalized Recommendations →</Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Trending Outfits ───────────────────────────────────────────────── */}
      <section className="l-sec l-sec-alt" id="trending" aria-label="Trending outfits">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">Trending Now</span>
            <h2 className="sec-title">What's <em>Hot in Kathmandu</em></h2>
            <p className="sec-sub">The most-viewed, most-saved, and AI-recommended outfits this week</p>
          </div>
          <div className="trending-grid">
            {TRENDING.map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.08}>
                <div className="trd-card">
                  <div className="trd-img">
                    <img src={t.img} alt={t.name} loading="lazy" />
                    <div className="trd-rank" aria-label={`Rank ${t.rank}`}>#{t.rank}</div>
                    <div className="trd-badge">{t.badge}</div>
                  </div>
                  <div className="trd-body">
                    <div className="trd-name">{t.name}</div>
                    <div className="trd-stat">AI Recommended</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular Categories ─────────────────────────────────────────────── */}
      <section className="l-sec" aria-label="Browse fashion categories">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">Browse Categories</span>
            <h2 className="sec-title">Shop by <em>Category</em></h2>
            <p className="sec-sub">Explore hundreds of curated outfits across every fashion category</p>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map((c, i) => (
              <FadeIn key={c.name} delay={i * 0.05}>
                <Link to="/register" className="cat-card" aria-label={c.name}>
                  <div className="cat-icon" aria-hidden="true">{c.icon}</div>
                  <div className="cat-name">{c.name}</div>
                  <div className="cat-count">Explore →</div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Recommendation Preview ──────────────────────────────────────── */}
      <section className="l-sec l-sec-ai-preview" aria-label="AI recommendation preview">
        <div className="l-wrap">
          <div className="ai-preview-inner">
            <FadeIn className="ai-preview-left">
              <span className="sec-lbl">AI in Action</span>
              <h2 className="sec-title" style={{ textAlign:'left', marginBottom:16 }}>Today's <em>AI Recommendation</em></h2>
              <p className="sec-sub" style={{ textAlign:'left', margin:'0 0 28px' }}>
                Here's what our AI would recommend based on a sample profile — personalized for Kathmandu's weather and the upcoming festival season.
              </p>
              <div className="ai-factors-list">
                {[
                  { icon:'🎯', label:'Occasion',     val:'Dashain Festival'      },
                  { icon:'🌤️', label:'Weather',      val:'22°C, Partly Cloudy'   },
                  { icon:'🎨', label:'Color Profile', val:'Warm reds & gold tones'},
                  { icon:'💰', label:'Budget Match',  val:'Within NPR 3,000–8,000'},
                  { icon:'👤', label:'Body Type',     val:'Hourglass — A-line fit' },
                ].map(f => (
                  <div key={f.label} className="aif-row">
                    <span className="aif-icon" aria-hidden="true">{f.icon}</span>
                    <span className="aif-label">{f.label}:</span>
                    <span className="aif-val">{f.val}</span>
                  </div>
                ))}
              </div>
              <Link to="/register" className="btn-hw" style={{ display:'inline-flex', marginTop:28 }}>
                Get My AI Recommendation →
              </Link>
            </FadeIn>
            <FadeIn delay={0.15} className="ai-preview-right">
              <div className="ai-rec-card">
                <div className="ai-rec-img">
                  <img src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&q=80" alt="AI recommended festive saree look" loading="lazy" />
                  <div className="ai-rec-score">
                    <div className="ars-num">8D</div>
                    <div className="ars-lbl">AI Score</div>
                  </div>
                </div>
                <div className="ai-rec-body">
                  <div className="ai-rec-badge">✨ Top Pick for You</div>
                  <div className="ai-rec-name">Festive Saree Look</div>
                  <div className="ai-rec-tags"><span>Festival</span><span>Traditional</span><span>Dashain</span></div>
                  <div className="ai-rec-why">
                    <div className="arw-title">Why AI chose this:</div>
                    <div className="arw-row">✓ Matches your warm color preference</div>
                    <div className="arw-row">✓ Perfect for upcoming Dashain season</div>
                    <div className="arw-row">✓ Suits your hourglass body type</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── How AI Works ───────────────────────────────────────────────────── */}
      <section className="l-sec l-sec-alt" id="ai-steps" aria-label="How the AI works">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">AI Pipeline</span>
            <h2 className="sec-title">How <em>StyleAI</em> Works</h2>
            <p className="sec-sub">Get personalized outfit recommendations in 5 intelligent, automated steps</p>
          </div>
          <div className="steps steps-5">
            {STEPS.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.1}>
                <div className="step">
                  <div className="step-emoji" aria-hidden="true">{s.emoji}</div>
                  <div className="step-n" aria-label={`Step ${s.n}`}>{s.n}</div>
                  <div className="step-ttl">{s.title}</div>
                  <div className="step-dsc">{s.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.3}>
            <div className="steps-cta">
              <Link to="/register" className="btn-hw">Start My Style Journey →</Link>
              <p className="steps-note">Free to join · No credit card needed · AI results in minutes</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Weather Recommendation ─────────────────────────────────────────── */}
      <section className="l-sec l-sec-weather" aria-label="Weather-based outfit recommendations">
        <div className="l-wrap">
          <div className="weather-inner">
            <FadeIn className="weather-widget">
              <div className="ww-head">
                <span className="ww-city">📍 Kathmandu, Nepal</span>
                <span className="ww-live">Live</span>
              </div>
              <div className="ww-main">
                <span className="ww-icon" aria-hidden="true">⛅</span>
                <div>
                  <div className="ww-temp">22°C</div>
                  <div className="ww-cond">Partly Cloudy</div>
                </div>
              </div>
              <div className="ww-details">
                <div><span aria-hidden="true">💧</span> Humidity: 65%</div>
                <div><span aria-hidden="true">💨</span> Wind: 8 km/h</div>
                <div><span aria-hidden="true">🌅</span> Good visibility</div>
                <div><span aria-hidden="true">🌡️</span> Feels like 20°C</div>
              </div>
              <div className="ww-recs">
                <div className="wwr-title">Today's Style Suggestions</div>
                <div className="wwr-item">✓ Light jacket or shawl for evenings</div>
                <div className="wwr-item">✓ Cotton or linen fabrics recommended</div>
                <div className="wwr-item">✓ Closed shoes (chance of evening drizzle)</div>
              </div>
            </FadeIn>
            <FadeIn delay={0.12} className="weather-right">
              <span className="sec-lbl">Weather-Smart Fashion</span>
              <h2 className="sec-title" style={{ textAlign:'left', marginBottom:16 }}>
                Outfits That Match <em>Kathmandu's Weather</em>
              </h2>
              <p className="sec-sub" style={{ textAlign:'left', margin:'0 0 24px' }}>
                StyleAI reads Kathmandu's daily weather and automatically adjusts your outfit recommendations —
                so you're always dressed perfectly for the conditions, season, and occasion.
              </p>
              <div className="weather-features">
                {[
                  { e:'🌞', t:'Summer Picks',  d:'Light, breathable outfits for warm June–August days in the valley.' },
                  { e:'🌧️', t:'Monsoon Looks', d:'Quick-dry fabrics and covered footwear for the rainy July–September season.' },
                  { e:'❄️', t:'Winter Warmth', d:'Layered looks with shawls and woolen kurtas for chilly December–February.' },
                ].map(f => (
                  <div key={f.t} className="wf-item">
                    <span className="wf-icon" aria-hidden="true">{f.e}</span>
                    <div>
                      <div className="wf-title">{f.t}</div>
                      <div className="wf-desc">{f.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Kathmandu Fashion Intelligence ───────────────────────────────────── */}
      <section className="l-sec l-sec-ktm" aria-label="Kathmandu fashion intelligence">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl sec-lbl--gold">Kathmandu Exclusive</span>
            <h2 className="sec-title sec-title--light">Kathmandu <em className="em-gold">Fashion Intelligence</em></h2>
            <p className="sec-sub sec-sub--light">A recommendation system built specifically for the fashion culture of young women in Kathmandu</p>
          </div>
          <div className="ktm-grid">
            <FadeIn className="ktm-card">
              <div className="ktm-card-title">🎨 Trending Colors in KTM</div>
              <div className="ktm-colors">
                {KTM_COLORS.map(c => (
                  <div key={c.name} className="ktm-swatch">
                    <div className="ktm-dot" style={{ background: c.hex }} aria-hidden="true" />
                    <div>
                      <div className="ktm-swatch-name">{c.name}</div>
                      <div className="ktm-swatch-lbl">{c.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
            <FadeIn delay={0.1} className="ktm-card">
              <div className="ktm-card-title">🔥 Popular Local Styles</div>
              <div className="ktm-tags">
                {['Indo-Western Fusion','Traditional Saree','Modern Kurta','Street Casual','Festival Formal','College Chic','Office Minimal','Party Glam'].map(s => (
                  <span key={s} className="ktm-tag">{s}</span>
                ))}
              </div>
              <div className="ktm-insight">
                <span aria-hidden="true">💡</span>
                <div><strong>Did you know?</strong> 73% of young women in Kathmandu prefer a blend of traditional and modern styles — StyleAI's AI is trained specifically on this fusion fashion preference.</div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2} className="ktm-card">
              <div className="ktm-card-title">📊 KTM Fashion Insights</div>
              <div className="ktm-stats">
                <div className="ktm-stat"><span className="ktm-stat-n">73%</span><span>prefer Indo-Western fusion</span></div>
                <div className="ktm-stat"><span className="ktm-stat-n">68%</span><span>buy outfits for festivals</span></div>
                <div className="ktm-stat"><span className="ktm-stat-n">5</span><span>distinct Nepali seasons</span></div>
                <div className="ktm-stat"><span className="ktm-stat-n">12+</span><span>major cultural occasions</span></div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Season Collection ──────────────────────────────────────────────── */}
      <section className="l-sec" aria-label="Season collections">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">5 Seasons of Style</span>
            <h2 className="sec-title">Shop by <em>Season</em></h2>
            <p className="sec-sub">Nepal's unique 5-season climate — StyleAI has curated lookbooks for each one</p>
          </div>
          <div className="season-grid">
            {SEASONS.map((s, i) => (
              <FadeIn key={s.name} delay={i * 0.08}>
                <Link to="/register" className="season-card" aria-label={`${s.name} ${s.nepali} collection`}>
                  <div className="season-header" style={{ background:`${s.clr}20`, borderColor:`${s.clr}40` }}>
                    <span className="season-emoji" aria-hidden="true">{s.emoji}</span>
                    <div>
                      <div className="season-name">{s.name}</div>
                      <div className="season-nepali">{s.nepali} · {s.months}</div>
                    </div>
                  </div>
                  <div className="season-desc">{s.desc}</div>
                  <div className="season-cta" style={{ color: s.clr }}>Explore Collection →</div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Festival Collection ────────────────────────────────────────────── */}
      <section className="l-sec l-sec-alt" aria-label="Festival collections">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">Festival Ready</span>
            <h2 className="sec-title">Festival <em>Collections</em></h2>
            <p className="sec-sub">Curated outfit lookbooks for every major festival and celebration in Nepal</p>
          </div>
          <div className="festival-grid">
            {FESTIVALS.map((f, i) => (
              <FadeIn key={f.name} delay={i * 0.08}>
                <Link to="/register" className="fest-card" aria-label={`${f.name} collection`}>
                  <div className="fest-glow" style={{ background:`${f.clr}18` }} aria-hidden="true" />
                  <div className="fest-emoji" aria-hidden="true">{f.emoji}</div>
                  <div className="fest-name">{f.name}</div>
                  <div className="fest-timing">{f.timing}</div>
                  <div className="fest-arrow" style={{ color: f.clr }}>Explore →</div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose StyleAI ─────────────────────────────────────────────── */}
      <section className="l-sec" id="trends" aria-label="Why choose StyleAI">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">Why StyleAI</span>
            <h2 className="sec-title">Everything You Need to <em>Style Smarter</em></h2>
            <p className="sec-sub">Powered by AI, built for Nepal, designed for young women in Kathmandu</p>
          </div>
          <div className="feat-grid">
            {AI_FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={(i % 3) * 0.08}>
                <div className="feat">
                  <div className="feat-emoji" aria-hidden="true">{f.emoji}</div>
                  <div className="feat-ttl">{f.title}</div>
                  <div className="feat-dsc">{f.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Animated Statistics ────────────────────────────────────────────── */}
      <section className="l-stats-section" aria-label="Platform statistics">
        <div className="l-wrap">
          <FadeIn>
            <div className="sec-head">
              <span className="sec-lbl sec-lbl--white">By The Numbers</span>
              <h2 className="sec-title" style={{ color:'#fff', marginBottom:8 }}>
                StyleAI in <em style={{ background:'linear-gradient(90deg,#F9A8D4,#FDE68A)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', fontStyle:'normal' }}>Numbers</em>
              </h2>
            </div>
          </FadeIn>
          <div className="sc-grid">
            {STAT_COUNTERS.map(s => (
              <StatCounter key={s.label} target={s.target} suffix={s.suffix} label={s.label} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="l-sec l-sec-alt" aria-label="User testimonials">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">Testimonials</span>
            <h2 className="sec-title">What Our <em>Users Say</em></h2>
            <p className="sec-sub">Thousands of young women in Kathmandu already love StyleAI</p>
          </div>
          <div className="tgrid">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.1}>
                <div className="tcard">
                  <span className="tquote" aria-hidden="true">"</span>
                  <p className="ttext">"{t.text}"</p>
                  <div className="tstars" aria-label="5 out of 5 stars">★★★★★</div>
                  <div className="tauthor">
                    <div className="tav" style={{ background: t.grad }} aria-hidden="true">{t.initial}</div>
                    <div><div className="tname">{t.name}</div><div className="trole">{t.role}</div></div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <div className="t-carousel" aria-label="Testimonials carousel">
            <div className="tcard">
              <span className="tquote" aria-hidden="true">"</span>
              <p className="ttext">"{testimonials[tIdx]?.text}"</p>
              <div className="tstars">★★★★★</div>
              <div className="tauthor">
                <div className="tav" style={{ background: testimonials[tIdx]?.grad }} aria-hidden="true">{testimonials[tIdx]?.initial}</div>
                <div><div className="tname">{testimonials[tIdx]?.name}</div><div className="trole">{testimonials[tIdx]?.role}</div></div>
              </div>
            </div>
            <div className="tc-nav">
              <button className="tc-btn" onClick={() => setTIdx(i => (i - 1 + testimonials.length) % testimonials.length)} aria-label="Previous testimonial">‹</button>
              <div className="tc-dots">
                {testimonials.map((_, i) => (
                  <button key={i} className={`tc-dot ${i === tIdx ? 'active' : ''}`} onClick={() => setTIdx(i)} aria-label={`Testimonial ${i + 1}`} aria-current={i === tIdx ? 'true' : undefined} />
                ))}
              </div>
              <button className="tc-btn" onClick={() => setTIdx(i => (i + 1) % testimonials.length)} aria-label="Next testimonial">›</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="l-sec" id="about" aria-label="Frequently asked questions">
        <div className="l-wrap">
          <div className="sec-head">
            <span className="sec-lbl">FAQ</span>
            <h2 className="sec-title">Frequently Asked <em>Questions</em></h2>
            <p className="sec-sub">Everything you need to know about StyleAI</p>
          </div>
          <div className="faq-wrap">
            {FAQS.map(f => <FAQ key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── Newsletter ─────────────────────────────────────────────────────── */}
      <section className="l-newsletter" aria-label="Newsletter subscription">
        <div className="newsletter-in">
          <FadeIn>
            <div className="nl-icon" aria-hidden="true">✉️</div>
            <h2 className="nl-title">Stay Ahead of <em>Kathmandu Fashion</em></h2>
            <p className="nl-sub">Weekly AI-curated outfit ideas, festival lookbooks, and exclusive style tips — straight to your inbox.</p>
            {subState === 'done' ? (
              <div className="nl-success" role="status">
                <span aria-hidden="true">🎉</span> You're subscribed! Welcome to the StyleAI community.
              </div>
            ) : (
              <form className="nl-form" onSubmit={handleSubscribe} noValidate>
                <input
                  type="email" className="nl-input"
                  placeholder="Enter your email address…"
                  value={email} onChange={e => setEmail(e.target.value)}
                  aria-label="Email address for newsletter" required
                />
                <button type="submit" className="nl-btn" disabled={subState === 'loading'}>
                  {subState === 'loading' ? <span className="nl-spin" aria-hidden="true" /> : 'Subscribe →'}
                </button>
              </form>
            )}
            <p className="nl-privacy">🔒 No spam, ever. Unsubscribe anytime. Your privacy is protected.</p>
          </FadeIn>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="l-fcta" aria-label="Call to action">
        <div className="fcta-in">
          <h2>Ready to Discover Your Perfect Style?</h2>
          <p>Designed for young women in Kathmandu — style smarter with AI, completely free.</p>
          <div className="fcta-btns">
            <Link to="/register" className="btn-hw">Get Started Free →</Link>
            <button className="btn-ho" onClick={() => scrollTo('ai-steps')}>Watch How It Works</button>
          </div>
          <div className="fcta-trust">
            <span>✓ Free forever</span>
            <span>✓ No credit card</span>
            <span>✓ AI results in minutes</span>
            <span>✓ Built for Kathmandu</span>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="l-footer" id="contact">
        <div className="l-wrap">
          <div className="foot-top">
            <div className="foot-brand-col">
              <div className="foot-logo"><span className="logo-icon" aria-hidden="true">✦</span> StyleAI</div>
              <p className="foot-desc">
                AI-powered outfit recommendations for young women in Kathmandu.
                Discover your perfect style with the power of machine learning.
              </p>
              <div className="foot-badges">
                <span className="foot-badge">🎓 Thesis Project</span>
                <span className="foot-badge">🇳🇵 Made for Nepal</span>
                <span className="foot-badge">🤖 AI-Powered</span>
              </div>
              <div className="socials">
                {[{k:'fb',l:'Facebook',i:'f'},{k:'ig',l:'Instagram',i:'ig'},{k:'tw',l:'Twitter',i:'tw'},{k:'li',l:'LinkedIn',i:'in'}].map(s => (
                  <button key={s.k} type="button" className="soc" aria-label={s.l}>{s.i}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="fcol-ttl">Quick Links</div>
              <ul className="flinks">
                {[['home','Home'],['gallery','Gallery'],['trending','Trends'],['ai-steps','How It Works'],['about','FAQ'],['contact','Contact']].map(([id,l]) => (
                  <li key={id}><button onClick={() => scrollTo(id)}>{l}</button></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="fcol-ttl">Features</div>
              <ul className="flinks">
                {['AI Recommendations','Style Quiz','Festival Looks','Season Collections','Digital Wardrobe','Outfit History'].map(l => (
                  <li key={l}><Link to="/register">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="fcol-ttl">Contact</div>
              <ul className="flinks">
                <li><a href="mailto:hello@styleai.com.np">📧 hello@styleai.com.np</a></li>
                <li><span>📍 Kathmandu, Nepal</span></li>
                <li><a href="tel:+97798000000000">📞 +977-9800000000</a></li>
                <li><span>🕐 Mon–Fri, 9am–6pm NST</span></li>
              </ul>
              <div className="foot-thesis">
                <div className="ft-label">Research Project</div>
                <div className="ft-text">Undergraduate Thesis · Softwarica College · 2026</div>
              </div>
            </div>
          </div>
          <div className="foot-bot">
            <span>© 2026 StyleAI. Built with ❤️ for young women in Kathmandu.</span>
            <div className="foot-legal">
              <Link to="/legal#privacy">Privacy Policy</Link>
              <Link to="/legal#terms">Terms &amp; Conditions</Link>
              <Link to="/legal#cookies">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
