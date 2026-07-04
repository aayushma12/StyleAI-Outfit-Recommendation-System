const express = require('express');
const router = express.Router();
const { submitAppFeedback, getAppFeedback, getPublicTestimonials, getPublicStats } = require('../controllers/appFeedbackController');
const { protect } = require('../middleware/auth');

router.get('/public', getPublicTestimonials);
router.get('/public-stats', getPublicStats);
router.post('/', protect, submitAppFeedback);
router.get('/', protect, getAppFeedback);

module.exports = router;
