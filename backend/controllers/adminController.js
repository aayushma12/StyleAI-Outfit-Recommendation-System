'use strict';

const mongoose        = require('mongoose');
const cloudinary      = require('../config/cloudinary');
const User            = require('../models/User');
const WardrobeItem    = require('../models/WardrobeItem');
const WardrobeCombo   = require('../models/WardrobeCombo');
const AppFeedback     = require('../models/AppFeedback');
const OutfitCalendar  = require('../models/OutfitCalendar');
const ActivityLog     = require('../models/ActivityLog');
const Outfit          = require('../models/Outfit');
const KathmanduTrend  = require('../models/KathmanduTrend');
const Recommendation  = require('../models/Recommendation');
const BehaviorLog     = require('../models/BehaviorLog');
const AIConversation  = require('../models/AIConversation');
const UserHistory     = require('../models/UserHistory');
const UserSimilarity  = require('../models/UserSimilarity');
const EvaluationResponse = require('../models/EvaluationResponse');
const axios           = require('axios');
const { STRONG_PASSWORD, PASSWORD_ERROR_MSG, escapeRegex } = require('../utils/validation');
const { getLastNMonthRanges } = require('../utils/dateRanges');
const visionExtraction = require('../services/visionExtractionService');

const ML_SERVICE = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const log = (action, category = 'system', detail = '', userId = null) =>
  ActivityLog.create({ action, category, detail, user: userId }).catch(() => {});

// Admin edit forms mass-assign whatever fields are present in req.body onto
// a Mongoose document before saving — a bad enum value or wrong type would
// otherwise reach the global error handler as an uncaught ValidationError/
// CastError (a raw 500 instead of a clean 400). Returns true on success;
// on failure it sends the 400 response itself and returns false so the
// caller can bail out.
async function saveOrRespondInvalid(doc, res) {
  try {
    await doc.save();
    return true;
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      res.status(400).json({ message: err.message });
      return false;
    }
    throw err;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

exports.getStats = async (req, res) => {
  const [
    totalUsers, activeUsers, suspendedUsers,
    totalWardrobeItems, totalSavedOutfits,
    totalFeedbacks, pendingFeedbacks, totalCalendarEntries,
    totalCatalogOutfits,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'user', isBlocked: { $ne: true }, status: { $ne: 'suspended' } }),
    User.countDocuments({ role: 'user', $or: [{ isBlocked: true }, { status: 'suspended' }] }),
    WardrobeItem.countDocuments(),
    WardrobeCombo.countDocuments(),
    AppFeedback.countDocuments(),
    AppFeedback.countDocuments({ status: 'pending' }),
    OutfitCalendar.countDocuments(),
    Outfit.countDocuments({ isActive: true }),
  ]);

  res.json({
    stats: {
      totalUsers, activeUsers, suspendedUsers,
      totalWardrobeItems, totalSavedOutfits,
      totalFeedbacks, pendingFeedbacks, totalCalendarEntries,
      totalCatalogOutfits,
    },
  });
};

exports.getAnalytics = async (req, res) => {
  const monthly = await Promise.all(getLastNMonthRanges(6).map(async ({ start, end, label }) => {
    const [users, wardrobeItems, outfits] = await Promise.all([
      User.countDocuments({ role: 'user', createdAt: { $gte: start, $lte: end } }),
      WardrobeItem.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      WardrobeCombo.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ]);
    return { month: label, users, wardrobeItems, outfits };
  }));
  res.json({ monthly });
};

// ── User Management ───────────────────────────────────────────────────────────

