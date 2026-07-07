import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AIAssistant.css';

const QUICK_PROMPTS = [
  { label: 'What should I wear today?',                  icon: '→', cat: 'Daily' },
  { label: 'Build an outfit from my wardrobe',           icon: '→', cat: 'Daily' },
  { label: 'Suggest an outfit for college',              icon: '→', cat: 'Occasion' },
  { label: 'Office and work look recommendations',       icon: '→', cat: 'Occasion' },
  { label: 'Outfit guidance for a wedding',              icon: '→', cat: 'Occasion' },
  { label: 'How to dress for Dashain festival',          icon: '→', cat: 'Festival' },
  { label: 'What to pack for a hill station trip',       icon: '→', cat: 'Travel' },
  { label: 'What colours pair well with black trousers', icon: '→', cat: 'Style' },
  { label: 'Colour coordination from my wardrobe',       icon: '→', cat: 'Style' },
  { label: 'Best outfits for Kathmandu monsoon',         icon: '→', cat: 'Weather' },
  { label: 'Wardrobe essentials for Kathmandu',          icon: '→', cat: 'Shopping' },
  { label: 'How to style my existing wardrobe better',   icon: '→', cat: 'Style' },
];

const Ico = {
  sparkle: (sz = 20, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={c} stroke="none"/>
    </svg>
  ),
  send: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  plus: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  trash: (sz = 15, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
  menu: (sz = 20, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  close: (sz = 18, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  edit: (sz = 14, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  copy: (sz = 14, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  download: (sz = 14, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  search: (sz = 15, c = 'currentColor') => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
};

function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d} days ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function parseSuggestions(content) {
  if (!content) return { text: content, suggestions: [] };
  const match = content.match(/\nSUGGESTIONS:\[([^\]]*)\]\s*$/);
  if (!match) return { text: content, suggestions: [] };
  const clean = content.slice(0, content.length - match[0].length).trim();
  const raw   = match[1];
  const suggestions = [];
  const re = /"([^"]+)"/g;
  let m;
  while ((m = re.exec(raw)) !== null) suggestions.push(m[1]);
  return { text: clean, suggestions: suggestions.slice(0, 3) };
}

function renderInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*')  && p.endsWith('*'))  return <em     key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith('`')  && p.endsWith('`'))  return <code   key={i} className="ai-inline-code">{p.slice(1, -1)}</code>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

function renderMessage(text) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/);

  return blocks.map((block, bi) => {
    const lines = block.split('\n');

    if (/^#{1,3} /.test(lines[0])) {
      const lvl = lines[0].match(/^(#{1,3})/)[1].length;
      const content = lines[0].replace(/^#{1,3} /, '');
      const Tag = `h${Math.min(lvl + 2, 5)}`;
      return <Tag key={bi} className="ai-msg-h">{renderInline(content)}</Tag>;
    }

    if (lines.some(l => /^[-•*] /.test(l))) {
      const beforeItems = lines.filter(l => !/^[-•*] /.test(l)).join(' ').trim();
      const items       = lines.filter(l => /^[-•*] /.test(l)).map(l => l.replace(/^[-•*] /, ''));
      return (
        <div key={bi}>
          {beforeItems && <p className="ai-msg-p">{renderInline(beforeItems)}</p>}
          <ul className="ai-msg-ul">
            {items.map((it, ii) => <li key={ii}>{renderInline(it)}</li>)}
          </ul>
        </div>
      );
    }

    if (lines.some(l => /^\d+\. /.test(l))) {
      const items = lines.filter(l => /^\d+\. /.test(l)).map(l => l.replace(/^\d+\. /, ''));
      return (
        <ol key={bi} className="ai-msg-ol">
          {items.map((it, ii) => <li key={ii}>{renderInline(it)}</li>)}
        </ol>
      );
    }

    return (
      <p key={bi} className="ai-msg-p">
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {renderInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function TypingDots() {
  return (
    <div className="ai-typing">
      <span /><span /><span />
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="ai-overlay" onClick={onCancel}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <p className="ai-modal-msg">{message}</p>
        <div className="ai-modal-btns">
          <button className="ai-btn ai-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="ai-btn ai-btn--danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function AIAssistant({ initialPrompt, onPromptConsumed }) {
  const { user }                             = useAuth();
  const firstName                            = user?.name?.split(' ')[0] || 'there';
  const userInitial                          = user?.name?.[0]?.toUpperCase() || 'U';

  const pendingInitialPrompt = useRef(initialPrompt || null);

  const [conversations,  setConversations]   = useState([]);
  const [activeConvId,   setActiveConvId]    = useState(null);
  const [messages,       setMessages]        = useState([]);
  const [suggestions,    setSuggestions]     = useState({});
  const [input,          setInput]           = useState('');
  const [sending,        setSending]         = useState(false);
  const [loadingConvs,   setLoadingConvs]    = useState(true);
  const [loadingMsgs,    setLoadingMsgs]     = useState(false);
  const [showSidebar,    setShowSidebar]     = useState(true);
  const [deleteTarget,   setDeleteTarget]    = useState(null);
  const [editingTitle,   setEditingTitle]    = useState(null);
  const [titleDraft,     setTitleDraft]      = useState('');
  const [toast,          setToast]           = useState(null);
  const [copiedId,       setCopiedId]        = useState(null);
  const [providerInfo,   setProviderInfo]    = useState(null);
  const [searchQuery,    setSearchQuery]     = useState('');
  const [searchResults,  setSearchResults]   = useState(null);
  const [searching,      setSearching]       = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const titleInputRef  = useRef(null);
  const toastTimer     = useRef(null);
  const searchTimer    = useRef(null);

  const MAX_CHARS = 2000;
  const charCount  = input.length;
  const charNear   = charCount > MAX_CHARS * 0.85;

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const scrollBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const { data } = await api.get('/ai/conversations');
      setConversations(data.conversations || []);
    } catch {
      showToast('Failed to load conversations', 'error');
    } finally {
      setLoadingConvs(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadConversations();
    api.get('/ai/provider').then(({ data }) => setProviderInfo(data)).catch(() => {});
  }, [loadConversations]);

  // Auto-send an initial prompt (e.g. from outfit category cards on Dashboard)
  useEffect(() => {
    if (!loadingConvs && pendingInitialPrompt.current) {
      const prompt = pendingInitialPrompt.current;
      pendingInitialPrompt.current = null;
      onPromptConsumed?.();
      setTimeout(() => sendMessage(prompt), 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingConvs]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/ai/conversations/search', { params: { q: searchQuery } });
        setSearchResults(data.conversations || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 320);
  }, [searchQuery]);

  const openConversation = useCallback(async (convId) => {
    if (convId === activeConvId) return;
    setLoadingMsgs(true);
    setActiveConvId(convId);
    setMessages([]);
    setSuggestions({});
    try {
      const { data } = await api.get(`/ai/conversations/${convId}`);
      setMessages(data.conversation.messages || []);
      setTimeout(() => scrollBottom(false), 50);
    } catch {
      showToast('Failed to load conversation', 'error');
    } finally {
      setLoadingMsgs(false);
    }
  }, [activeConvId, scrollBottom, showToast]);

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setSuggestions({});
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setSending(true);

    const userTs  = new Date().toISOString();
    const userMsg = { role: 'user', content: msg, _id: `tmp-${Date.now()}`, createdAt: userTs };
    const thinkId = `think-${Date.now()}`;
    const thinkMsg = { role: 'assistant', content: '__typing__', _id: thinkId };
    setMessages(prev => [...prev, userMsg, thinkMsg]);

    try {
      const { data } = await api.post('/ai/chat', {
        message: msg,
        conversationId: activeConvId || undefined,
      });

      const { text: cleanText, suggestions: suggs } = parseSuggestions(data.message);
      const resId = `res-${Date.now()}`;
      const resTs = new Date().toISOString();

      setMessages(prev => [
        ...prev.filter(m => !m._id.startsWith('think-')),
        { role: 'assistant', content: cleanText, _id: resId, createdAt: resTs },
      ]);

      if (suggs.length > 0) {
        setSuggestions(prev => ({ ...prev, [resId]: suggs }));
      }

      if (!activeConvId || activeConvId !== data.conversationId) {
        setActiveConvId(data.conversationId);
        loadConversations();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Something went wrong. Please try again.';
      setMessages(prev => [
        ...prev.filter(m => !m._id.startsWith('think-')),
        { role: 'assistant', content: errMsg, _id: `err-${Date.now()}`, isError: true, createdAt: new Date().toISOString() },
      ]);
      showToast(errMsg, 'error');
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, sending, activeConvId, loadConversations, showToast]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    if (e.target.value.length > MAX_CHARS) return;
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  const confirmDelete = async () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.delete(`/ai/conversations/${id}`);
      if (activeConvId === id) { setActiveConvId(null); setMessages([]); setSuggestions({}); }
      setConversations(prev => prev.filter(c => c._id !== id));
      showToast('Conversation deleted', 'success');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const startEdit = (conv, e) => {
    e.stopPropagation();
    setEditingTitle(conv._id);
    setTitleDraft(conv.title);
    setTimeout(() => titleInputRef.current?.select(), 50);
  };

  const saveTitle = async (convId) => {
    if (!titleDraft.trim() || titleDraft === conversations.find(c => c._id === convId)?.title) {
      setEditingTitle(null);
      return;
    }
    try {
      await api.patch(`/ai/conversations/${convId}/title`, { title: titleDraft });
      setConversations(prev => prev.map(c => c._id === convId ? { ...c, title: titleDraft.trim() } : c));
    } catch { showToast('Failed to rename', 'error'); }
    setEditingTitle(null);
  };

  const copyMessage = (content, id) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const exportConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      const resp = await api.get(`/ai/conversations/${convId}/export`, { responseType: 'blob' });
      const url  = URL.createObjectURL(resp.data);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `styleai-chat-${convId.slice(-8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Conversation exported', 'success');
    } catch {
      showToast('Export failed', 'error');
    }
  };

  const groupedConvs = useMemo(() => {
    const src    = searchResults !== null ? searchResults : conversations;
    const groups = {};
    src.forEach(c => {
      const label = relTime(c.lastActivity).includes('ago') || relTime(c.lastActivity) === 'Just now'
        ? 'Recent'
        : relTime(c.lastActivity) === 'Yesterday'
        ? 'Yesterday'
        : new Date(c.lastActivity) > new Date(Date.now() - 7 * 86400000)
        ? 'This Week'
        : 'Older';
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    return groups;
  }, [conversations, searchResults]);

  const groupOrder       = ['Recent', 'Yesterday', 'This Week', 'Older'];
  const displayedConvs   = searchResults !== null ? searchResults : conversations;
  const isSearching      = searchQuery.trim().length > 0;

  return (
    <div className="ai-root">

      <aside className={`ai-sidebar${showSidebar ? '' : ' ai-sidebar--hidden'}`}>
        <div className="ai-sb-header">
          <span className="ai-sb-title">Conversations</span>
          <button className="ai-sb-new" onClick={newConversation} title="New conversation">
            {Ico.plus(16, '#fff')}
          </button>
        </div>

        <div className="ai-sb-search-wrap">
          <span className="ai-sb-search-icon">{Ico.search(14, '#9CA3AF')}</span>
          <input
            className="ai-sb-search"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="ai-sb-search-clear" onClick={() => setSearchQuery('')}>
              {Ico.close(11, '#9CA3AF')}
            </button>
          )}
        </div>

        <div className="ai-sb-body">
          {loadingConvs ? (
            <div className="ai-sb-loading">
              {[1,2,3].map(i => <div key={i} className="ai-sb-skel" />)}
            </div>
          ) : searching ? (
            <div className="ai-sb-empty"><span>Searching…</span></div>
          ) : displayedConvs.length === 0 ? (
            <div className="ai-sb-empty">
              {isSearching
                ? <><span>No results for "{searchQuery}"</span><small>Try a different term</small></>
                : <><span>No conversations yet</span><small>Start chatting below ↓</small></>
              }
            </div>
          ) : isSearching ? (
            <div className="ai-sb-group">
              <div className="ai-sb-group-lbl">Results ({displayedConvs.length})</div>
              {displayedConvs.map(conv => (
                <ConvItem
                  key={conv._id}
                  conv={conv}
                  active={activeConvId === conv._id}
                  editing={editingTitle === conv._id}
                  titleDraft={titleDraft}
                  titleInputRef={titleInputRef}
                  onOpen={() => openConversation(conv._id)}
                  onEdit={e => startEdit(conv, e)}
                  onDelete={e => { e.stopPropagation(); setDeleteTarget(conv._id); }}
                  onExport={e => exportConversation(conv._id, e)}
                  onTitleChange={e => setTitleDraft(e.target.value)}
                  onTitleBlur={() => saveTitle(conv._id)}
                  onTitleKey={e => { if (e.key === 'Enter') saveTitle(conv._id); if (e.key === 'Escape') setEditingTitle(null); }}
                  Ico={Ico}
                />
              ))}
            </div>
          ) : (
            groupOrder.filter(g => groupedConvs[g]).map(label => (
              <div key={label} className="ai-sb-group">
                <div className="ai-sb-group-lbl">{label}</div>
                {groupedConvs[label].map(conv => (
                  <ConvItem
                    key={conv._id}
                    conv={conv}
                    active={activeConvId === conv._id}
                    editing={editingTitle === conv._id}
                    titleDraft={titleDraft}
                    titleInputRef={titleInputRef}
                    onOpen={() => openConversation(conv._id)}
                    onEdit={e => startEdit(conv, e)}
                    onDelete={e => { e.stopPropagation(); setDeleteTarget(conv._id); }}
                    onExport={e => exportConversation(conv._id, e)}
                    onTitleChange={e => setTitleDraft(e.target.value)}
                    onTitleBlur={() => saveTitle(conv._id)}
                    onTitleKey={e => { if (e.key === 'Enter') saveTitle(conv._id); if (e.key === 'Escape') setEditingTitle(null); }}
                    Ico={Ico}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        <div className="ai-sb-footer">
          {conversations.length > 0 && !isSearching && (
            <span className="ai-sb-count">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
          )}
          {providerInfo?.configured && (
            <span className="ai-sb-provider">via {providerInfo.name}</span>
          )}
        </div>
      </aside>

      {showSidebar && <div className="ai-sb-overlay" onClick={() => setShowSidebar(false)} />}

      <div className="ai-chat">

        <div className="ai-chat-header">
          <button className="ai-toggle-btn" onClick={() => setShowSidebar(p => !p)} title="Toggle sidebar">
            {Ico.menu(20)}
          </button>
          <div className="ai-chat-header-center">
            <span className="ai-chat-logo">{Ico.sparkle(16, '#0D9488')}</span>
            <span className="ai-chat-title-main">AI Fashion Assistant</span>
            {providerInfo?.configured && (
              <span className="ai-provider-chip">{providerInfo.name}</span>
            )}
          </div>
          <button className="ai-new-chat-btn" onClick={newConversation}>
            {Ico.plus(15)} New chat
          </button>
        </div>

        <div className="ai-messages">
          {!activeConvId && messages.length === 0 ? (
            providerInfo && !providerInfo.configured ? (
              <div className="ai-setup">
                <div className="ai-setup-icon">{Ico.sparkle(40, '#0D9488')}</div>
                <h2 className="ai-setup-title">Connect an AI provider to get started</h2>
                <p className="ai-setup-sub">The AI Fashion Advisor requires a free Google Gemini API key to get started — no payment necessary.</p>
                <div className="ai-setup-options">
                  <a className="ai-setup-opt ai-setup-opt--recommended" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                    <span className="ai-setup-opt-badge">Free</span>
                    <div className="ai-setup-opt-name">Google Gemini</div>
                    <div className="ai-setup-opt-desc">1,500 free requests/day · No credit card required · Fast response times</div>
                    <div className="ai-setup-opt-key">Set <code>GEMINI_API_KEY</code> in backend/.env</div>
                  </a>
                </div>
                <p className="ai-setup-restart">After adding the key to <code>backend/.env</code>, restart the backend server.</p>
              </div>
            ) : (
              <div className="ai-welcome">
                <div className="ai-welcome-icon">{Ico.sparkle(34, '#0D9488')}</div>
                <h2 className="ai-welcome-title">Welcome, {firstName}</h2>
                <p className="ai-welcome-sub">
                  I am your AI Fashion Advisor. I have access to your wardrobe, style profile, and
                  Kathmandu's current weather — and I am here to provide precise, personalised
                  styling guidance for any occasion.
                </p>
                <div className="ai-quick-grid">
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button key={i} className="ai-quick-btn" onClick={() => sendMessage(qp.label)}>
                      <span>{qp.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : loadingMsgs ? (
            <div className="ai-loading-msgs">
              {[1,2,3].map(i => (
                <div key={i} className={`ai-msg-skel${i % 2 === 0 ? ' ai-msg-skel--right' : ''}`} />
              ))}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isUser    = msg.role === 'user';
                const isTyping  = msg.content === '__typing__';
                const msgId     = msg._id || idx;
                const msgSuggs  = !isUser && !isTyping ? (suggestions[msgId] || []) : [];
                const isLast    = idx === messages.length - 1;

                return (
                  <React.Fragment key={msgId}>
                    <div className={`ai-msg-row${isUser ? ' ai-msg-row--user' : ''}`}>
                      {!isUser && (
                        <div className="ai-avatar">
                          {Ico.sparkle(14, '#0D9488')}
                        </div>
                      )}
                      <div className={`ai-bubble${isUser ? ' ai-bubble--user' : ''}${msg.isError ? ' ai-bubble--error' : ''}`}>
                        {isTyping ? (
                          <TypingDots />
                        ) : isUser ? (
                          <p className="ai-msg-p">{msg.content}</p>
                        ) : (
                          <div className="ai-msg-content">
                            {renderMessage(msg.content)}
                          </div>
                        )}
                        {!isTyping && msg.createdAt && (
                          <div className={`ai-msg-ts${isUser ? ' ai-msg-ts--user' : ''}`}>
                            {fmtTime(msg.createdAt)}
                          </div>
                        )}
                        {!isTyping && !isUser && (
                          <div className="ai-bubble-actions">
                            <button
                              className={`ai-bubble-act${copiedId === msgId ? ' ai-bubble-act--copied' : ''}`}
                              onClick={() => copyMessage(msg.content, msgId)}
                              title="Copy"
                            >
                              {copiedId === msgId ? '✓' : Ico.copy(12, '#9CA3AF')}
                            </button>
                          </div>
                        )}
                      </div>
                      {isUser && (
                        <div className="ai-user-avatar">{userInitial}</div>
                      )}
                    </div>

                    {msgSuggs.length > 0 && isLast && !sending && (
                      <div className="ai-suggestions-row">
                        {msgSuggs.map((s, si) => (
                          <button key={si} className="ai-suggestion-chip" onClick={() => sendMessage(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {activeConvId && messages.length === 0 && !loadingMsgs && (
          <div className="ai-quick-row">
            {QUICK_PROMPTS.slice(0, 3).map((qp, i) => (
              <button key={i} className="ai-quick-chip" onClick={() => sendMessage(qp.label)}>
                {qp.icon} {qp.label}
              </button>
            ))}
          </div>
        )}

        <div className="ai-input-area">
          <div className="ai-input-box">
            <textarea
              ref={inputRef}
              className="ai-input"
              placeholder={`Ask me about your wardrobe, styling, occasions…`}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKey}
              rows={1}
              disabled={sending}
            />
            <button
              className={`ai-send-btn${(!input.trim() || sending) ? ' ai-send-btn--disabled' : ''}`}
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              title="Send (Enter)"
            >
              {Ico.send(17, '#fff')}
            </button>
          </div>
          <div className="ai-input-meta">
            <span className="ai-input-hint">Enter to send · Shift+Enter for new line</span>
            {charCount > 0 && (
              <span className={`ai-char-count${charNear ? ' ai-char-count--warn' : ''}`}>
                {charCount}/{MAX_CHARS}
              </span>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`ai-toast ai-toast--${toast.type}`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)}>{Ico.close(12, '#fff')}</button>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="Delete this conversation? This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function ConvItem({ conv, active, editing, titleDraft, titleInputRef, onOpen, onEdit, onDelete, onExport, onTitleChange, onTitleBlur, onTitleKey, Ico }) {
  return (
    <div
      className={`ai-sb-item${active ? ' ai-sb-item--active' : ''}`}
      onClick={onOpen}
    >
      {editing ? (
        <input
          ref={titleInputRef}
          className="ai-sb-title-edit"
          value={titleDraft}
          onChange={onTitleChange}
          onBlur={onTitleBlur}
          onKeyDown={onTitleKey}
          onClick={e => e.stopPropagation()}
          maxLength={80}
        />
      ) : (
        <>
          <div className="ai-sb-item-title">{conv.title}</div>
          {conv.preview && <div className="ai-sb-item-preview">{conv.preview}</div>}
          <div className="ai-sb-item-time">{relTime(conv.lastActivity)}</div>
        </>
      )}
      <div className="ai-sb-item-actions">
        <button className="ai-sb-act" onClick={onEdit} title="Rename">
          {Ico.edit(13, '#9CA3AF')}
        </button>
        <button className="ai-sb-act" onClick={onExport} title="Export">
          {Ico.download(13, '#9CA3AF')}
        </button>
        <button className="ai-sb-act ai-sb-act--del" onClick={onDelete} title="Delete">
          {Ico.trash(13, '#9CA3AF')}
        </button>
      </div>
    </div>
  );
}
