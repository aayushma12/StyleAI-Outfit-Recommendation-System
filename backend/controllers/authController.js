'use strict';

const crypto      = require('crypto');
const jwt         = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User        = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/mailService');
const { STRONG_PASSWORD, PASSWORD_ERROR_MSG } = require('../utils/validation');
const { isDev } = require('../config/env');

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS     = 5;
const LOCK_TIME_MS           = 15 * 60 * 1000;
const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RESET_GENERIC          = 'If an account with this email exists, a password reset link has been sent.';

// ── Helpers ───────────────────────────────────────────────────────────────────
const logAuth = (action, detail = '', userId = null) =>
  ActivityLog.create({ user: userId, action, category: 'auth', detail }).catch(() => {});

const signToken = (id, rememberMe = false) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '30d' : (process.env.JWT_EXPIRE || '7d'),
  });

const setCookieToken = (res, token, rememberMe = false) => {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  res.cookie('token', token, {
    httpOnly: true,
    secure:   !isDev,
    sameSite: 'strict',
    maxAge,
  });
};

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const generateRawToken = () => crypto.randomBytes(32).toString('hex');

// Gracefully send an email — if SMTP isn't configured, just warn and continue.
const trySendEmail = async (fn, label) => {
  try {
    await fn();
  } catch (err) {
    console.warn(`[Auth] ${label} email failed (non-fatal): ${err.message}`);
  }
};

// ── Registration ──────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, consentGiven, username } = req.body;

  if (!consentGiven) {
    return res.status(400).json({ message: 'You must provide consent to use this service.' });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already registered.' });

  if (username) {
    const usernameTaken = await User.findOne({ username: username.toLowerCase() });
    if (usernameTaken) return res.status(400).json({ message: 'That username is already taken.' });
  }

  // Generate email verification token
  const rawToken   = generateRawToken();
  const hashedToken = hashToken(rawToken);
  const verifyUrl  = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${rawToken}`;

  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  let user;
  try {
    user = await User.create({
      name,
      email,
      password,
      consentGiven: true,
      consentDate: new Date(),
      ...(username && { username: username.toLowerCase() }),
      // Mark as verified immediately if SMTP isn't configured (dev mode)
      emailVerified:      !smtpConfigured,
      verificationToken:  smtpConfigured ? hashedToken : undefined,
      verificationExpiry: smtpConfigured ? new Date(Date.now() + VERIFICATION_EXPIRY_MS) : undefined,
    });
  } catch (err) {
    // The findOne pre-checks above are best-effort — a concurrent registration
    // can still race past them, so the DB's unique index is the real guarantee.
    // Turn that into the same clean message the pre-check would have given.
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const message = field === 'username' ? 'That username is already taken.' : 'Email already registered.';
      return res.status(400).json({ message });
    }
    throw err;
  }

  if (smtpConfigured) {
    await trySendEmail(
      () => sendVerificationEmail({ email: user.email, name: user.name, verifyUrl }),
      'Verification'
    );
  }

  const token = signToken(user._id);
  setCookieToken(res, token);
  logAuth('User registered', user.email, user._id);

  res.status(201).json({
    token,
    user: {
      id:                  user._id,
      name:                user.name,
      email:               user.email,
      username:            user.username,
      role:                user.role,
      status:              user.status,
      emailVerified:       user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    },
    emailVerificationSent: smtpConfigured,
  });
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password, rememberMe = false } = req.body;

  // Select lockout fields explicitly (not returned by default)
  const user = await User.findOne({ email })
    .select('+password +loginAttempts +lockUntil +verificationToken +verificationExpiry');

  if (!user) {
    // Prevent timing-based user enumeration — constant-time response
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // ── Account lockout check ──────────────────────────────────────────────────
  if (user.isLocked) {
    const unlockAt   = new Date(user.lockUntil);
    const minutesLeft = Math.ceil((unlockAt - Date.now()) / 60000);
    return res.status(423).json({
      message: `Account temporarily locked due to too many failed attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      lockUntil: unlockAt,
      code: 'ACCOUNT_LOCKED',
    });
  }

  // ── Suspension check ───────────────────────────────────────────────────────
  if (user.isBlocked || user.status === 'suspended') {
    return res.status(403).json({
      message: 'Your account has been suspended. Please contact support at hello@styleai.com.np.',
      code: 'ACCOUNT_SUSPENDED',
    });
  }

  // ── Password verification ──────────────────────────────────────────────────
  const passwordMatch = await user.comparePassword(password);
  if (!passwordMatch) {
    const newAttempts = (user.loginAttempts || 0) + 1;
    const updates     = { loginAttempts: newAttempts };

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      updates.lockUntil     = new Date(Date.now() + LOCK_TIME_MS);
      updates.loginAttempts = newAttempts;
    }
    await User.findByIdAndUpdate(user._id, updates);

    const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
    const message   = newAttempts >= MAX_LOGIN_ATTEMPTS
      ? `Account locked for 15 minutes due to too many failed attempts.`
      : `Invalid email or password.${remaining > 0 ? ` ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.` : ''}`;

    return res.status(401).json({ message, code: 'INVALID_CREDENTIALS' });
  }

  // ── Email verification check ───────────────────────────────────────────────
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  if (requireVerification && !user.emailVerified) {
    return res.status(403).json({
      message: 'Please verify your email address before signing in. Check your inbox for the verification link.',
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email,
    });
  }

  // ── Success — reset lockout, update lastLogin ──────────────────────────────
  await User.findByIdAndUpdate(user._id, {
    loginAttempts: 0,
    lockUntil: null,
    lastLogin: new Date(),
  });

  const token = signToken(user._id, !!rememberMe);
  setCookieToken(res, token, !!rememberMe);
  if (user.role === 'admin') logAuth('Admin logged in', user.email, user._id);

  res.json({
    token,
    user: {
      id:                  user._id,
      name:                user.name,
      email:               user.email,
      username:            user.username,
      role:                user.role,
      status:              user.status,
      emailVerified:       user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    },
  });
};

