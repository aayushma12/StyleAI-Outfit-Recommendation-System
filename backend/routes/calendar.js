const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const ctrl = require('../controllers/calendarController');

// specific routes before /:id
router.get('/upcoming', protect, ctrl.getUpcoming);
router.get('/week',     protect, ctrl.getWeekEntries);
router.get('/suggest',  protect, ctrl.aiSuggest);
router.get('/',         protect, ctrl.getMonthEntries);
router.post('/',        protect, ctrl.upsertEntry);
router.delete('/:id',   protect, validateObjectId('id'), ctrl.deleteEntry);

module.exports = router;
