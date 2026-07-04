import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './GuestModal.css';

const FEATURES = [
  { icon: '✨', text: 'Personalized AI outfit recommendations' },
  { icon: '👗', text: 'Upload & manage your wardrobe' },
  { icon: '💬', text: 'Chat with your personal AI stylist' },
  { icon: '📅', text: 'Plan your outfits for the week' },
];

export default function GuestModal({ isOpen, onClose, message }) {
  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="gm-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Sign in required">
      <div className="gm-card" onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button className="gm-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="gm-header">
          <div className="gm-icon-wrap">
            <span className="gm-icon">✨</span>
          </div>
          <div className="gm-logo">StyleAI</div>
          <h2 className="gm-title">Join to Continue</h2>
          <p className="gm-desc">
            {message || 'Create your free account to unlock AI-powered style recommendations curated for Kathmandu.'}
          </p>
        </div>

        {/* Feature list */}
        <ul className="gm-features">
          {FEATURES.map((f) => (
            <li key={f.text} className="gm-feature">
              <span className="gm-feature-icon">{f.icon}</span>
              <span className="gm-feature-text">{f.text}</span>
            </li>
          ))}
        </ul>

        {/* CTA buttons */}
        <div className="gm-btns">
          <Link to="/register" className="gm-btn gm-btn-primary" onClick={onClose}>
            Create Free Account
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link to="/login" className="gm-btn gm-btn-secondary" onClick={onClose}>
            Sign In to Existing Account
          </Link>
        </div>

        <p className="gm-note">Free forever &nbsp;·&nbsp; No credit card required</p>
      </div>
    </div>
  );
}
