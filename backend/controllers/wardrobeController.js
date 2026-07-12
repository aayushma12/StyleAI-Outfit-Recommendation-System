const cloudinary     = require('../config/cloudinary');
const WardrobeItem  = require('../models/WardrobeItem');
const WardrobeCombo = require('../models/WardrobeCombo');
const logActivity   = require('../utils/historyLogger');
const { logBehavior } = require('../services/behaviorService');
const visionExtraction = require('../services/visionExtractionService');
const outfitPreview = require('../services/outfitPreviewService');
const { generateWardrobeUtilizationReport } = require('../services/personalizedLearningService');
const { escapeRegex } = require('../utils/validation');
const { isAllowedImageUrl } = require('../utils/urlSafety');

const AI_METADATA_FIELDS = [
  'subcategory', 'colorHex', 'pattern', 'fit', 'formalityLevel', 'layeringLevel', 'sleeveLength',
  'suitableSeasons', 'suitableOccasions', 'styleTags', 'accessoryCompatibility', 'materialGuess',
  'neckline', 'genderCategory', 'details', 'isCompleteOutfit',
  'texture', 'silhouette', 'weatherSuitability', 'culturalCategory',
];

exports.getItems = async (req, res) => {
  const {
    category = '', search = '', sort = 'createdAt', sortDir = 'desc',
    occasion = '', season = '', page = '1', limit = '100',
  } = req.query;

  const query = { user: req.user._id };
  if (category) query.category = category;
  if (occasion) query.occasion = { $regex: escapeRegex(occasion), $options: 'i' };
  if (season)   query.season   = { $regex: escapeRegex(season),   $options: 'i' };
  if (search)   query.name     = { $regex: escapeRegex(search),   $options: 'i' };

  const sortObj  = { [sort]: sortDir === 'asc' ? 1 : -1 };
  const skip     = (Math.max(1, Number(page)) - 1) * Math.min(200, Number(limit));
  const take     = Math.min(200, Number(limit));

  const [items, total] = await Promise.all([
    WardrobeItem.find(query).sort(sortObj).skip(skip).limit(take),
    WardrobeItem.countDocuments(query),
  ]);

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / take) });
};

exports.analyzeImage = async (req, res) => {
  const { imageUrl, category } = req.body;
  if (!imageUrl?.trim()) return res.status(400).json({ message: 'imageUrl is required.' });
  if (!isAllowedImageUrl(imageUrl.trim())) {
    return res.status(400).json({ message: 'imageUrl must be a Cloudinary-hosted image URL.' });
  }

  const meta = await visionExtraction.analyzeWardrobeImage(imageUrl.trim(), category || '');
  res.json({ meta });
};

exports.getItem = async (req, res) => {
  const item = await WardrobeItem.findOne({ _id: req.params.id, user: req.user._id });
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  res.json({ item });
};

exports.createItem = async (req, res) => {
  const { name, category, color, occasion, season, notes, imageUrl, publicId, aiMeta, unverifiedFields } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Item name is required.' });
  if (!category)     return res.status(400).json({ message: 'Category is required.' });
  if (!color?.trim()) return res.status(400).json({ message: 'Color is required.' });
  if (!occasion?.trim()) return res.status(400).json({ message: 'Occasion is required.' });

  const metadata = {};
  AI_METADATA_FIELDS.forEach(f => { if (req.body[f] !== undefined) metadata[f] = req.body[f]; });

  const item = await WardrobeItem.create({
    user:     req.user._id,
    name:     name.trim().slice(0, 100),
    category,
    color:    color.trim().slice(0, 50),
    occasion: (occasion || '').trim(),
    season:   (season   || '').trim(),
    notes:    (notes    || '').trim().slice(0, 300),
    imageUrl: imageUrl || '',
    publicId: publicId || '',
    ...metadata,
    aiMeta: aiMeta || undefined,
    unverifiedFields: Array.isArray(unverifiedFields) ? unverifiedFields.slice(0, AI_METADATA_FIELDS.length) : [],
    metadataReviewed: !unverifiedFields?.length,
  });

  logActivity(req.user._id, {
    action: 'wardrobe_added', category: 'wardrobe',
    title: `Added "${item.name}" to wardrobe`,
    description: `${cap(item.category)} · ${item.color}${item.occasion ? ' · ' + cap(item.occasion) : ''}`,
    metadata: { itemName: item.name, itemImage: item.imageUrl, itemCategory: item.category, color: item.color, occasion: item.occasion },
    refId: item._id,
  });

  logBehavior(req.user._id, 'wardrobe_add', {
    entityId: item._id, entityType: 'WardrobeItem',
    metadata: { color: item.color, category: item.category, occasion: item.occasion },
  });

  res.status(201).json({ item });
};

