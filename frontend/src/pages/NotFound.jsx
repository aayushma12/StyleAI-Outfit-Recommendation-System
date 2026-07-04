import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './NotFound.css';

export default function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const homeHref = user?.role === 'admin' ? '/admin' : user ? '/dashboard' : '/';

  return (
    <div className="nf-root">
      <div className="nf-bg-circle nf-bg-c1" />
      <div className="nf-bg-circle nf-bg-c2" />

      <div className="nf-card">
        <div className="nf-logo">StyleAI</div>

        <div className="nf-code-wrap">
          <span className="nf-digit">4</span>
          <span className="nf-zero">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="36" stroke="url(#ng)" strokeWidth="4" />
              <circle cx="40" cy="40" r="18" fill="url(#ng2)" opacity=".18" />
              <defs>
                <linearGradient id="ng" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7C3AED" />
                  <stop offset="1" stopColor="#0D9488" />
                </linearGradient>
                <linearGradient id="ng2" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7C3AED" />
                  <stop offset="1" stopColor="#0D9488" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span className="nf-digit">4</span>
        </div>

        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-desc">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have been moved.
          Let&rsquo;s get you back on track.
        </p>

        <div className="nf-actions">
          <button className="nf-btn nf-btn-secondary" onClick={() => navigate(-1)}>
            ← Go Back
          </button>
          <Link to={homeHref} className="nf-btn nf-btn-primary">
            Go Home
          </Link>
        </div>

        <div className="nf-links">
          {!user && (
            <>
              <Link to="/login" className="nf-link">Sign In</Link>
              <span className="nf-link-dot">·</span>
              <Link to="/register" className="nf-link">Create Account</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
