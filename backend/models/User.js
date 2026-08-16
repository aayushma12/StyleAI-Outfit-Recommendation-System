const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { STRONG_PASSWORD, PASSWORD_ERROR_MSG } = require('../utils/validation');

const BCRYPT_HASH_RE = /^\$2[aby]?\$\d{2}\$/;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
    // Enforced here (not just in controllers) so EVERY creation path — including
    // server.js's admin auto-seed, which previously bypassed the controller-level
    // check entirely — gets the same strength requirement. Already-hashed values
    // are allowed through unchanged so re-saving a loaded-but-unmodified document
    // (e.g. after a login-related update) never fails validation against its own hash.
    validate: {
      validator: (value) => BCRYPT_HASH_RE.test(value) || STRONG_PASSWORD.test(value),
      message: PASSWORD_ERROR_MSG,
    },
  },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say', ''], default: '' },
  age: { type: Number, min: 13, max: 80 },
  height: { type: Number },
  weight: { type: Number },
  skinTone: {
    type: String,
    enum: ['Fair', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'],
  },
  bodyType: {
    type: String,
    enum: ['hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle'],
  },
  stylePreferences: [{
    type: String,
    enum: ['casual', 'formal', 'traditional', 'western', 'fusion', 'sporty', 'bohemian', 'minimalist'],
  }],
  culturalBackground: { type: String, trim: true },
  occasionPreferences: [{
    type: String,
    enum: ['daily', 'college', 'office', 'festival', 'wedding', 'party', 'casual_outing', 'religious'],
  }],
  colorPreferences: [{ type: String }],
  budgetRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 10000 },
  },
  savedOutfits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeCombo' }],
  onboardingCompleted: { type: Boolean, default: false },
  username: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    unique: true,
    match: [/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3-20 characters: letters, numbers, underscores only'],
  },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  // Marks a persona-based synthetic training account (scripts/seedPersonaSyntheticBehavior.js)
  // so it can be filtered out of admin user lists/exports and cleanly removed later.
  isSyntheticPersona:        { type: Boolean, default: false, index: true },
  syntheticPersonaArchetype: { type: String,  default: '' },
  isBlocked: { type: Boolean, default: false },
  lastLogin: { type: Date },
  // Failed login tracking for account lockout
  loginAttempts: { type: Number, default: 0 },
  lockUntil:     { type: Date },
  // OAuth provider info
  provider:  { type: String, enum: ['local', 'google'], default: 'local' },
  googleId:  { type: String, sparse: true },
  // Optional profile fields
  phoneNumber: { type: String, trim: true, match: [/^\+?[\d\s\-().]{7,20}$/, 'Invalid phone number'] },
  consentGiven: { type: Boolean, default: false },
  consentDate: { type: Date },
  // OTP-based password reset (replaces the earlier link-token flow — real
  // email delivery of a 6-digit code the user types back in, verified and
  // consumed in one step alongside the new password). resetOtpAttempts caps
  // brute-force guesses against the 6-digit (1e6) keyspace within the OTP's
  // validity window — exceeding it invalidates the code, forcing a fresh one.
  resetOtp:          { type: String, select: false },
  resetOtpExpires:   { type: Date,   select: false },
  resetOtpAttempts:  { type: Number, select: false, default: 0 },
  notificationsEnabled: { type: Boolean, default: true },
  themePreference: { type: String, enum: ['light', 'dark'], default: 'light' },
  location: { type: String, trim: true, default: 'Kathmandu' },
  profilePhoto: { type: String, trim: true },

  occupation: { type: String, trim: true, maxlength: 100 },
  fashionStyles: [{
    type: String,
    enum: ['minimalist', 'streetwear', 'smart_casual', 'korean', 'vintage',
           'preppy', 'athleisure', 'romantic', 'edgy', 'boho', 'classic',
           'grunge', 'cottagecore', 'y2k', 'modest_chic'],
  }],
  clothingFit: {
    type: String,
    enum: ['fitted', 'regular', 'relaxed', 'oversized', 'mix'],
  },
  modestyLevel: {
    type: String,
    enum: ['conservative', 'moderate', 'open'],
  },
  dislikedColors: [{ type: String }],
  accessoryStyle: {
    type: String,
    enum: ['minimal', 'statement', 'traditional', 'layered', 'none'],
  },
  footwearPreferences: [{ type: String }],
  comfortPriority:   { type: Number, min: 1, max: 5, default: 3 },
  fashionConfidence: { type: Number, min: 1, max: 5, default: 3 },
  lifestyle: {
    type: String,
    enum: ['student', 'working_professional', 'homemaker', 'entrepreneur', 'mixed'],
  },
  additionalStyleNotes: { type: String, trim: true, maxlength: 500 },
  layeringPreference: { type: String, enum: ['minimal', 'moderate', 'heavy'] },
  seasonalPreference: [{ type: String, enum: ['winter', 'spring', 'monsoon', 'autumn', 'all'] }],
  frequentPlaces: [{
    type: String,
    enum: ['college', 'thamel', 'durbar_marg', 'patan', 'office', 'cafe', 'wedding', 'temple'],
  }],

  /* ── Extended personal profile ──────────────────────────────────────── */
  bio:               { type: String, trim: true, maxlength: 300 },
  dateOfBirth:       { type: Date },
  collegeUniversity: { type: String, trim: true, maxlength: 100 },

  /* ── Extended physical attributes ───────────────────────────────────── */
  hairColor:    { type: String, enum: ['black', 'brown', 'blonde', 'red', 'gray', 'white', 'auburn', 'other'] },
  hairLength:   { type: String, enum: ['short', 'medium', 'long', 'very_long'] },
  eyeColor:     { type: String, enum: ['black', 'brown', 'hazel', 'green', 'blue', 'gray', 'other'] },
  clothingSize: { type: String, enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  shoeSize:     { type: String, trim: true, maxlength: 10 },

  /* ── Extended wardrobe preferences ──────────────────────────────────── */
  fabricPreferences: [{
    type: String,
    enum: ['cotton', 'denim', 'silk', 'linen', 'wool', 'leather', 'polyester',
           'velvet', 'chiffon', 'georgette', 'rayon', 'satin', 'jersey'],
  }],
  favoriteOutfitTypes: [{
    type: String,
    enum: ['jeans', 'skirts', 'dresses', 'crop_tops', 'shirts', 't_shirts', 'hoodies',
           'sweaters', 'kurti', 'saree', 'lehenga', 'jumpsuit', 'coord_set',
           'oversized', 'ethnic', 'western'],
  }],

  /* ── Shopping habits ────────────────────────────────────────────────── */
  shoppingFrequency:         { type: String, enum: ['weekly', 'monthly', 'quarterly', 'seasonal', 'rarely'] },
  preferredShoppingLocation: { type: String, enum: ['online', 'offline', 'both'] },
  preferredBrands:           [{ type: String, trim: true }],
  luxuryVsBudget:            { type: String, enum: ['luxury', 'mid_range', 'budget', 'mix'] },

  /* ── Style confidence scores (1–10) ─────────────────────────────────── */
  fashionAdventurousness: { type: Number, min: 1, max: 10 },
  trendFollowing:         { type: Number, min: 1, max: 10 },

  /* ── Fashion inspiration ─────────────────────────────────────────────── */
  fashionInspiration: [{
    type: String,
    enum: ['pinterest', 'instagram', 'tiktok', 'celebrities', 'fashion_bloggers',
           'local_influencers', 'runway', 'friends', 'magazines'],
  }],
  favoriteCelebrities: [{ type: String, trim: true }],

  /* ── AI-generated profile summary ───────────────────────────────────── */
  aiSummary: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

// Virtual: true when account is within an active lockout period
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