exports.updateItem = async (req, res) => {
  const allowed = ['name', 'category', 'color', 'occasion', 'season', 'notes', 'imageUrl', 'publicId', ...AI_METADATA_FIELDS];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (updates.name) updates.name = updates.name.trim().slice(0, 100);
  if (updates.color) updates.color = updates.color.trim().slice(0, 50);
  if (updates.notes) updates.notes = updates.notes.trim().slice(0, 300);

  const existing = await WardrobeItem.findOne({ _id: req.params.id, user: req.user._id });
  if (!existing) return res.status(404).json({ message: 'Item not found.' });

  if (Array.isArray(req.body.unverifiedFields)) {
    // Client explicitly reports which fields are fresh, unreviewed AI suggestions
    // (e.g. right after a re-analyze) — trust it as-is.
    updates.unverifiedFields = req.body.unverifiedFields.slice(0, AI_METADATA_FIELDS.length);
    updates.metadataReviewed = updates.unverifiedFields.length === 0;
  } else {
    // Fallback: editing an AI-suggested field one at a time counts as reviewing it.
    const editedAiFields = AI_METADATA_FIELDS.filter(f => updates[f] !== undefined);
    if (editedAiFields.length) {
      updates.unverifiedFields = (existing.unverifiedFields || []).filter(f => !editedAiFields.includes(f));
      updates.metadataReviewed = updates.unverifiedFields.length === 0;
    }
  }

  const item = await WardrobeItem.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    updates,
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: 'Item not found.' });

  logActivity(req.user._id, {
    action: 'wardrobe_updated', category: 'wardrobe',
    title: `Updated "${item.name}"`,
    description: `${cap(item.category)} · ${item.color}`,
    metadata: { itemName: item.name, itemImage: item.imageUrl, itemCategory: item.category, color: item.color },
    refId: item._id,
  });

  res.json({ item });
};

exports.deleteItem = async (req, res) => {
  const item = await WardrobeItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) return res.status(404).json({ message: 'Item not found.' });

  if (item.publicId) {
    try {
      await cloudinary.uploader.destroy(item.publicId);
    } catch (err) {
      console.warn('[wardrobe] Cloudinary delete failed for', item.publicId, '—', err.message);
    }
  }

  // Prevent a dangling ref: without this, a saved combo's `items` array keeps
  // the deleted item's ObjectId, which .populate() turns into `null` in place
  // (array length unchanged) — a real crash risk for any renderer that
  // dereferences items unconditionally.
  try {
    await WardrobeCombo.updateMany({ user: req.user._id, items: item._id }, { $pull: { items: item._id } });
  } catch (err) {
    console.warn('[wardrobe] Failed to clean up combo refs for deleted item', item._id, '—', err.message);
  }

  logActivity(req.user._id, {
    action: 'wardrobe_removed', category: 'wardrobe',
    title: `Removed "${item.name}" from wardrobe`,
    description: `${cap(item.category)} · ${item.color}`,
    metadata: { itemName: item.name, itemCategory: item.category, color: item.color },
  });

  logBehavior(req.user._id, 'wardrobe_delete', {
    entityId: item._id, entityType: 'WardrobeItem',
    metadata: { color: item.color, category: item.category },
  });

  res.json({ message: 'Item deleted.' });
};

