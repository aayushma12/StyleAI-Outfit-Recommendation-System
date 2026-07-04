'use strict';

const User            = require('../models/User');
const BehaviorLog     = require('../models/BehaviorLog');
const UserSimilarity  = require('../models/UserSimilarity');

function buildUserVector(user) {
  return {
    styles:    new Set([...(user.stylePreferences || []), ...(user.fashionStyles || [])]),
    occasions: new Set(user.occasionPreferences || []),
    colors:    new Set(user.colorPreferences    || []),
    bodyType:  user.bodyType   || null,
    lifestyle: user.lifestyle  || null,
    ageGroup:  user.age ? Math.floor(user.age / 5) : null,
  };
}

function jaccardSim(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(item => { if (setB.has(item)) intersection++; });
  return intersection / (setA.size + setB.size - intersection);
}

function computeSimilarity(userA, userB) {
  const vA = buildUserVector(userA);
  const vB = buildUserVector(userB);

  const styleScore    = jaccardSim(vA.styles,    vB.styles)    * 0.35;
  const occasionScore = jaccardSim(vA.occasions, vB.occasions) * 0.25;
  const colorScore    = jaccardSim(vA.colors,    vB.colors)    * 0.20;
  const bodyScore     = (vA.bodyType  && vA.bodyType  === vB.bodyType  ? 1 : 0) * 0.10;
  const lifeScore     = (vA.lifestyle && vA.lifestyle === vB.lifestyle ? 1 : 0) * 0.10;

  const similarity    = styleScore + occasionScore + colorScore + bodyScore + lifeScore;
  const sharedStyles  = [...vA.styles].filter(s => vB.styles.has(s));
  const sharedOcc     = [...vA.occasions].filter(o => vB.occasions.has(o));

  return { similarity, sharedStyles, sharedOccasions: sharedOcc };
}

// Background task — update cached similarity scores for a user.
// Called after recommendation generation; never awaited in the main path.
exports.refreshSimilarUsers = async function refreshSimilarUsers(userId, baseUser) {
  try {
    const user = baseUser || await User.findById(userId).lean();
    if (!user?.onboardingCompleted) return;

    const others = await User.find({ _id: { $ne: userId }, onboardingCompleted: true })
      .select('stylePreferences fashionStyles occasionPreferences colorPreferences bodyType lifestyle age')
      .limit(500)
      .lean();

    if (others.length === 0) return;

    const sims = others
      .map(other => {
        const { similarity, sharedStyles, sharedOccasions } = computeSimilarity(user, other);
        return { userId: other._id, similarity, sharedStyles, sharedOccasions };
      })
      .filter(s => s.similarity > 0.05)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    if (sims.length === 0) return;

    const ops = sims.map(s => ({
      updateOne: {
        filter: { baseUser: userId, similarUser: s.userId },
        update: {
          $set: {
            similarityScore: Math.round(s.similarity * 1000) / 1000,
            sharedStyles:    s.sharedStyles,
            sharedOccasions: s.sharedOccasions,
            lastComputed:    new Date(),
          },
        },
        upsert: true,
      },
    }));

    await UserSimilarity.bulkWrite(ops);
  } catch (err) {
    console.error('[collaborativeService] refreshSimilarUsers error:', err.message);
  }
};

// Returns collaborative signal + prompt-enrichment context.
// signal: [0,1] score for blending into behaviorSignal in scoring.
// sharedStyles/sharedOccasions: for LLM prompt enrichment.
exports.getCollaborativeData = async function getCollaborativeData(userId, userOccasions = []) {
  try {
    const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const similarUsers = await UserSimilarity.find({
      baseUser:        userId,
      similarityScore: { $gt: 0.1 },
      lastComputed:    { $gte: staleThreshold },
    }).sort({ similarityScore: -1 }).limit(5).lean();

    if (similarUsers.length === 0) return { signal: null };

    const similarUserIds = similarUsers.map(s => s.similarUser);
    const avgSim = similarUsers.reduce((s, u) => s + u.similarityScore, 0) / similarUsers.length;

    const positiveLogs = await BehaviorLog.aggregate([
      {
        $match: {
          user:   { $in: similarUserIds },
          action: { $in: ['recommendation_accept', 'outfit_like', 'wardrobe_add'] },
          'metadata.category': { $exists: true, $ne: '' },
        },
      },
      { $group: { _id: '$metadata.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    const popularCats = new Set(positiveLogs.map(p => p._id.toLowerCase()));
    const userCatSet  = new Set((userOccasions || []).map(c => c.toLowerCase()));

    let matchCount = 0;
    userCatSet.forEach(cat => { if (popularCats.has(cat)) matchCount++; });
    const matchRatio = userCatSet.size > 0 ? matchCount / userCatSet.size : 0;

    // signal: [0.40 – 0.90]
    const signal = Math.max(0.10, Math.min(1, 0.40 + matchRatio * 0.40 * avgSim + 0.10));

    const sharedStyles  = [...new Set(similarUsers.flatMap(u => u.sharedStyles    || []))].slice(0, 5);
    const sharedOcc     = [...new Set(similarUsers.flatMap(u => u.sharedOccasions || []))].slice(0, 4);

    return { signal, sharedStyles, sharedOccasions: sharedOcc, peerCount: similarUsers.length };
  } catch (err) {
    console.error('[collaborativeService] getCollaborativeData error:', err.message);
    return { signal: null };
  }
};
