'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const ctrl    = require('../controllers/recommendationController');
const { OCCASIONS: VALID_OCCASIONS } = require('../constants/occasions');

const checkId = validateObjectId('id');

const validateGenerate = [
  body('occasion').optional().isString().trim().isIn(VALID_OCCASIONS)
    .withMessage(`occasion must be one of: ${VALID_OCCASIONS.join(', ')}`),
  body('mood').optional().isString().trim().isLength({ max: 100 }),
  body('wardrobeOnly').optional().isBoolean(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
];

// Kept deliberately minimal — the wizard only ever asks 3 questions
// (occasion, style, optional notes). No budget/price fields: this app helps
// users decide what to wear, not what to buy.
const validateWizard = [
  body('occasion').optional().isString().trim().isIn(VALID_OCCASIONS)
    .withMessage(`occasion must be one of: ${VALID_OCCASIONS.join(', ')}`),
  body('style').optional().isString().trim().isLength({ max: 100 }),
  body('extraNotes').optional().isString().trim().isLength({ max: 300 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
];

/* All recommendation routes require authentication */
router.use(protect);

// ── Daily (auto-generates if needed) ─────────────────────────────────────────
router.get('/daily',              ctrl.getDaily);
router.post('/daily/regenerate',  ctrl.regenerateDaily);

// ── Standard queries ──────────────────────────────────────────────────────────
router.get('/latest',             ctrl.getLatest);
router.get('/stats',              ctrl.getStats);
router.get('/history',            ctrl.getHistory);
router.get('/insights',           ctrl.getInsights);
router.get('/analytics',          ctrl.getAnalytics);
router.get('/weights',            ctrl.getWeights);
router.get('/kathmandu',          ctrl.getKathmanduContext);
router.get('/trends',             ctrl.getTrends);

// ── ML Bridge status ──────────────────────────────────────────────────────────
router.get('/ml-status',          ctrl.getMlStatus);

// ── Session by ID ─────────────────────────────────────────────────────────────
router.get('/:id',                checkId, ctrl.getOne);

// ── Generation ────────────────────────────────────────────────────────────────
router.post('/generate',          validateGenerate, ctrl.generate);
router.post('/wizard',            validateWizard,   ctrl.wizard);
router.post('/:id/feedback',      checkId, ctrl.submitFeedback);

module.exports = router;