exports.getUsers = async (req, res) => {
  const { page = 1, limit = 12, search = '', sort = 'createdAt', sortDir = 'desc', status = '' } = req.query;
  const query = { role: { $ne: 'admin' } };
  // search and status=suspended each need their own $or clause — combine via
  // $and instead of assigning query.$or twice (the second assignment used to
  // silently clobber the first, dropping the search term whenever both were
  // supplied together).
  const andConditions = [];

  if (search) andConditions.push({
    $or: [
      { name:  { $regex: escapeRegex(search), $options: 'i' } },
      { email: { $regex: escapeRegex(search), $options: 'i' } },
    ],
  });

  if (status === 'suspended') {
    andConditions.push({ $or: [{ isBlocked: true }, { status: 'suspended' }] });
  } else if (status === 'active') {
    query.isBlocked = { $ne: true };
    query.status    = { $ne: 'suspended' };
  }

  if (andConditions.length) query.$and = andConditions;

  const [users, total] = await Promise.all([
    User.find(query).select('-password')
      .sort({ [sort]: sortDir === 'asc' ? 1 : -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    User.countDocuments(query),
  ]);
  res.json({ users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

exports.getUserDetail = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const [wardrobeCount, outfitCount, calendarCount] = await Promise.all([
    WardrobeItem.countDocuments({ user: user._id }),
    WardrobeCombo.countDocuments({ user: user._id }),
    OutfitCalendar.countDocuments({ user: user._id }),
  ]);
  res.json({ user, wardrobeCount, outfitCount, calendarCount });
};

exports.updateUser = async (req, res) => {
  // Note: role is intentionally not accepted here — role changes aren't
  // supported through this endpoint (there is no admin-promotion flow).
  const { name, email, status } = req.body;
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'admin') return res.status(403).json({ message: 'Cannot edit the administrator account from here.' });

  if (name)  user.name  = name.trim().slice(0, 100);
  if (email) {
    const exists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (exists) return res.status(409).json({ message: 'Email already in use.' });
    user.email = email.toLowerCase();
  }
  if (status && ['active', 'inactive', 'suspended'].includes(status)) {
    user.status    = status;
    user.isBlocked = status === 'suspended';
  }
  await user.save();
  log(`User "${user.name}" updated`, 'users', user.email, req.user._id);
  res.json({ user });
};

exports.suspendUser = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'admin') return res.status(403).json({ message: 'Cannot suspend the administrator.' });

  user.isBlocked = true;
  user.status    = 'suspended';
  await user.save();
  log(`User "${user.name}" suspended`, 'users', user.email, req.user._id);
  res.json({ user, suspended: true });
};

exports.activateUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: false, status: 'active' },
    { new: true }
  ).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  log(`User "${user.name}" reactivated`, 'users', user.email, req.user._id);
  res.json({ user });
};

exports.deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete the administrator account.' });

  const items = await WardrobeItem.find({ user: user._id, publicId: { $exists: true, $ne: '' } });
  await Promise.all(items.map(item => cloudinary.uploader.destroy(item.publicId).catch(() => {})));

  await Promise.all([
    WardrobeItem.deleteMany({ user: user._id }),
    WardrobeCombo.deleteMany({ user: user._id }),
    OutfitCalendar.deleteMany({ user: user._id }),
    AppFeedback.deleteMany({ user: user._id }),
    Recommendation.deleteMany({ user: user._id }),
    BehaviorLog.deleteMany({ user: user._id }),
    AIConversation.deleteMany({ user: user._id }),
    UserHistory.deleteMany({ user: user._id }),
    UserSimilarity.deleteMany({ $or: [{ baseUser: user._id }, { similarUser: user._id }] }),
  ]);

  log(`User "${user.name}" permanently deleted`, 'users', user.email, req.user._id);
  await User.findByIdAndDelete(user._id);
  res.json({ message: 'User and all associated data deleted.' });
};

// ── Wardrobe Monitoring ───────────────────────────────────────────────────────

