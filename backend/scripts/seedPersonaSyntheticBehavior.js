'use strict';

// ── Persona-based synthetic training data ───────────────────────────────────
// Upgrades on seedSyntheticTrainingBehavior.js (kept, not replaced — see its
// own file header) by giving the acceptance model actual per-user structure
// to learn from: 30 distinct style personas (personaDefinitions.js), each
// with its own full style profile, occasion bias, climate comfort zone,
// festival affinity, and a personal weighting of the 9 scoring dimensions.
// Interactions are simulated across a real 180-day trailing window using the
// app's own real Kathmandu climate/festival data (kathmanduIntelligence.js),
// so occasion/weather context is tied to the simulated calendar date instead
// of drawn independently — and every session is explicitly marked
// `synthetic: true` with full provenance in `syntheticMeta`, never disguised
// as real user behavior.
//
// Usage: node scripts/seedPersonaSyntheticBehavior.js [interactionsPerPersona]

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Recommendation = require('../models/Recommendation');
const { KATHMANDU_CLIMATE, NEPAL_FESTIVALS } = require('../services/kathmanduIntelligence');
const {
  SCORE_DIMENSIONS, ALL_OCCASIONS, expandArchetypesToPersonas,
  randInt, pick, clamp,
} = require('./personaDefinitions');

const GENERATOR_NAME = 'persona_v1';
const CATEGORIES = ['best_match', 'most_stylish', 'most_comfortable', 'weather_optimized', 'wardrobe_champion'];
const SEASON_LABELS = {
  winter: 'Winter (Hemanta-Shishir)', spring: 'Spring (Basanta)',
  monsoon: 'Monsoon (Barsha)', autumn: 'Autumn (Sharad)',
};
// Only the subset of the broader recommendation-occasion vocabulary that's
// also valid in User.js's own (narrower) occasionPreferences enum.
const USER_OCCASION_ENUM = ['daily', 'college', 'office', 'festival', 'wedding', 'party', 'casual_outing', 'religious'];

const DIM_NOISE_STD = {
  styleMatch: 12, colorHarmony: 15, colorPreference: 15, occasionFit: 10,
  weatherFit: 18, behaviorSignal: 15, bodyTypeMatch: 15, fabricMatch: 15, trendScore: 20,
};

