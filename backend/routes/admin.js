'use strict';

const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const { protect }   = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');
const ctrl = require('../controllers/adminController');

const guard  = [protect, adminOnly];
const checkId = validateObjectId('id');

const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const validateUpdateUserBody = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ min: 1, max: 100 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'inactive', 'suspended']),
  checkValidation,
];

const validateAdminProfileBody = [
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
  checkValidation,
];

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get('/stats',                          ...guard, ctrl.getStats);
router.get('/analytics',                      ...guard, ctrl.getAnalytics);

// ── User Management ────────────────────────────────────────────────────────────
router.get('/users',                          ...guard, ctrl.getUsers);
router.get('/users/:id',                      ...guard, checkId, ctrl.getUserDetail);
router.patch('/users/:id',                    ...guard, checkId, validateUpdateUserBody, ctrl.updateUser);
router.patch('/users/:id/suspend',            ...guard, checkId, ctrl.suspendUser);
router.patch('/users/:id/activate',           ...guard, checkId, ctrl.activateUser);
router.delete('/users/:id',                   ...guard, checkId, ctrl.deleteUser);

// ── Wardrobe Monitoring ────────────────────────────────────────────────────────
router.get('/wardrobe',                       ...guard, ctrl.getWardrobeItems);
router.delete('/wardrobe/:id',                ...guard, checkId, ctrl.deleteWardrobeItem);

// ── Saved Outfits Monitoring ───────────────────────────────────────────────────
router.get('/saved-outfits',                  ...guard, ctrl.getSavedOutfits);
router.delete('/saved-outfits/:id',           ...guard, checkId, ctrl.deleteSavedOutfit);

// ── Calendar Monitoring ────────────────────────────────────────────────────────
router.get('/calendar',                       ...guard, ctrl.getCalendarEntries);
router.delete('/calendar/:id',                ...guard, checkId, ctrl.deleteCalendarEntry);

// ── Feedback Management ────────────────────────────────────────────────────────
router.get('/feedback',                       ...guard, ctrl.getFeedback);
router.patch('/feedback/:id/approve',         ...guard, checkId, ctrl.approveFeedback);
router.patch('/feedback/:id/resolve',         ...guard, checkId, ctrl.resolveFeedback);
router.delete('/feedback/:id',                ...guard, checkId, ctrl.deleteFeedback);

// ── Activity Logs ──────────────────────────────────────────────────────────────
router.get('/logs',                           ...guard, ctrl.getActivityLogs);

// ── Admin Account Settings ─────────────────────────────────────────────────────
router.put('/profile',                        ...guard, validateAdminProfileBody, ctrl.updateAdminProfile);
router.put('/password',                       ...guard, ctrl.changeAdminPassword);

// ── Outfit Catalog Management ──────────────────────────────────────────────────
router.get('/outfits',                        ...guard, ctrl.getCatalogOutfits);
router.get('/outfits/:id',                    ...guard, checkId, ctrl.getCatalogOutfit);
router.post('/outfits',                       ...guard, ctrl.createCatalogOutfit);
router.put('/outfits/:id',                    ...guard, checkId, ctrl.updateCatalogOutfit);
router.delete('/outfits/:id',                 ...guard, checkId, ctrl.deleteCatalogOutfit);
router.patch('/outfits/:id/approve',          ...guard, checkId, ctrl.approveCatalogOutfit);

// ── Kathmandu Intelligence Management ─────────────────────────────────────────
router.get('/kathmandu/trends',               ...guard, ctrl.getKathmanduTrends);
router.post('/kathmandu/trends',              ...guard, ctrl.createKathmanduTrend);
router.put('/kathmandu/trends/:id',           ...guard, checkId, ctrl.updateKathmanduTrend);
router.delete('/kathmandu/trends/:id',        ...guard, checkId, ctrl.deleteKathmanduTrend);

// ── Recommendation Management ──────────────────────────────────────────────────
router.get('/recommendations',                ...guard, ctrl.getRecommendationLogs);
router.get('/rec-analytics',                  ...guard, ctrl.getRecAnalytics);

// ── ML Model Management ────────────────────────────────────────────────────────
router.get('/ml/info',                        ...guard, ctrl.getMLModelInfo);
router.post('/ml/retrain',                    ...guard, ctrl.retrainMLModel);
router.get('/ml/ranking-metrics',             ...guard, ctrl.getRankingMetrics);
router.get('/wardrobe/ai-coverage',           ...guard, ctrl.getWardrobeAIMetaCoverage);
router.post('/wardrobe/ai-backfill',          ...guard, ctrl.runWardrobeBackfill);

// ── Reports & Export ───────────────────────────────────────────────────────────
router.get('/reports/users',                  ...guard, ctrl.exportUsers);
router.get('/reports/recommendations',        ...guard, ctrl.exportRecommendations);

module.exports = router;