exports.getWardrobeItems = async (req, res) => {
  const { page = 1, limit = 16, search = '', category = '', userId = '' } = req.query;
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid userId.' });
  }
  const query = {};
  if (userId)   query.user     = userId;
  if (category) query.category = category;
  if (search)   query.name     = { $regex: escapeRegex(search), $options: 'i' };

  const [items, total] = await Promise.all([
    WardrobeItem.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    WardrobeItem.countDocuments(query),
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

exports.deleteWardrobeItem = async (req, res) => {
  const item = await WardrobeItem.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  if (item.publicId) { try { await cloudinary.uploader.destroy(item.publicId); } catch { /* best-effort cleanup — DB delete already succeeded */ } }
  log(`Wardrobe item "${item.name}" deleted`, 'wardrobe', item.category, req.user._id);
  res.json({ message: 'Wardrobe item deleted.' });
};

exports.getSavedOutfits = async (req, res) => {
  const { page = 1, limit = 12, search = '' } = req.query;
  const query = {};
  if (search) query.name = { $regex: escapeRegex(search), $options: 'i' };

  const [combinations, total] = await Promise.all([
    WardrobeCombo.find(query)
      .populate('user', 'name email')
      .populate('items', 'name category color imageUrl')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    WardrobeCombo.countDocuments(query),
  ]);
  res.json({ combinations, total, pages: Math.ceil(total / Number(limit)) });
};

exports.deleteSavedOutfit = async (req, res) => {
  const combo = await WardrobeCombo.findByIdAndDelete(req.params.id);
  if (!combo) return res.status(404).json({ message: 'Outfit not found.' });
  log(`Saved outfit "${combo.name || 'Untitled'}" deleted`, 'wardrobe', '', req.user._id);
  res.json({ message: 'Outfit deleted.' });
};

// ── Calendar Monitoring ───────────────────────────────────────────────────────

exports.getCalendarEntries = async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;

  let userIds;
  if (search) {
    const matchedUsers = await User.find({
      $or: [
        { name:  { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } },
      ],
    }).select('_id').lean();
    userIds = matchedUsers.map(u => u._id);
  }

  const query = {};
  if (search) {
    query.$or = [
      { outfitName: { $regex: escapeRegex(search), $options: 'i' } },
      ...(userIds?.length ? [{ user: { $in: userIds } }] : []),
    ];
  }

  const [entries, total] = await Promise.all([
    OutfitCalendar.find(query)
      .populate('user', 'name email')
      .populate('combo', 'name')
      .sort({ date: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    OutfitCalendar.countDocuments(query),
  ]);
  res.json({ entries, total, pages: Math.ceil(total / Number(limit)) });
};

exports.deleteCalendarEntry = async (req, res) => {
  const entry = await OutfitCalendar.findByIdAndDelete(req.params.id);
  if (!entry) return res.status(404).json({ message: 'Entry not found.' });
  log('Calendar entry deleted', 'system', entry.outfitName || '', req.user._id);
  res.json({ message: 'Calendar entry deleted.' });
};

// ── Feedback Management ───────────────────────────────────────────────────────

exports.getFeedback = async (req, res) => {
  const { status = '', page = 1, limit = 15 } = req.query;
  const query = {};
  if (status) query.status = status;

  const [feedback, total] = await Promise.all([
    AppFeedback.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    AppFeedback.countDocuments(query),
  ]);
  res.json({ feedback, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

exports.approveFeedback = async (req, res) => {
  const fb = await AppFeedback.findByIdAndUpdate(
    req.params.id,
    { status: 'reviewed', isPublic: true },
    { new: true }
  ).populate('user', 'name email');
  if (!fb) return res.status(404).json({ message: 'Feedback not found.' });
  log('Feedback approved and published', 'feedback', fb.user?.name || '', req.user._id);
  res.json({ feedback: fb });
};

exports.resolveFeedback = async (req, res) => {
  const fb = await AppFeedback.findByIdAndUpdate(
    req.params.id,
    { status: 'resolved' },
    { new: true }
  ).populate('user', 'name email');
  if (!fb) return res.status(404).json({ message: 'Feedback not found.' });
  log('Feedback resolved', 'feedback', fb.user?.name || '', req.user._id);
  res.json({ feedback: fb });
};

exports.deleteFeedback = async (req, res) => {
  const fb = await AppFeedback.findByIdAndDelete(req.params.id);
  if (!fb) return res.status(404).json({ message: 'Feedback not found.' });
  log('Feedback deleted', 'feedback', fb.message?.slice(0, 40) || '', req.user._id);
  res.json({ message: 'Feedback deleted.' });
};

// ── Activity Logs ─────────────────────────────────────────────────────────────

exports.getActivityLogs = async (req, res) => {
  const { page = 1, limit = 20, search = '', category = '' } = req.query;
  const query = {};
  if (category) query.category = category;
  if (search) query.$or = [
    { action: { $regex: escapeRegex(search), $options: 'i' } },
    { detail: { $regex: escapeRegex(search), $options: 'i' } },
  ];

  const [logs, total] = await Promise.all([
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    ActivityLog.countDocuments(query),
  ]);
  res.json({ logs, total, pages: Math.ceil(total / Number(limit)) });
};

// ── Admin Settings ────────────────────────────────────────────────────────────

exports.updateAdminProfile = async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });

  const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.user._id } });
  if (existing) return res.status(409).json({ message: 'Email is already in use.' });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name: name.trim(), email: email.toLowerCase().trim() },
    { new: true }
  ).select('-password');
  log('Admin profile updated', 'system', email, req.user._id);
  res.json({ user, message: 'Profile updated successfully.' });
};

