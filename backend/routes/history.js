const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const ctrl       = require('../controllers/historyController');

router.get('/analytics', protect, ctrl.getAnalytics);
router.get('/',          protect, ctrl.getHistory);
router.delete('/bulk',   protect, ctrl.bulkDelete);
router.delete('/:id',    protect, validateObjectId('id'), ctrl.deleteEntry);

module.exports = router;