function gaussian(mean, stdDev) {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function buildOutfitSlot() {
  return { item: null, name: '', suggestion: '', reason: '' };
}

// Picks a recency-skewed simulated date within the last `windowDays` — more
// density near "now" (growing engagement over time) rather than uniform.
function pickSimulatedDate(windowDays = 180) {
  const dayOffset = Math.floor(windowDays * Math.pow(Math.random(), 1.3));
  return new Date(Date.now() - dayOffset * 86400000);
}

function pickOccasion(persona, hasFestival) {
  if (hasFestival && persona.traditionalAffinity > 0.5 && Math.random() < persona.traditionalAffinity) {
    return pick(['festival', 'pooja', 'wedding']);
  }
  return Math.random() < 0.7 ? pick(persona.topOccasions) : pick(ALL_OCCASIONS);
}

// One simulated recommendation candidate: a quality score pulled toward the
// persona's own per-dimension weighting (not one global broadcast), plus a
// context-fit bonus tying quality to how well the occasion/weather actually
// suit this specific persona.
function simulateCandidate(persona, context) {
  const { occasion, weatherTemp, wardrobeOnly, hasFestival } = context;

  let bonus = 0;
  if (persona.topOccasions.includes(occasion)) bonus += 8;
  bonus += 6 * (1 - Math.min(1, Math.abs(weatherTemp - persona.idealTempC) / 20));
  if (hasFestival && persona.traditionalAffinity > 0.5 && ['festival', 'pooja', 'wedding'].includes(occasion)) bonus += 10;
  if (wardrobeOnly && persona.weights.trendScore > 1 / SCORE_DIMENSIONS.length) bonus -= 3;

  const quality = clamp(gaussian(persona.meanQuality + bonus, persona.stdQuality), 5, 98);

  const scores = {};
  SCORE_DIMENSIONS.forEach(dim => {
    const dimPull = 1 + 2 * (persona.weights[dim] - 1 / SCORE_DIMENSIONS.length);
    scores[dim] = Math.round(clamp(gaussian(quality * dimPull, DIM_NOISE_STD[dim]), 10, 99));
  });

  const acceptProbability = 1 / (1 + Math.exp(-(quality - persona.midpoint) / persona.steepness));
  const accepted = Math.random() < acceptProbability;
  const status = accepted ? pick(['worn', 'saved', 'liked']) : pick(['disliked', 'skipped']);
  const userRating = accepted ? randInt(4, 5) : (Math.random() < 0.5 ? randInt(1, 2) : null);

  return { quality, scores, status, userRating };
}

function buildPersonaSession(persona, userId) {
  const simulatedDate = pickSimulatedDate(180);
  const month = simulatedDate.getMonth() + 1;
  const climate = KATHMANDU_CLIMATE[month];
  const festivals = NEPAL_FESTIVALS[month] || [];
  const hasFestival = festivals.some(f => f.traditional || f.type === 'major');

  const wardrobeOnly = Math.random() < 0.25;
  const occasion = pickOccasion(persona, hasFestival);
  const weatherTemp = Math.round(clamp(gaussian(climate.avgTemp, 3.5), climate.range[0] - 2, climate.range[1] + 2));

  const context = { occasion, weatherTemp, wardrobeOnly, hasFestival };

  // 2-3 candidates per session so ranking-quality metrics (NDCG) have
  // non-degenerate multi-item sessions to compute on, unlike the original
  // 1-candidate-per-session bootstrap generator.
  const candidateCount = randInt(2, 3);
  const categories = [pick(CATEGORIES)];
  while (categories.length < candidateCount) {
    const c = pick(CATEGORIES);
    if (!categories.includes(c)) categories.push(c);
  }

  const candidates = categories
    .map((category) => ({ category, ...simulateCandidate(persona, context) }))
    .sort((a, b) => b.quality - a.quality)
    .map((c, idx) => ({
      category: c.category,
      categoryLabel: idx === 0 ? 'Best Match' : 'Alternative',
      categoryEmoji: idx === 0 ? '⭐' : '✨',
      categoryBrief: 'Persona-based synthetic sample',
      rank: idx + 1,
      confidence: Math.round(c.quality),
      scores: c.scores,
      outfitName: `Synthetic Persona Outfit (${persona.personaId})`,
      outfit: {
        top: buildOutfitSlot(), bottom: buildOutfitSlot(), dress: buildOutfitSlot(),
        outerwear: buildOutfitSlot(), footwear: buildOutfitSlot(), accessory: buildOutfitSlot(),
        jewelry: buildOutfitSlot(), bag: buildOutfitSlot(), belt: buildOutfitSlot(),
        watch: buildOutfitSlot(), scarf: buildOutfitSlot(), sunglasses: buildOutfitSlot(), hair_accessory: buildOutfitSlot(),
      },
      status: c.status,
      userRating: c.userRating,
      generationMethod: 'deterministic_v2',
      explanationSource: 'template',
    }));

  return {
    user: userId,
    context: {
      occasion, wardrobeOnly,
      weather: { temp: weatherTemp, feelsLike: weatherTemp, humidity: climate.humidity, windSpeed: 5, rainProb: climate.rainfall === 'heavy' ? 80 : climate.rainfall === 'moderate' ? 45 : 15, condition: climate.rainfall === 'heavy' ? 'Rain' : 'Partly cloudy', code: 2 },
      season: SEASON_LABELS[climate.season] || climate.season,
      timeOfDay: pick(['morning', 'afternoon', 'evening', 'night']),
      requestedBy: 'user',
    },
    recommendations: candidates,
    status: 'complete',
    generationMeta: { candidatePoolSize: randInt(20, 90), diversityMethod: 'mmr_jaccard_v1', pipelineVersion: 'v2-persona-synthetic' },
    synthetic: true,
    syntheticMeta: { generator: GENERATOR_NAME, personaId: persona.personaId, personaArchetype: persona.archetype, simulatedDate },
    createdAt: simulatedDate,
    updatedAt: simulatedDate,
  };
}

async function ensurePersonaUser(persona) {
  const email = `persona-${persona.personaId}@styleai-synthetic.local`;
  let user = await User.findOne({ email });
  if (user) return user;

  const skinTones = ['Fair', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'];
  const accessoryStyles = ['minimal', 'statement', 'traditional', 'layered'];
  const shoppingFrequencies = ['weekly', 'monthly', 'quarterly', 'seasonal'];
  const luxuryVsBudgetOpts = ['luxury', 'mid_range', 'budget', 'mix'];

  user = await User.create({
    name: `Persona: ${persona.archetype.replace(/_/g, ' ')} (${persona.personaId})`,
    email, password: 'NotARealAccount123!',
    onboardingCompleted: true, role: 'user', status: 'inactive',
    isSyntheticPersona: true, syntheticPersonaArchetype: persona.archetype,
    age: randInt(18, 25), gender: 'female',
    bodyType: persona.bodyType, skinTone: pick(skinTones),
    stylePreferences: persona.stylePreferences,
    fashionStyles: persona.fashionStyles,
    culturalBackground: 'Nepali',
    occasionPreferences: persona.topOccasions.filter(o => USER_OCCASION_ENUM.includes(o)).length
      ? persona.topOccasions.filter(o => USER_OCCASION_ENUM.includes(o))
      : ['daily'],
    colorPreferences: persona.colorPreferences,
    fabricPreferences: persona.fabricPreferences,
    modestyLevel: persona.modestyLevel,
    lifestyle: persona.lifestyle,
    accessoryStyle: pick(accessoryStyles),
    comfortPriority: randInt(2, 5),
    fashionConfidence: randInt(2, 5),
    fashionAdventurousness: randInt(1, 10),
    trendFollowing: randInt(1, 10),
    shoppingFrequency: pick(shoppingFrequencies),
    luxuryVsBudget: pick(luxuryVsBudgetOpts),
    budgetRange: { min: randInt(500, 3000), max: randInt(4000, 20000) },
    location: 'Kathmandu',
  });
  return user;
}

async function main() {
  const interactionsPerPersona = parseInt(process.argv[2], 10) || 120;
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to Mongo. Generating ~${interactionsPerPersona} interactions/persona across 30 personas...`);

  const personas = expandArchetypesToPersonas(3);
  let totalSessions = 0;

  for (const persona of personas) {
    const user = await ensurePersonaUser(persona);
    const n = randInt(Math.max(10, interactionsPerPersona - 10), interactionsPerPersona + 10);
    const sessions = Array.from({ length: n }, () => buildPersonaSession(persona, user._id));
    await Recommendation.insertMany(sessions, { timestamps: false });
    totalSessions += sessions.length;
    console.log(`  ${persona.personaId}: ${sessions.length} sessions`);
  }

  console.log(`\nDone. Inserted ${totalSessions} synthetic Recommendation sessions across ${personas.length} personas.`);
  console.log('Run `npm run train:ml` (or the admin Retrain button) now to train on this + any real data.');
  console.log('Remove later with: node scripts/removeSyntheticTrainingBehavior.js');

  await mongoose.disconnect();
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