exports.changeAdminPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords are required.' });

  if (!STRONG_PASSWORD.test(newPassword)) {
    return res.status(400).json({ message: PASSWORD_ERROR_MSG });
  }

  const user = await User.findById(req.user._id).select('+password');
  const match = await user.comparePassword(currentPassword);
  if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different.' });
  }

  user.password = newPassword;
  await user.save();
  log('Admin password changed', 'system', '', req.user._id);
  res.json({ message: 'Password changed successfully.' });
};

// ── Outfit Catalog Management ─────────────────────────────────────────────────

exports.getCatalogOutfits = async (req, res) => {
  const { page = 1, limit = 16, search = '', category = '', occasion = '', season = '', isActive = '' } = req.query;
  const query = {};
  if (search)   query.name     = { $regex: escapeRegex(search), $options: 'i' };
  if (category) query.category = category;
  if (occasion) query.occasion = occasion;
  if (season)   query.season   = season;
  if (isActive !== '') query.isActive = isActive === 'true';

  const [outfits, total] = await Promise.all([
    Outfit.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    Outfit.countDocuments(query),
  ]);
  res.json({ outfits, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

exports.getCatalogOutfit = async (req, res) => {
  const outfit = await Outfit.findById(req.params.id).lean();
  if (!outfit) return res.status(404).json({ message: 'Outfit not found.' });
  res.json({ outfit });
};

exports.createCatalogOutfit = async (req, res) => {
  const {
    name, description, category, style, occasion, season,
    colors, fabric, brand, price, imageUrl, publicId, imageVerified, tags,
  } = req.body;

  if (!name || !category) return res.status(400).json({ message: 'Name and category are required.' });

  const outfit = await Outfit.create({
    name: name.trim(),
    description: (description || '').trim(),
    category,
    style:    Array.isArray(style)    ? style    : [],
    occasion: Array.isArray(occasion) ? occasion : [],
    season:   Array.isArray(season)   ? season   : [],
    colors:   Array.isArray(colors)   ? colors   : [],
    fabric:   (fabric  || '').trim(),
    brand:    (brand   || '').trim(),
    price:    price != null ? Number(price) : null,
    imageUrl: (imageUrl || '').trim(),
    publicId: (publicId || '').trim(),
    // Only trustable when explicitly true (a real upload, or an admin's
    // explicit manual-URL confirmation) — never inferred from imageUrl being
    // present, since a pasted URL alone proves nothing about its accuracy.
    imageVerified: imageVerified === true,
    tags:     Array.isArray(tags) ? tags : [],
    addedBy:  req.user._id,
  });

  log(`Catalog outfit "${outfit.name}" created`, 'system', outfit.category, req.user._id);
  res.status(201).json({ outfit });
};

exports.updateCatalogOutfit = async (req, res) => {
  const outfit = await Outfit.findById(req.params.id);
  if (!outfit) return res.status(404).json({ message: 'Outfit not found.' });

  const fields = ['name', 'description', 'category', 'style', 'occasion', 'season',
    'colors', 'fabric', 'brand', 'price', 'imageUrl', 'publicId', 'imageVerified', 'tags', 'isApproved', 'isActive', 'popularity'];

  fields.forEach(f => {
    if (req.body[f] !== undefined) outfit[f] = req.body[f];
  });

  if (!(await saveOrRespondInvalid(outfit, res))) return;
  log(`Catalog outfit "${outfit.name}" updated`, 'system', outfit.category, req.user._id);
  res.json({ outfit });
};

exports.deleteCatalogOutfit = async (req, res) => {
  const outfit = await Outfit.findByIdAndDelete(req.params.id);
  if (!outfit) return res.status(404).json({ message: 'Outfit not found.' });
  if (outfit.publicId) { try { await cloudinary.uploader.destroy(outfit.publicId); } catch { /* best-effort cleanup — DB delete already succeeded */ } }
  log(`Catalog outfit "${outfit.name}" deleted`, 'system', outfit.category, req.user._id);
  res.json({ message: 'Outfit deleted from catalog.' });
};

exports.approveCatalogOutfit = async (req, res) => {
  const outfit = await Outfit.findByIdAndUpdate(
    req.params.id,
    { isApproved: true, isActive: true },
    { new: true }
  );
  if (!outfit) return res.status(404).json({ message: 'Outfit not found.' });
  log(`Catalog outfit "${outfit.name}" approved`, 'system', outfit.category, req.user._id);
  res.json({ outfit });
};

// ── Kathmandu Intelligence Management ────────────────────────────────────────

exports.getKathmanduTrends = async (req, res) => {
  const { page = 1, limit = 20, type = '', isActive = '' } = req.query;
  const query = {};
  if (type)     query.type     = type;
  if (isActive !== '') query.isActive = isActive === 'true';

  const [trends, total] = await Promise.all([
    KathmanduTrend.find(query)
      .sort({ popularity: -1, createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    KathmanduTrend.countDocuments(query),
  ]);
  res.json({ trends, total, pages: Math.ceil(total / Number(limit)) });
};

exports.createKathmanduTrend = async (req, res) => {
  const {
    name, type, description, fashionNote, season, occasion, venue,
    colors, styles, festivalMonth, isTraditional, popularity, imageUrl, tags,
  } = req.body;

  if (!name || !type) return res.status(400).json({ message: 'Name and type are required.' });

  const trend = await KathmanduTrend.create({
    name: name.trim(),
    type,
    description:   (description || '').trim(),
    fashionNote:   (fashionNote || '').trim(),
    season:        Array.isArray(season)  ? season  : [],
    occasion:      Array.isArray(occasion) ? occasion : [],
    venue:         Array.isArray(venue)   ? venue   : [],
    colors:        Array.isArray(colors)  ? colors  : [],
    styles:        Array.isArray(styles)  ? styles  : [],
    festivalMonth: festivalMonth ? Number(festivalMonth) : null,
    isTraditional: !!isTraditional,
    popularity:    popularity != null ? Number(popularity) : 50,
    imageUrl:      (imageUrl || '').trim(),
    tags:          Array.isArray(tags) ? tags : [],
  });

  log(`Kathmandu trend "${trend.name}" created`, 'system', trend.type, req.user._id);
  res.status(201).json({ trend });
};

exports.updateKathmanduTrend = async (req, res) => {
  const trend = await KathmanduTrend.findById(req.params.id);
  if (!trend) return res.status(404).json({ message: 'Trend not found.' });

  const fields = ['name', 'type', 'description', 'fashionNote', 'season', 'occasion', 'venue',
    'colors', 'styles', 'festivalMonth', 'isTraditional', 'popularity', 'isActive', 'imageUrl', 'tags'];

  fields.forEach(f => {
    if (req.body[f] !== undefined) trend[f] = req.body[f];
  });

  if (!(await saveOrRespondInvalid(trend, res))) return;
  log(`Kathmandu trend "${trend.name}" updated`, 'system', trend.type, req.user._id);
  res.json({ trend });
};

exports.deleteKathmanduTrend = async (req, res) => {
  const trend = await KathmanduTrend.findByIdAndDelete(req.params.id);
  if (!trend) return res.status(404).json({ message: 'Trend not found.' });
  log(`Kathmandu trend "${trend.name}" deleted`, 'system', trend.type, req.user._id);
  res.json({ message: 'Trend deleted.' });
};

// ── Recommendation Management ─────────────────────────────────────────────────

exports.getRecommendationLogs = async (req, res) => {
  const { page = 1, limit = 15, occasion = '', userId = '', status = '' } = req.query;
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid userId.' });
  }

  const query = {};
  if (occasion) query['context.occasion'] = occasion;
  if (userId)   query.user = userId;
  if (status)   query.status = status;

  const [sessions, total] = await Promise.all([
    Recommendation.find(query)
      .populate('user', 'name email')
      .select('user context.occasion status createdAt recommendations.confidence recommendations.status recommendations.category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    Recommendation.countDocuments(query),
  ]);

  res.json({ sessions, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

exports.getRecAnalytics = async (req, res) => {
  // Recommendation sessions grow unboundedly with usage (one document per
  // generation, forever) — capped with a recency bias rather than left
  // unbounded, matching the safety cap already used by exportRecommendations.
  const sessions = await Recommendation.find(
    { status: 'complete' },
    { recommendations: 1, context: 1, createdAt: 1 }
  ).sort({ createdAt: -1 }).limit(5000).lean();

  const allRecs = sessions.flatMap(s =>
    (s.recommendations || []).map(r => ({
      ...r,
      occasion:  s.context?.occasion,
      createdAt: s.createdAt,
    }))
  );

  const statusCounts = { pending: 0, worn: 0, saved: 0, liked: 0, disliked: 0, skipped: 0 };
  allRecs.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  const positive = statusCounts.worn + statusCounts.saved + statusCounts.liked;
  const total    = allRecs.length;

  const avgConfidence = total > 0
    ? Math.round(allRecs.reduce((s, r) => s + (r.confidence || 75), 0) / total)
    : 0;

  const confDist = { high: 0, medium: 0, low: 0 };
  allRecs.forEach(r => {
    const c = r.confidence || 75;
    if (c >= 85)     confDist.high++;
    else if (c >= 70) confDist.medium++;
    else              confDist.low++;
  });

  const byOccasion = {};
  sessions.forEach(s => {
    const occ = s.context?.occasion || 'unknown';
    if (!byOccasion[occ]) byOccasion[occ] = { sessions: 0, accepted: 0, total: 0 };
    byOccasion[occ].sessions++;
    (s.recommendations || []).forEach(r => {
      byOccasion[occ].total++;
      if (['worn', 'liked', 'saved'].includes(r.status)) byOccasion[occ].accepted++;
    });
  });

  const byCategory = {};
  allRecs.forEach(r => {
    const cat = r.category || 'unknown';
    if (!byCategory[cat]) byCategory[cat] = { count: 0, positive: 0, totalConf: 0, label: r.categoryLabel || cat };
    byCategory[cat].count++;
    byCategory[cat].totalConf += r.confidence || 75;
    if (['worn', 'liked', 'saved'].includes(r.status)) byCategory[cat].positive++;
  });

  const reasonCounts = {};
  allRecs.forEach(r => {
    (r.feedbackReasons || []).forEach(reason => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
  });

  const monthly = getLastNMonthRanges(6).map(({ start, end, label }) => {
    const monthSessions = sessions.filter(s => {
      const d = new Date(s.createdAt);
      return d >= start && d <= end;
    });
    const monthRecs = monthSessions.flatMap(s => s.recommendations || []);
    const monthPos  = monthRecs.filter(r => ['worn', 'liked', 'saved'].includes(r.status)).length;
    return {
      month:       label,
      sessions:    monthSessions.length,
      total:       monthRecs.length,
      accepted:    monthPos,
      acceptRate:  monthRecs.length > 0 ? Math.round((monthPos / monthRecs.length) * 100) : 0,
    };
  });

  res.json({
    totalSessions:        sessions.length,
    totalRecommendations: total,
    acceptanceRate:       total > 0 ? Math.round((positive / total) * 100) : 0,
    avgConfidence,
    statusBreakdown:      statusCounts,
    confidenceDistribution: confDist,
    monthlyTrend:         monthly,
    byOccasion: Object.entries(byOccasion)
      .map(([occasion, d]) => ({
        occasion,
        sessions:  d.sessions,
        accepted:  d.accepted,
        total:     d.total,
        rate:      d.total > 0 ? Math.round((d.accepted / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions),
    categoryPerformance: Object.entries(byCategory).map(([cat, d]) => ({
      category:    cat,
      label:       d.label,
      count:       d.count,
      acceptRate:  d.count > 0 ? Math.round((d.positive / d.count) * 100) : 0,
      avgConf:     d.count > 0 ? Math.round(d.totalConf / d.count) : 75,
    })),
    topFeedbackReasons: Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  });
};

// ── ML Model Management ───────────────────────────────────────────────────────

exports.getMLModelInfo = async (req, res) => {
  try {
    const [infoRes, featRes] = await Promise.all([
      axios.get(`${ML_SERVICE}/model-info`, { timeout: 8000 }),
      axios.get(`${ML_SERVICE}/feature-importance?top_n=20`, { timeout: 8000 }),
    ]);
    res.json({
      modelInfo:          infoRes.data,
      featureImportance:  featRes.data.features || [],
      mlServiceReachable: true,
    });
  } catch {
    res.json({
      modelInfo:          null,
      featureImportance:  [],
      mlServiceReachable: false,
      error:              'ML service is not running or not reachable.',
    });
  }
};

exports.retrainMLModel = async (req, res) => {
  try {
    const { data } = await axios.post(`${ML_SERVICE}/retrain`, {}, { timeout: 120000 });
    log('ML model retrained by admin', 'system', JSON.stringify(data.metrics || {}), req.user._id);
    res.json(data);
  } catch (err) {
    const msg = err.response?.data?.error || 'Retraining failed or ML service is not reachable.';
    res.status(500).json({ message: msg });
  }
};

exports.getRankingMetrics = async (req, res) => {
  try {
    const { data } = await axios.get(`${ML_SERVICE}/ranking-metrics`, { timeout: 30000 });
    res.json({ rankingMetrics: data, mlServiceReachable: true });
  } catch {
    res.json({
      rankingMetrics:     null,
      mlServiceReachable: false,
      error:              'ML service is not running or not reachable.',
    });
  }
};

// ── Wardrobe AI-Metadata Backfill ───────────────────────────────────────────
// The vision-tagging pipeline (visionExtractionService.js) is fully working,
// but items uploaded before a working AI provider was configured never got
// (re)processed — this reuses that exact pipeline, unmodified, as a bulk
// catch-up operation rather than rebuilding anything.

// 'color-only' means k-means color extraction ran but the vision-LLM call
// itself failed or was unavailable — genuinely useful attributes (style,
// pattern, formality, etc.) were never extracted, so this does NOT count as
// "tagged" and MUST remain eligible for a retry (e.g. once a rate-limited
// provider's quota resets) rather than being silently excluded forever.
const UNTAGGED_PROVIDERS = ['', null, 'color-only'];

exports.getWardrobeAIMetaCoverage = async (req, res) => {
  const [total, tagged] = await Promise.all([
    WardrobeItem.countDocuments({ imageUrl: { $ne: '' } }),
    WardrobeItem.countDocuments({ imageUrl: { $ne: '' }, 'aiMeta.provider': { $nin: UNTAGGED_PROVIDERS } }),
  ]);
  res.json({ total, tagged, coveragePercent: total ? Math.round((tagged / total) * 100) : 0 });
};

exports.runWardrobeBackfill = async (req, res) => {
  const limit = Math.min(50, Number(req.body.limit) || 20);
  const items = await WardrobeItem.find({
    imageUrl: { $ne: '' },
    'aiMeta.provider': { $in: UNTAGGED_PROVIDERS },
  }).limit(limit);

  const results = { processed: 0, tagged: 0, failed: 0 };
  for (const item of items) {
    results.processed++;
    try {
      const meta = await visionExtraction.analyzeWardrobeImage(item.imageUrl, item.category);
      Object.assign(item, meta, { metadataReviewed: false }); // flagged for owner review, same convention as manual uploads
      await item.save();
      if (meta.aiMeta?.provider && meta.aiMeta.provider !== 'color-only') results.tagged++;
    } catch (err) {
      results.failed++;
      console.warn('[admin backfill] item', item._id, 'failed:', err.message);
    }
  }
  log(`Wardrobe AI backfill: ${results.tagged}/${results.processed} tagged`, 'system', '', req.user._id);
  res.json(results);
};

// ── Reports & Export ──────────────────────────────────────────────────────────

exports.exportUsers = async (req, res) => {
  const users = await User.find({ role: 'user' })
    .select('name email status createdAt lastLogin onboardingCompleted bodyType skinTone stylePreferences')
    .sort({ createdAt: -1 })
    .limit(10000)
    .lean();

  const csv = [
    'Name,Email,Status,Registered,Last Login,Onboarding,Body Type,Skin Tone',
    ...users.map(u => [
      `"${u.name || ''}"`,
      `"${u.email || ''}"`,
      u.status || 'active',
      u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '',
      u.lastLogin ? new Date(u.lastLogin).toISOString().split('T')[0] : '',
      u.onboardingCompleted ? 'Yes' : 'No',
      u.bodyType || '',
      u.skinTone || '',
    ].join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="styleai_users_${Date.now()}.csv"`);
  res.send(csv);
};

exports.exportRecommendations = async (req, res) => {
  const sessions = await Recommendation.find({ status: 'complete' })
    .populate('user', 'name email')
    .select('user context createdAt recommendations')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  const rows = sessions.flatMap(s =>
    (s.recommendations || []).map(r => [
      `"${s.user?.name || 'Unknown'}"`,
      `"${s.user?.email || ''}"`,
      s.context?.occasion || '',
      r.category || '',
      r.confidence || '',
      r.status || 'pending',
      r.userRating || '',
      s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '',
    ].join(','))
  );

  const csv = ['User,Email,Occasion,Category,Confidence,Status,Rating,Date', ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="styleai_recommendations_${Date.now()}.csv"`);
  res.send(csv);
};

// ── Usability Evaluation ───────────────────────────────────────────────────────

const EVALUATION_LIKERT_FIELDS = ['recommendationQuality', 'easeOfUse', 'visualDesign', 'systemSpeed', 'overallSatisfaction'];

exports.getEvaluationResults = async (req, res) => {
  const responses = await EvaluationResponse.find({}).sort({ createdAt: -1 }).limit(1000).lean();

  const count = responses.length;
  const averages = {};
  EVALUATION_LIKERT_FIELDS.forEach(field => {
    averages[field] = count > 0
      ? Math.round((responses.reduce((s, r) => s + (r[field] || 0), 0) / count) * 100) / 100
      : 0;
  });

  res.json({ count, averages, responses });
};

exports.exportEvaluationResults = async (req, res) => {
  const responses = await EvaluationResponse.find({}).sort({ createdAt: -1 }).limit(1000).lean();

  const csv = [
    'Participant,Recommendation Quality,Ease of Use,Visual Design,System Speed,Overall Satisfaction,Comments,Submitted',
    ...responses.map(r => [
      `"${r.participantLabel || 'Anonymous'}"`,
      r.recommendationQuality,
      r.easeOfUse,
      r.visualDesign,
      r.systemSpeed,
      r.overallSatisfaction,
      `"${(r.comments || '').replace(/"/g, '""')}"`,
      r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
    ].join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="styleai_evaluation_${Date.now()}.csv"`);
  res.send(csv);
};
