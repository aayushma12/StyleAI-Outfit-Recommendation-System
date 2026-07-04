'use strict';

const BehaviorLog = require('../models/BehaviorLog');

let _cache = { data: null, ts: 0 };
const TTL  = 60 * 60 * 1000; // 1 hour

async function loadGlobalTrends() {
  if (_cache.data && Date.now() - _cache.ts < TTL) return _cache.data;

  const POSITIVE = ['recommendation_accept', 'outfit_like', 'wardrobe_add'];

  const [topCategories, topColors, topOccasions] = await Promise.all([
    BehaviorLog.aggregate([
      { $match: { action: { $in: POSITIVE }, 'metadata.category': { $exists: true, $ne: '' } } },
      { $group: { _id: '$metadata.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
    ]),
    BehaviorLog.aggregate([
      { $match: { action: { $in: POSITIVE }, 'metadata.color': { $exists: true, $ne: '' } } },
      { $group: { _id: '$metadata.color', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
    ]),
    BehaviorLog.aggregate([
      { $match: { action: { $in: ['recommendation_accept', 'outfit_like'] }, 'metadata.occasion': { $exists: true, $ne: '' } } },
      { $group: { _id: '$metadata.occasion', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 8 },
    ]),
  ]);

  const maxCat = topCategories[0]?.count || 1;
  const maxCol = topColors[0]?.count     || 1;

  const data = {
    categories:  topCategories.map(c => ({ name: c._id, score: c.count / maxCat })),
    colors:      topColors.map(c     => ({ name: c._id, score: c.count / maxCol })),
    occasions:   topOccasions.map(o  => o._id),
    computedAt:  new Date().toISOString(),
  };

  _cache = { data, ts: Date.now() };
  return data;
}

// Returns full global trend data for the /trends API endpoint
exports.getTrends = loadGlobalTrends;

// Returns [0,1] popularity score for an outfit based on global behavior patterns
exports.getPopularityScore = async function getPopularityScore(outfitItems) {
  try {
    const data = await loadGlobalTrends();
    if (!data.categories.length && !data.colors.length) return 0.50;

    const outfitCats   = outfitItems.map(it => it.category?.toLowerCase()).filter(Boolean);
    const outfitColors = outfitItems
      .flatMap(it => (it.color || '').split(',').map(c => c.trim().toLowerCase()))
      .filter(Boolean);

    let score = 0.50;

    if (outfitCats.length > 0) {
      const catTotal = outfitCats.reduce((sum, cat) => {
        const found = data.categories.find(c => c.name.toLowerCase() === cat);
        return sum + (found ? found.score : 0);
      }, 0);
      score += (catTotal / outfitCats.length) * 0.18;
    }

    if (outfitColors.length > 0) {
      const colTotal = outfitColors.reduce((sum, col) => {
        const found = data.colors.find(c =>
          c.name.toLowerCase().includes(col) || col.includes(c.name.toLowerCase())
        );
        return sum + (found ? found.score : 0);
      }, 0);
      score += (colTotal / outfitColors.length) * 0.12;
    }

    return Math.max(0.10, Math.min(1, score));
  } catch {
    return 0.50;
  }
};
