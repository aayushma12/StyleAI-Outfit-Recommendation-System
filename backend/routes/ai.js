const express     = require('express');
const router      = express.Router();
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const ctrl        = require('../controllers/aiController');

const checkId = validateObjectId('id');

router.get('/provider',                     protect, ctrl.getProvider);
router.get('/conversations',                protect, ctrl.getConversations);
router.get('/conversations/search',         protect, ctrl.searchConversations);
router.get('/conversations/:id',            protect, checkId, ctrl.getConversation);
router.get('/conversations/:id/export',     protect, checkId, ctrl.exportConversation);
router.post('/chat',                        protect, ctrl.sendMessage);
router.patch('/conversations/:id/title',   protect, checkId, ctrl.renameConversation);
router.delete('/conversations/:id',         protect, checkId, ctrl.deleteConversation);

module.exports = router;
