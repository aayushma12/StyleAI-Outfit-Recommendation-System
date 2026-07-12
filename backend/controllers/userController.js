const User          = require('../models/User');
const { STRONG_PASSWORD, PASSWORD_ERROR_MSG } = require('../utils/validation');
const WardrobeItem  = require('../models/WardrobeItem');
const WardrobeCombo = require('../models/WardrobeCombo');
const OutfitCalendar = require('../models/OutfitCalendar');
const UserHistory   = require('../models/UserHistory');
const AIConversation = require('../models/AIConversation');

exports.getProfile = async (req, res) => {
  res.json({ user: req.user });
};

exports.updateProfile = async (req, res) => {
  const allowedFields = [
    'name', 'age', 'gender', 'bodyType', 'skinTone', 'stylePreferences',
    'culturalBackground', 'occasionPreferences', 'colorPreferences', 'budgetRange', 'location',
    'occupation', 'fashionStyles', 'clothingFit', 'modestyLevel', 'dislikedColors',
    'accessoryStyle', 'footwearPreferences', 'comfortPriority', 'fashionConfidence',
    'lifestyle', 'additionalStyleNotes',
    /* Extended personal */
    'bio', 'dateOfBirth', 'collegeUniversity', 'username', 'phoneNumber', 'height', 'weight', 'profilePhoto',
    /* Extended physical */
    'hairColor', 'hairLength', 'eyeColor', 'clothingSize', 'shoeSize',
    /* Extended wardrobe */
    'fabricPreferences', 'favoriteOutfitTypes',
    /* Shopping */
    'shoppingFrequency', 'preferredShoppingLocation', 'preferredBrands', 'luxuryVsBudget',
    /* Confidence scores */
    'fashionAdventurousness', 'trendFollowing',
    /* Inspiration */
    'fashionInspiration', 'favoriteCelebrities',
    /* AI */
    'aiSummary',
  ];

  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // Sanitize string fields
  if (updates.name) updates.name = updates.name.trim().slice(0, 100);
  if (updates.location) updates.location = updates.location.trim().slice(0, 100);
  if (updates.bio) updates.bio = updates.bio.trim().slice(0, 300);

  // Username uniqueness check
  if (updates.username) {
    updates.username = updates.username.toLowerCase().trim();
    const existing = await User.findOne({ username: updates.username, _id: { $ne: req.user._id } });
    if (existing) return res.status(409).json({ message: 'That username is already taken.' });
  }

  // Validate age range
  if (updates.age !== undefined) {
    const age = Number(updates.age);
    if (isNaN(age) || age < 13 || age > 100) {
      return res.status(400).json({ message: 'Age must be between 13 and 100.' });
    }
    updates.age = age;
  }

  // Validate budget range
  if (updates.budgetRange) {
    const { min, max } = updates.budgetRange;
    if (Number(min) > Number(max)) {
      return res.status(400).json({ message: 'Budget minimum cannot exceed maximum.' });
    }
  }

  let user;
  try {
    user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
  } catch (err) {
    // The pre-check above is best-effort — a concurrent update can still race
    // past it, so the DB's unique index on username is the real guarantee.
    if (err.code === 11000) return res.status(409).json({ message: 'That username is already taken.' });
    throw err;
  }

  res.json({ user });
};

exports.getSavedOutfits = async (req, res) => {
  const user = await User.findById(req.user._id).populate('savedOutfits');
  res.json({ savedOutfits: user.savedOutfits || [] });
};

exports.toggleSaved = async (req, res) => {
  const { outfitId } = req.params;

  // Verify the outfit exists and belongs to this user
  const outfit = await WardrobeCombo.findOne({ _id: outfitId, user: req.user._id });
  if (!outfit) return res.status(404).json({ message: 'Outfit not found.' });

  const user = await User.findById(req.user._id);
  const idx  = user.savedOutfits.findIndex(id => id.toString() === outfitId);
  let saved;
  if (idx > -1) {
    user.savedOutfits.splice(idx, 1);
    saved = false;
  } else {
    user.savedOutfits.push(outfitId);
    saved = true;
  }
  await user.save();
  res.json({ saved, savedOutfits: user.savedOutfits });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current and new password are required.' });
  }

  if (!STRONG_PASSWORD.test(newPassword)) {
    return res.status(400).json({ message: PASSWORD_ERROR_MSG });
  }

  const user = await User.findById(req.user._id).select('+password');
  const match = await user.comparePassword(currentPassword);
  if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from your current password.' });
  }

  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated successfully.' });
};