exports.getStats = async (req, res) => {
  const userId = req.user._id;
  const [total, categoryBreakdown, colorBreakdown, occasionBreakdown, seasonBreakdown, aiTaggedCount, verifiedCount, utilizationReport] = await Promise.all([
    WardrobeItem.countDocuments({ user: userId }),
    WardrobeItem.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    WardrobeItem.aggregate([
      { $match: { user: userId, color: { $ne: '' } } },
      { $group: { _id: { $toLower: '$color' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    WardrobeItem.aggregate([
      { $match: { user: userId, occasion: { $ne: '' } } },
      { $group: { _id: '$occasion', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 4 },
    ]),
    WardrobeItem.aggregate([
      { $match: { user: userId, season: { $ne: '' } } },
      { $group: { _id: '$season', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    WardrobeItem.countDocuments({ user: userId, 'aiMeta.extractedAt': { $ne: null } }),
    WardrobeItem.countDocuments({ user: userId, metadataReviewed: true }),
    generateWardrobeUtilizationReport(userId),
  ]);

  const ALL_CATS = ['tops', 'bottoms', 'dresses', 'footwear', 'accessories'];
  const coveredCats = categoryBreakdown.filter(c => ALL_CATS.includes(c._id)).length;

  res.json({
    total,
    categories:        categoryBreakdown,
    topColors:         colorBreakdown.map(c => c._id),
    topOccasions:      occasionBreakdown,
    topSeasons:        seasonBreakdown,
    completenessScore: Math.round((coveredCats / ALL_CATS.length) * 100),
    categoryCoverage:  coveredCats,
    totalCategories:   ALL_CATS.length,
    aiTaggedCount,
    verifiedCount,
    aiTaggedPercent: total > 0 ? Math.round((aiTaggedCount / total) * 100) : 0,
    utilizationRate: utilizationReport.utilizationRate,
  });
};

// Ad-hoc composite preview for items that aren't (yet) a saved combo — used
// by Alternative Styles cards to generate a preview only when a user
// actually expands one, rather than eagerly for every candidate shown.
// Never creates a WardrobeCombo; purely returns an image URL or null.
exports.getOutfitPreview = async (req, res) => {
  const ids = (req.query.items || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  if (!ids.length) return res.json({ url: null });

  const items = await WardrobeItem.find(
    { _id: { $in: ids }, user: req.user._id },
    'imageUrl'
  ).lean();

  const preview = await outfitPreview.generatePreviewImage(items.map(i => i.imageUrl));
  res.json({ url: preview?.url || null });
};

// A combo's `items` array can hold a stale ObjectId for a wardrobe item that
// was later deleted — .populate() turns that slot into `null` in place
// (array length unchanged) rather than dropping it. deleteItem() now cleans
// these up proactively, but this is a response-boundary self-heal for any
// refs orphaned before that fix shipped (or a delete/populate race), so
// renderers never have to guard against a `null` item themselves.
function stripDeadRefs(combo) {
  const obj = combo.toObject ? combo.toObject() : combo;
  obj.items = (obj.items || []).filter(Boolean);
  return obj;
}

exports.saveCombination = async (req, res) => {
  const { name, items, occasion, notes, matchScore, weatherSuitable, reasons } = req.body;
  if (!items || items.length < 1) {
    return res.status(400).json({ message: 'At least 1 item required.' });
  }
  const combo = await WardrobeCombo.create({
    user: req.user._id,
    name: (name || `Outfit ${new Date().toLocaleDateString()}`).trim().slice(0, 100),
    items,
    occasion:        (occasion        || '').trim(),
    notes:           (notes           || '').trim().slice(0, 300),
    matchScore:      Math.min(100, Math.max(0, matchScore ?? 0)),
    weatherSuitable: (weatherSuitable || '').trim(),
    reasons:         (reasons         || []).slice(0, 10),
  });
  const populated = await WardrobeCombo.findById(combo._id).populate('items');

  logActivity(req.user._id, {
    action: 'outfit_created', category: 'outfit',
    title: `Saved outfit "${populated.name}"`,
    description: `${items.length} piece${items.length !== 1 ? 's' : ''}${occasion ? ' · ' + cap(occasion) : ''}${matchScore ? ' · Score ' + matchScore + '%' : ''}`,
    metadata: { outfitName: populated.name, occasion, score: matchScore, count: items.length },
    refId: combo._id,
  });

  logBehavior(req.user._id, 'outfit_save', {
    entityId: combo._id, entityType: 'WardrobeCombo',
    metadata: { occasion, score: matchScore },
  });

  // Fire-and-forget — the save response must stay instant; the composite
  // preview patches onto the record moments later (see outfitPreviewService.js).
  const itemImageUrls = (populated.items || []).filter(Boolean).map(i => i.imageUrl);
  outfitPreview.generatePreviewImage(itemImageUrls).then(preview => {
    if (preview) {
      WardrobeCombo.findByIdAndUpdate(combo._id, {
        previewImage: { ...preview, generatedAt: new Date() },
      }).catch(() => {});
    }
  }).catch(() => {});

  res.status(201).json({ combination: stripDeadRefs(populated) });
};

exports.getSavedCombinations = async (req, res) => {
  const {
    occasion = '', season = '', style = '', search = '',
    sort = 'createdAt', sortDir = 'desc', favoritesOnly = '',
  } = req.query;

  const query = { user: req.user._id };
  if (occasion) query.occasion = { $regex: escapeRegex(occasion), $options: 'i' };
  if (season)   query.season   = { $regex: escapeRegex(season),   $options: 'i' };
  if (search)   query.name     = { $regex: escapeRegex(search),   $options: 'i' };
  if (favoritesOnly === 'true') query.isLiked = true;

  const SORTABLE_FIELDS = ['createdAt', 'matchScore', 'name'];
  const sortField = SORTABLE_FIELDS.includes(sort) ? sort : 'createdAt';
  const sortObj   = { [sortField]: sortDir === 'asc' ? 1 : -1 };

  let combos = await WardrobeCombo.find(query).populate('items').sort(sortObj);

  // Style isn't stored on the combo itself — it's inferred from its items'
  // styleTags, so this filter runs in-memory post-populate rather than as a
  // DB query (a single user's saved-outfit count is small; consistent with
  // how style tags are already treated as a client-visible dimension
  // elsewhere rather than deeply queried).
  if (style) {
    combos = combos.filter(c =>
      (c.items || []).some(i => (i?.styleTags || []).includes(style))
    );
  }

  res.json({ combinations: combos.map(stripDeadRefs) });
};

exports.reuseCombo = async (req, res) => {
  const combo = await WardrobeCombo.findOne({ _id: req.params.id, user: req.user._id }).populate('items');
  if (!combo) return res.status(404).json({ message: 'Outfit not found.' });

  combo.lastUsedAt = new Date();
  combo.timesReused = (combo.timesReused || 0) + 1;
  await combo.save();

  const validItems = (combo.items || []).filter(Boolean);
  logBehavior(req.user._id, 'outfit_save', {
    entityId: combo._id, entityType: 'WardrobeCombo',
    metadata: {
      occasion: combo.occasion,
      color:    [...new Set(validItems.flatMap(i => (i.color || '').split(',').map(c => c.trim()).filter(Boolean)))],
      category: [...new Set(validItems.map(i => i.category).filter(Boolean))],
    },
  });

  res.json({ combination: stripDeadRefs(combo) });
};

exports.getCombo = async (req, res) => {
  const combo = await WardrobeCombo.findOne({ _id: req.params.id, user: req.user._id }).populate('items');
  if (!combo) return res.status(404).json({ message: 'Outfit not found.' });
  res.json({ combination: stripDeadRefs(combo) });
};

exports.updateCombo = async (req, res) => {
  const { name, items, occasion, notes, matchScore, weatherSuitable, reasons, isLiked } = req.body;
  const updates = {};
  if (name             !== undefined) updates.name             = name.trim().slice(0, 100);
  if (items            !== undefined) updates.items            = items;
  if (occasion         !== undefined) updates.occasion         = occasion.trim();
  if (notes            !== undefined) updates.notes            = notes.trim().slice(0, 300);
  if (matchScore       !== undefined) updates.matchScore       = Math.min(100, Math.max(0, matchScore));
  if (weatherSuitable  !== undefined) updates.weatherSuitable  = weatherSuitable;
  if (reasons          !== undefined) updates.reasons          = reasons.slice(0, 10);
  if (isLiked          !== undefined) updates.isLiked          = !!isLiked;

  const combo = await WardrobeCombo.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    updates,
    { new: true, runValidators: true }
  ).populate('items');
  if (!combo) return res.status(404).json({ message: 'Outfit not found.' });

  logActivity(req.user._id, {
    action: 'outfit_updated', category: 'outfit',
    title: `Updated outfit "${combo.name}"`,
    description: `${(combo.items||[]).length} piece${(combo.items||[]).length !== 1 ? 's' : ''}${combo.occasion ? ' · ' + cap(combo.occasion) : ''}`,
    metadata: { outfitName: combo.name, occasion: combo.occasion, score: combo.matchScore },
    refId: combo._id,
  });

  res.json({ combination: stripDeadRefs(combo) });
};

exports.deleteCombo = async (req, res) => {
  const combo = await WardrobeCombo.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!combo) return res.status(404).json({ message: 'Outfit not found.' });

  logActivity(req.user._id, {
    action: 'outfit_deleted', category: 'outfit',
    title: `Deleted outfit "${combo.name || 'Unnamed Outfit'}"`,
    description: `${(combo.items||[]).length} piece${(combo.items||[]).length !== 1 ? 's' : ''}`,
    metadata: { outfitName: combo.name, occasion: combo.occasion, count: (combo.items||[]).length },
  });

  res.json({ message: 'Outfit deleted.' });
};

function cap(s) {
  return (s || '').charAt(0).toUpperCase() + (s || '').slice(1).replace(/_/g, ' ');
}
