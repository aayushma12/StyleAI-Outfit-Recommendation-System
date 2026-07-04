'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const ctrl    = require('../controllers/recommendationController');

const checkId = validateObjectId('id');

const VALID_OCCASIONS = [
  'daily', 'college', 'home', 'travel', 'gym', 'cafe', 'shopping',
  'date', 'party', 'office', 'formal', 'festival', 'wedding', 'pooja', 'trekking',
  'interview', 'birthday', 'traditional_ceremony', 'graduation', 'family_gathering',
];

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

const validateWizard = [
  body('occasion').optional().isString().trim(),
  body('dresscode').optional().isString().trim().isLength({ max: 100 }),
  body('budget').optional().isString().trim().isIn(['budget', 'mid-range', 'premium', 'luxury']),
  body('indoorOutdoor').optional().isString().isIn(['indoor', 'outdoor', 'both']),
  body('dayNight').optional().isString().isIn(['day', 'night', 'both']),
  body('style').optional().isString().trim().isLength({ max: 100 }),
  body('vibe').optional().isString().trim().isLength({ max: 100 }),
  body('accessories').optional().isBoolean(),
  body('colors').optional().isString().trim().isLength({ max: 200 }),
  body('extraNotes').optional().isString().trim().isLength({ max: 500 }),
  body('luxuryBudget').optional().isBoolean(),
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
