const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, completeOnboarding, getSavedOutfits, toggleSaved, changePassword, deleteAccount, updateConsent, getStats, updateThemePreference, getProfileCompletion } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/onboarding', protect, completeOnboarding);
router.get('/saved', protect, getSavedOutfits);
router.post('/saved/:outfitId', protect, toggleSaved);
router.put('/password', protect, changePassword);
router.put('/consent', protect, updateConsent);
router.delete('/account', protect, deleteAccount);
router.get('/stats', protect, getStats);
router.patch('/theme', protect, updateThemePreference);
router.get('/profile/completion', protect, getProfileCompletion);

module.exports = router;
