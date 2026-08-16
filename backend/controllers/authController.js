'use strict';

const crypto      = require('crypto');
const jwt         = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User        = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { sendPasswordResetOtpEmail } = require('../services/mailService');
const { STRONG_PASSWORD, PASSWORD_ERROR_MSG } = require('../utils/validation');
const { isDev } = require('../config/env');

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS     = 5;
const LOCK_TIME_MS           = 15 * 60 * 1000;
const RESET_GENERIC          = 'If an account with this email exists, a password reset code has been sent.';
const OTP_EXPIRY_MS          = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS       = 5; // guards the 6-digit (1e6) keyspace within the code's validity window

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

// 6-digit numeric code, zero-padded (crypto.randomInt is uniformly distributed
// and cryptographically strong, unlike Math.random()).
const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

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

  let user;
  try {
    user = await User.create({
      name,
      email,
      password,
      consentGiven: true,
      consentDate: new Date(),
      ...(username && { username: username.toLowerCase() }),
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
      onboardingCompleted: user.onboardingCompleted,
    },
  });
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password, rememberMe = false } = req.body;

  // Select lockout fields explicitly (not returned by default)
  const user = await User.findOne({ email })
    .select('+password +loginAttempts +lockUntil');

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
      onboardingCompleted: user.onboardingCompleted,
    },
  });
};

// ── Get current user ──────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

// ── Forgot password — emails a 6-digit OTP (also used to resend) ──────────────
exports.forgotPassword = async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  const user = await User.findOne({ email });
  if (!user) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
    return res.json({ message: RESET_GENERIC });
  }

  const otp = generateOtp();

  user.resetOtp         = hashToken(otp);
  user.resetOtpExpires  = new Date(Date.now() + OTP_EXPIRY_MS);
  user.resetOtpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetOtpEmail({ email: user.email, name: user.name, otp });
  } catch (err) {
    console.error('Password reset OTP email failed:', err.message);
    user.resetOtp         = undefined;
    user.resetOtpExpires  = undefined;
    user.resetOtpAttempts = 0;
    await user.save({ validateBeforeSave: false });
    return res.status(500).json({
      message: 'We could not send the reset code right now. Please try again in a few minutes.',
    });
  }

  logAuth('Password reset code requested', user.email, user._id);
  res.json({ message: RESET_GENERIC });
};

// ── Reset password with OTP — verifies the code and sets the new password in
// one step (no separate "verify" round trip, unlike the old link-token flow) ──
exports.resetPasswordWithOtp = async (req, res) => {
  const email    = (req.body.email || '').toLowerCase().trim();
  const otp      = (req.body.otp || '').trim();
  const password = req.body.password;

  if (!email)    return res.status(400).json({ message: 'Email address is required.' });
  if (!otp)      return res.status(400).json({ message: 'Reset code is required.' });
  if (!password) return res.status(400).json({ message: 'New password is required.' });

  if (!STRONG_PASSWORD.test(password)) {
    return res.status(400).json({ message: PASSWORD_ERROR_MSG });
  }

  const user = await User.findOne({ email })
    .select('+password +resetOtp +resetOtpExpires +resetOtpAttempts');

  const genericInvalid = { message: 'This code is invalid or has expired. Please request a new one.' };

  // Same shape/timing regardless of whether the account exists — avoids
  // leaking account existence via this endpoint too.
  if (!user || !user.resetOtp || !user.resetOtpExpires || user.resetOtpExpires < Date.now()) {
    return res.status(400).json(genericInvalid);
  }

  if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
    return res.status(400).json({
      message: 'Too many incorrect attempts. Please request a new code.',
    });
  }

  if (hashToken(otp) !== user.resetOtp) {
    user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
    // Invalidate the code once the attempt cap is hit — otherwise a failed
    // guess right at the limit would still leave a technically-usable code.
    if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
      user.resetOtp        = undefined;
      user.resetOtpExpires = undefined;
    }
    await user.save({ validateBeforeSave: false });
    return res.status(400).json(genericInvalid);
  }

  user.password          = password;
  user.resetOtp          = undefined;
  user.resetOtpExpires   = undefined;
  user.resetOtpAttempts  = 0;
  // Reset any lockout when password is changed via reset
  user.loginAttempts     = 0;
  user.lockUntil         = undefined;
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
