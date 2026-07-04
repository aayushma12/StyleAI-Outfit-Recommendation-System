'use strict';

const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  verifyResetToken,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

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
], register);

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], login);

// ── Authenticated user ────────────────────────────────────────────────────────
router.get('/me', protect, getMe);
router.post('/logout', logout);

// ── Email verification ────────────────────────────────────────────────────────
router.get('/verify-email/:token', verifyEmail);

router.post('/resend-verification', [
  body('email')
    .isEmail().withMessage('Valid email address is required')
    .normalizeEmail(),
], resendVerification);

// ── Password reset ────────────────────────────────────────────────────────────
router.get('/verify-reset-token/:token', verifyResetToken);

router.post('/forgot-password', [
  body('email')
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail(),
], forgotPassword);

router.post('/reset-password/:token', [
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must include at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must include at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must include at least one number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must include at least one special character.'),
], resetPassword);

module.exports = router;
