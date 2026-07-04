import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Unauthorized.css';

export default function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const homeHref = user?.role === 'admin' ? '/admin' : user ? '/dashboard' : '/';

  return (
    <div className="ua-root">
      <div className="ua-bg-circle ua-bg-c1" />
      <div className="ua-bg-circle ua-bg-c2" />

      <div className="ua-card">
        <div className="ua-logo">StyleAI</div>

        <div className="ua-shield-wrap">
          <svg className="ua-shield" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M48 8L16 20v28c0 19.6 13.6 37.9 32 42.6C66.4 85.9 80 67.6 80 48V20L48 8z"
              fill="url(#ua-grad)" opacity=".15" />
            <path d="M48 8L16 20v28c0 19.6 13.6 37.9 32 42.6C66.4 85.9 80 67.6 80 48V20L48 8z"
              stroke="url(#ua-grad)" strokeWidth="3" strokeLinejoin="round" fill="none" />
            <path d="M34 47l10 10 18-18" stroke="url(#ua-grad2)" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round" opacity="0" />
            <path d="M36 44h24M48 36v24" stroke="url(#ua-grad2)" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="ua-grad" x1="16" y1="8" x2="80" y2="90.6" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#0D9488" />
              </linearGradient>
              <linearGradient id="ua-grad2" x1="36" y1="36" x2="60" y2="68" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#0D9488" />
              </linearGradient>
            </defs>
          </svg>
          <div className="ua-code">403</div>
        </div>

        <h1 className="ua-title">Access Denied</h1>
        <p className="ua-desc">
          You don&rsquo;t have permission to view this page.
          {user
            ? ' Please contact support if you believe this is a mistake.'
            : ' Sign in or create an account to continue.'}
        </p>

        {!user && (
          <div className="ua-auth-btns">
            <Link to="/login"    className="ua-btn ua-btn-primary">Sign In</Link>
            <Link to="/register" className="ua-btn ua-btn-secondary">Create Account</Link>
          </div>
        )}

        <div className="ua-actions">
          <button className="ua-text-btn" onClick={() => navigate(-1)}>← Go Back</button>
          <span className="ua-sep">·</span>
          <Link to={homeHref} className="ua-text-btn">Go Home</Link>
        </div>
      </div>
    </div>
  );
}
