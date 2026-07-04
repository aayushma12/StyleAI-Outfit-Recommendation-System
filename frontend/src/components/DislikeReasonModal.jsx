import React, { useState } from 'react';
import './DislikeReasonModal.css';

const DISLIKE_REASONS = [
  { id: 'too_expensive',  label: 'Too expensive for my budget',       icon: '💸' },
  { id: 'wrong_color',    label: 'Wrong color for my taste',          icon: '🎨' },
  { id: 'wrong_style',    label: 'Wrong style, not my preference',    icon: '👗' },
  { id: 'wrong_occasion', label: 'Unsuitable for the occasion',       icon: '📅' },
  { id: 'wrong_season',   label: 'Wrong season for this outfit',      icon: '🌤' },
  { id: 'too_formal',     label: 'Too formal for what I need',        icon: '👔' },
  { id: 'too_casual',     label: 'Too casual for what I need',        icon: '👕' },
  { id: 'already_own',    label: 'I already own something similar',   icon: '🔄' },
  { id: 'wrong_fabric',   label: 'Wrong fabric preference',           icon: '🧵' },
  { id: 'poor_fit',       label: "Doesn't suit my body type",         icon: '📐' },
];

export function DislikeReasonModal({ isOpen, onClose, onConfirm, outfitName }) {
  const [selected, setSelected] = useState([]);

  if (!isOpen) return null;

  const toggle = (id) =>
    setSelected(s => s.includes(id) ? s.filter(r => r !== id) : [...s, id]);

  const handleConfirm = () => {
    onConfirm(selected);
    setSelected([]);
  };

  return (
    <div className="drm-overlay" onClick={onClose}>
      <div className="drm-modal" onClick={e => e.stopPropagation()}>
        <div className="drm-hd">
          <div className="drm-hd-icon">👎</div>
          <div className="drm-hd-text">
            <div className="drm-hd-title">Not for you?</div>
            <div className="drm-hd-sub">
              Help StyleAI learn — select why you disliked <strong>{outfitName || 'this outfit'}</strong>
            </div>
          </div>
          <button className="drm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drm-body">
          <div className="drm-hint">Select all that apply (optional)</div>
          <div className="drm-reasons">
            {DISLIKE_REASONS.map(r => (
              <button
                key={r.id}
                className={`drm-reason${selected.includes(r.id) ? ' drm-reason--selected' : ''}`}
                onClick={() => toggle(r.id)}
              >
                <span className="drm-reason-icon">{r.icon}</span>
                <span className="drm-reason-label">{r.label}</span>
                {selected.includes(r.id) && <span className="drm-check">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="drm-footer">
          <button className="drm-skip" onClick={() => { onConfirm([]); setSelected([]); }}>
            Skip — just dislike
          </button>
          <button className="drm-confirm" onClick={handleConfirm}>
            {selected.length > 0
              ? `Submit (${selected.length} reason${selected.length > 1 ? 's' : ''})`
              : 'Submit feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
