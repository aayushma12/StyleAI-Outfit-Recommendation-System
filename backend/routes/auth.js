'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router  = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPasswordWithOtp,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Every body(...) validator chain below previously had its result never
// checked anywhere in this file — a validation failure was silently ignored
// and the request proceeded to the controller regardless (most controllers
// happen to duplicate their own manual checks, which is why this mostly
// "worked" anyway). One real, user-visible consequence: express-validator's
// normalizeEmail() sanitizer runs unconditionally even when a field is
// missing, and turns an absent email into the literal string "@" — which is
// truthy, so it defeated forgotPassword's own `if (!email)` guard too.
// Matches the same checkValidation pattern already used in
// routes/wardrobe.js / routes/recommendations.js / routes/admin.js.
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ── Registration ──────────────────────────────────────────────────────────────
router.post('/register', [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email')
    .isEmail().withMessage('Valid email address is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
  body('consentGiven')
    .equals('true').withMessage('You must provide consent to continue'),
  body('username')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[a-zA-Z0-9_]{3,20}$/).withMessage('Username must be 3–20 characters: letters, numbers, underscores only'),
  checkValidation,
], register);

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  checkValidation,
], login);

// ── Authenticated user ────────────────────────────────────────────────────────
router.get('/me', protect, getMe);
router.post('/logout', logout);

// ── Password reset (email OTP) ─────────────────────────────────────────────────
router.post('/forgot-password', [
  body('email')
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  checkValidation,
], forgotPassword);

router.post('/reset-password-otp', [
  body('email')
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('otp')
    .notEmpty().withMessage('Reset code is required.')
    .isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits.')
    .isNumeric().withMessage('Reset code must be 6 digits.'),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must include at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must include at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must include at least one number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must include at least one special character.'),
  checkValidation,
], resetPasswordWithOtp);

module.exports = router;
