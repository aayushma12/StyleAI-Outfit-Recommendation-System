const UserHistory  = require('../models/UserHistory');
const WardrobeItem = require('../models/WardrobeItem');
const WardrobeCombo = require('../models/WardrobeCombo');
const OutfitCalendar = require('../models/OutfitCalendar');
const { escapeRegex } = require('../utils/validation');

// GET /api/history — query params: category, action, search, from, to, page, limit
exports.getHistory = async (req, res) => {
  const {
    category, action, search,
    from, to,
    page  = 1,
    limit = 25,
  } = req.query;

  const query = { user: req.user._id };
  if (category && category !== 'all') query.category = category;
  if (action)   query.action = action;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to)   query.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    query.$or = [
      { title: rx },
      { description: rx },
      { 'metadata.itemName': rx },
      { 'metadata.outfitName': rx },
    ];
  }

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const [logs, total] = await Promise.all([
    UserHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    UserHistory.countDocuments(query),
  ]);

  res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
};

exports.getAnalytics = async (req, res) => {
  const uid = req.user._id;

  const [
    totalHistoryEvents,
    categoryCounts,
    actionCounts,
    monthlyActivity,
    totalWardrobe,
    wardrobeCategories,
    wardrobeColors,
    wardrobeOccasions,
    wardrobeSeasons,
    totalOutfits,
    avgOutfitScore,
    totalCalendar,
    recentActivity,
  ] = await Promise.all([
    // Total history events
    UserHistory.countDocuments({ user: uid }),

    // History counts by category
    UserHistory.aggregate([
      { $match: { user: uid } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),

    // History counts by action
    UserHistory.aggregate([
      { $match: { user: uid } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Monthly activity — last 6 months
    UserHistory.aggregate([
      { $match: { user: uid, createdAt: { $gte: new Date(Date.now() - 183 * 24 * 3600 * 1000) } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // Wardrobe totals
    WardrobeItem.countDocuments({ user: uid }),

    // Wardrobe by category
    WardrobeItem.aggregate([
      { $match: { user: uid } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Wardrobe by color (top 8)
    WardrobeItem.aggregate([
      { $match: { user: uid, color: { $ne: '' } } },
      { $group: { _id: '$color', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),

    // Wardrobe by occasion
    WardrobeItem.aggregate([
      { $match: { user: uid, occasion: { $ne: '' } } },
      { $group: { _id: '$occasion', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),

    // Wardrobe by season
    WardrobeItem.aggregate([
      { $match: { user: uid, season: { $ne: '' } } },
      { $group: { _id: '$season', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Outfit totals
    WardrobeCombo.countDocuments({ user: uid }),

    // Average outfit score
    WardrobeCombo.aggregate([
      { $match: { user: uid, matchScore: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$matchScore' } } },
    ]),

    // Calendar entries total
    OutfitCalendar.countDocuments({ user: uid }),

    // Recent 5 activities
    UserHistory.find({ user: uid }).sort({ createdAt: -1 }).limit(5),
  ]);

  const categoryMap = {};
  categoryCounts.forEach(c => { categoryMap[c._id] = c.count; });

  res.json({
    summary: {
      totalEvents:   totalHistoryEvents,
      totalWardrobe,
      totalOutfits,
      totalCalendar,
      avgOutfitScore: avgOutfitScore[0]?.avg ? Math.round(avgOutfitScore[0].avg) : 0,
    },
    activityByCategory: categoryMap,
    activityByAction:   actionCounts.map(a => ({ action: a._id, count: a.count })),
    monthlyActivity:    monthlyActivity.map(m => ({
      label: new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
      count: m.count,
    })),
    wardrobeBreakdown: {
      categories: wardrobeCategories.map(c => ({ name: c._id, count: c.count })),
      colors:     wardrobeColors.map(c => ({ name: c._id, count: c.count })),
      occasions:  wardrobeOccasions.map(c => ({ name: c._id, count: c.count })),
      seasons:    wardrobeSeasons.map(c => ({ name: c._id, count: c.count })),
    },
    recentActivity: recentActivity.map(r => ({
      _id: r._id, title: r.title, category: r.category, action: r.action,
      createdAt: r.createdAt,
    })),
  });
};

exports.deleteEntry = async (req, res) => {
  const entry = await UserHistory.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return res.status(404).json({ message: 'History entry not found.' });
  res.json({ message: 'Entry removed.' });
};

exports.bulkDelete = async (req, res) => {
  const { category, before } = req.body;
  const query = { user: req.user._id };
  if (category && category !== 'all') query.category = category;
  if (before) query.createdAt = { $lt: new Date(before) };
  const result = await UserHistory.deleteMany(query);
  res.json({ message: `Cleared ${result.deletedCount} records.`, deleted: result.deletedCount });
};
