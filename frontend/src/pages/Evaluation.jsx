import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Evaluation.css';

const QUESTIONS = [
  { key: 'recommendationQuality', label: 'Recommendation Quality',   desc: 'How relevant and well-matched were the outfit recommendations?' },
  { key: 'easeOfUse',             label: 'Ease of Use',              desc: 'How easy was it to navigate and use StyleAI?' },
  { key: 'visualDesign',          label: 'Visual Design',            desc: 'How would you rate the look and feel of the interface?' },
  { key: 'systemSpeed',           label: 'System Speed',             desc: 'How fast did the app respond while you used it?' },
  { key: 'overallSatisfaction',   label: 'Overall Satisfaction',     desc: 'How satisfied are you with StyleAI overall?' },
];

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="ev-stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          className={`ev-star ${active >= n ? 'ev-star--filled' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`Rate ${n} out of 5`}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function Evaluation() {
  const [ratings, setRatings] = useState({});
  const [participantLabel, setParticipantLabel] = useState('');
  const [comments, setComments] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const setRating = (key, val) => {
    setRatings(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const e = {};
    QUESTIONS.forEach(q => { if (!ratings[q.key]) e[q.key] = 'Please choose a rating'; });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/evaluation', { ...ratings, participantLabel, comments });
      setSubmitted(true);
    } catch {
      setErrors(prev => ({ ...prev, global: 'Failed to submit. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="ev-root">
        <div className="ev-card ev-success">
          <div className="ev-success-icon">✓</div>
          <h2>Thank you for your feedback!</h2>
          <p>Your response has been recorded and helps improve StyleAI's recommendation system.</p>
          <Link to="/" className="ev-back-link">Back to StyleAI</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ev-root">
      <div className="ev-card">
        <Link to="/" className="ev-logo">StyleAI</Link>
        <h2 className="ev-title">Usability Evaluation</h2>
        <p className="ev-sub">
          Thanks for trying StyleAI. This short survey helps evaluate the recommendation system as
          part of an academic thesis project — it takes about a minute.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="ev-field">
            <label className="ev-label">Participant Label <span className="ev-optional">(optional)</span></label>
            <input
              className="ev-input"
              placeholder="e.g. P1, or your name"
              value={participantLabel}
              onChange={e => setParticipantLabel(e.target.value)}
              maxLength={80}
            />
          </div>

          {QUESTIONS.map(q => (
            <div key={q.key} className={`ev-question ${errors[q.key] ? 'ev-question--error' : ''}`}>
              <div className="ev-q-label">{q.label}</div>
              <div className="ev-q-desc">{q.desc}</div>
              <StarRating value={ratings[q.key] || 0} onChange={v => setRating(q.key, v)} />
              {errors[q.key] && <div className="ev-field-error">{errors[q.key]}</div>}
            </div>
          ))}

          <div className="ev-field">
            <label className="ev-label">Comments <span className="ev-optional">(optional)</span></label>
            <textarea
              className="ev-textarea"
              placeholder="Anything else you'd like to share?"
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>

          {errors.global && <div className="ev-error-banner">{errors.global}</div>}

          <button type="submit" className="ev-submit-btn" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Evaluation'}
          </button>
        </form>
      </div>
    </div>
  );
}