// ── Get current user ──────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

// ── Email verification ────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ valid: false, message: 'Verification token is required.' });

  const hashed = hashToken(token);

  const user = await User.findOne({
    verificationToken:  hashed,
    verificationExpiry: { $gt: Date.now() },
  }).select('+verificationToken +verificationExpiry');

  if (!user) {
    return res.status(400).json({
      valid: false,
      code: 'TOKEN_INVALID_OR_EXPIRED',
      message: 'This verification link has expired or is invalid. Please request a new one.',
    });
  }

  if (user.emailVerified) {
    return res.json({ valid: true, alreadyVerified: true, message: 'Email already verified.' });
  }

  user.emailVerified      = true;
  user.verificationToken  = undefined;
  user.verificationExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  logAuth('Email verified', user.email, user._id);
  res.json({ valid: true, alreadyVerified: false, message: 'Email verified successfully. You can now sign in.' });
};

// ── Resend verification email ─────────────────────────────────────────────────
exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  // Always respond generically to prevent email enumeration
  const GENERIC = 'If an unverified account with this email exists, a new verification link has been sent.';

  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+verificationToken +verificationExpiry');

  if (!user || user.emailVerified) {
    await new Promise(r => setTimeout(r, 300));
    return res.json({ message: GENERIC });
  }

  // Rate-limit resends — one every 2 minutes
  if (user.verificationExpiry && (user.verificationExpiry - Date.now()) > (VERIFICATION_EXPIRY_MS - 2 * 60 * 1000)) {
    return res.status(429).json({
      message: 'Please wait at least 2 minutes before requesting another verification email.',
    });
  }

  const rawToken  = generateRawToken();
  const hashed    = hashToken(rawToken);
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${rawToken}`;

  user.verificationToken  = hashed;
  user.verificationExpiry = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

  await trySendEmail(
    () => sendVerificationEmail({ email: user.email, name: user.name, verifyUrl }),
    'Resend verification'
  );

  res.json({ message: GENERIC });
};

// ── Verify reset token (called by frontend on page load) ──────────────────────
exports.verifyResetToken = async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ valid: false, message: 'Token is required.' });

  const hashed = hashToken(token);
  const user   = await User.findOne({
    resetPasswordToken:   hashed,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('_id');

  if (!user) {
    return res.status(400).json({
      valid:   false,
      message: 'This password reset link has expired or is invalid. Please request a new one.',
    });
  }
  res.json({ valid: true });
};

// ── Forgot password ───────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  const user = await User.findOne({ email });
  if (!user) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
    return res.json({ message: RESET_GENERIC });
  }

  const rawToken = generateRawToken();
  const hashed   = hashToken(rawToken);
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${rawToken}`;

  user.resetPasswordToken   = hashed;
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });
  } catch (err) {
    console.error('Password reset email failed:', err.message);
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(500).json({
      message: 'We could not send the reset email right now. Please try again in a few minutes.',
    });
  }

  logAuth('Password reset requested', user.email, user._id);
  res.json({ message: RESET_GENERIC });
};

// ── Reset password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { token }    = req.params;
  const { password } = req.body;

  if (!token)    return res.status(400).json({ message: 'Reset token is required.' });
  if (!password) return res.status(400).json({ message: 'New password is required.' });

  if (!STRONG_PASSWORD.test(password)) {
    return res.status(400).json({ message: PASSWORD_ERROR_MSG });
  }

  const hashed = hashToken(token);
  const user   = await User.findOne({
    resetPasswordToken:   hashed,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+password');

  if (!user) {
    return res.status(400).json({
      message: 'This reset link has expired or is invalid. Please request a new one.',
    });
  }

  user.password             = password;
  user.resetPasswordToken   = undefined;
  user.resetPasswordExpires = undefined;
  // Reset any lockout when password is changed via reset
  user.loginAttempts        = 0;
  user.lockUntil            = undefined;
  await user.save();

  logAuth('Password reset completed', user.email, user._id);
  res.json({ message: 'Your password has been reset successfully. You can now sign in.' });
};

// ── Logout ────────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure:   !isDev,
    sameSite: 'strict',
  });
  res.json({ message: 'Logged out.' });
};
