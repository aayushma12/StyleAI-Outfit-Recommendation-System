const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const ctrl = require('../controllers/wardrobeController');
const { isAllowedImageUrl } = require('../utils/urlSafety');

const checkId = validateObjectId('id');

const CATEGORIES = ['tops', 'bottoms', 'dresses', 'jackets', 'footwear', 'accessories', 'traditional'];

const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Create requires the three mandatory fields; update is partial (the controller
// only writes whatever fields are present in the body), so every field there
// must be `.optional()` — validated when present, never required.
const validateItemCreateBody = [
  body('name').trim().notEmpty().withMessage('Item name is required.').isLength({ max: 100 }),
  body('category').trim().isIn(CATEGORIES).withMessage(`category must be one of: ${CATEGORIES.join(', ')}`),
  body('color').trim().notEmpty().withMessage('Color is required.').isLength({ max: 50 }),
  body('occasion').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('season').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('imageUrl').optional({ checkFalsy: true }).trim()
    .custom(isAllowedImageUrl).withMessage('imageUrl must be a Cloudinary-hosted image URL.'),
  checkValidation,
];

const validateItemUpdateBody = [
  body('name').optional({ checkFalsy: true }).trim().notEmpty().isLength({ max: 100 }),
  body('category').optional({ checkFalsy: true }).trim().isIn(CATEGORIES).withMessage(`category must be one of: ${CATEGORIES.join(', ')}`),
  body('color').optional({ checkFalsy: true }).trim().notEmpty().isLength({ max: 50 }),
  body('occasion').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('season').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('imageUrl').optional({ checkFalsy: true }).trim()
    .custom(isAllowedImageUrl).withMessage('imageUrl must be a Cloudinary-hosted image URL.'),
  checkValidation,
];

const validateAnalyzeBody = [
  body('imageUrl').trim().notEmpty().withMessage('imageUrl is required.')
    .custom(isAllowedImageUrl).withMessage('imageUrl must be a Cloudinary-hosted image URL.'),
  body('category').optional({ checkFalsy: true }).trim().isIn(CATEGORIES),
  checkValidation,
];

// Wardrobe items
router.post('/analyze', protect, validateAnalyzeBody, ctrl.analyzeImage);
router.get('/stats',    protect, ctrl.getStats);
router.get('/',         protect, ctrl.getItems);
router.get('/:id',      protect, checkId, ctrl.getItem);
router.post('/',        protect, validateItemCreateBody, ctrl.createItem);
router.put('/:id',      protect, checkId, validateItemUpdateBody, ctrl.updateItem);
router.delete('/:id',   protect, checkId, ctrl.deleteItem);

// Saved outfits (outfit builder combos)
router.post('/outfits/save',      protect, ctrl.saveCombination);
router.get('/outfits/saved',      protect, ctrl.getSavedCombinations);
router.get('/outfits/:id',        protect, checkId, ctrl.getCombo);
router.put('/outfits/:id',        protect, checkId, ctrl.updateCombo);
router.delete('/outfits/:id',     protect, checkId, ctrl.deleteCombo);
router.post('/outfits/:id/reuse', protect, checkId, ctrl.reuseCombo);

module.exports = router;