exports.deleteAccount = async (req, res) => {
  const userId = req.user._id;
  // Cascade delete all user data
  await Promise.all([
    WardrobeItem.deleteMany({ user: userId }),
    WardrobeCombo.deleteMany({ user: userId }),
    OutfitCalendar.deleteMany({ user: userId }),
    UserHistory.deleteMany({ user: userId }),
    AIConversation.deleteMany({ user: userId }),
    User.findByIdAndDelete(userId),
  ]);
  res.json({ message: 'Account and all associated data deleted.' });
};

exports.getStats = async (req, res) => {
  const [wardrobeCount, savedOutfitCount] = await Promise.all([
    WardrobeItem.countDocuments({ user: req.user._id }),
    WardrobeCombo.countDocuments({ user: req.user._id }),
  ]);
  res.json({ wardrobeCount, savedOutfitCount });
};

exports.updateThemePreference = async (req, res) => {
  const { theme } = req.body;
  if (!['light', 'dark'].includes(theme)) {
    return res.status(400).json({ message: 'Invalid theme value.' });
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { themePreference: theme },
    { new: true }
  );
  res.json({ themePreference: user.themePreference });
};

exports.updateConsent = async (req, res) => {
  const { consentGiven } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { consentGiven, consentDate: consentGiven ? new Date() : undefined },
    { new: true }
  );
  res.json({ user });
};

const COMPLETION_FIELDS = [
  'name', 'email', 'bio', 'dateOfBirth', 'gender', 'age', 'location', 'occupation',
  'phoneNumber', 'height', 'weight', 'bodyType', 'skinTone', 'clothingSize', 'hairColor',
  'lifestyle', 'shoppingFrequency', 'preferredShoppingLocation',
];
const COMPLETION_ARRAYS = [
  'fashionStyles', 'stylePreferences', 'colorPreferences', 'fabricPreferences',
  'favoriteOutfitTypes', 'occasionPreferences', 'fashionInspiration',
];

exports.getProfileCompletion = async (req, res) => {
  const u = req.user;
  let filled = 0;
  const total = COMPLETION_FIELDS.length + COMPLETION_ARRAYS.length;
  COMPLETION_FIELDS.forEach(f => { if (u[f]) filled++; });
  COMPLETION_ARRAYS.forEach(f => { if (u[f]?.length > 0) filled++; });
  res.json({ score: Math.round((filled / total) * 100), filled, total });
};

exports.completeOnboarding = async (req, res) => {
  const {
    age, height, weight, skinTone, bodyType,
    stylePreferences, culturalBackground, occasionPreferences,
    colorPreferences, budgetRange,
    /* Extended style profile fields */
    occupation, fashionStyles, clothingFit, modestyLevel, dislikedColors,
    accessoryStyle, footwearPreferences, comfortPriority, fashionConfidence,
    lifestyle, additionalStyleNotes,
  } = req.body;

  // bodyType is collected once at registration (Register.jsx) and isn't asked
  // again by the style quiz (Onboarding.jsx), which only has the *current*
  // user's bodyType to pass through. Any account that reaches this endpoint
  // without one yet (e.g. registration succeeded but the initial onboarding
  // call didn't complete) must still be able to save the rest of its style
  // profile — hard-rejecting the whole request left those users permanently
  // unable to complete onboarding. bodyTypeScore() in fashionRulesEngine.js
  // already degrades gracefully to a neutral score when it's unset.
  const updates = {
    age, stylePreferences, culturalBackground,
    occasionPreferences, colorPreferences, budgetRange,
    onboardingCompleted: true,
  };
  if (bodyType          !== undefined) updates.bodyType          = bodyType;
  if (height            !== undefined) updates.height            = height;
  if (weight            !== undefined) updates.weight            = weight;
  if (skinTone          !== undefined) updates.skinTone          = skinTone;
  if (occupation        !== undefined) updates.occupation        = occupation;
  if (fashionStyles     !== undefined) updates.fashionStyles     = fashionStyles;
  if (clothingFit       !== undefined) updates.clothingFit       = clothingFit;
  if (modestyLevel      !== undefined) updates.modestyLevel      = modestyLevel;
  if (dislikedColors    !== undefined) updates.dislikedColors    = dislikedColors;
  if (accessoryStyle    !== undefined) updates.accessoryStyle    = accessoryStyle;
  if (footwearPreferences !== undefined) updates.footwearPreferences = footwearPreferences;
  if (comfortPriority   !== undefined) updates.comfortPriority   = comfortPriority;
  if (fashionConfidence !== undefined) updates.fashionConfidence = fashionConfidence;
  if (lifestyle         !== undefined) updates.lifestyle         = lifestyle;
  if (additionalStyleNotes !== undefined) updates.additionalStyleNotes = additionalStyleNotes;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  );

  res.json({ user, message: 'Style profile created successfully' });
};
