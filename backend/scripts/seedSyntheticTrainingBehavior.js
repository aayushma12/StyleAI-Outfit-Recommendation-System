'use strict';

// ── Synthetic bootstrap training data for the acceptance-prediction model ──
// A fresh install has ~0 real labeled recommendations, so the acceptance
// model's cold-start guard (< 50 samples) always trips. This script generates
// clearly-marked synthetic Recommendation documents with a realistic but
// NOISY (not deterministic) relationship between outfit scores and
// accept/reject outcomes — enough for `npm run train:ml` / the admin
// "Retrain Model" button to produce real, reportable accuracy/precision/
// recall/F1 metrics before real usage accumulates.
//
// This is bootstrap data, not a claim of real user behavior — every document
// it creates lives under a dedicated synthetic user
// (synthetic-bootstrap@styleai-synthetic.local) and is easy to remove later
// via scripts/removeSyntheticTrainingBehavior.js.
//
// NOTE: for a richer, per-user-heterogeneous dataset (30 distinct style
// personas instead of one flat quality distribution), prefer
// scripts/seedPersonaSyntheticBehavior.js. This script is kept as a smaller,
// faster cold-start option and for backward compatibility.
//
// Usage: node scripts/seedSyntheticTrainingBehavior.js [count]

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Recommendation = require('../models/Recommendation');

const SYNTHETIC_EMAIL = 'synthetic-bootstrap@styleai-synthetic.local';
const OCCASIONS = ['daily', 'college', 'office', 'party', 'date', 'formal', 'festival', 'wedding', 'gym', 'cafe'];
const CATEGORIES = ['best_match', 'most_stylish', 'most_comfortable', 'weather_optimized', 'wardrobe_champion'];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Box-Muller for a bit of realistic score noise instead of flat uniform randomness.
function gaussian(mean, stdDev) {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function generateSample() {
  // "Quality" is the latent, unobserved factor — scores are noisy readings of it,
  // and acceptance is a probabilistic (not deterministic) function of it. This
  // avoids a trivially-perfect, suspicious-looking 100% accuracy model.
  const quality = clamp(gaussian(60, 20), 5, 98);

  const scores = {
    styleMatch:      Math.round(clamp(gaussian(quality, 12), 10, 99)),
    colorHarmony:    Math.round(clamp(gaussian(quality, 15), 10, 99)),
    colorPreference: Math.round(clamp(gaussian(quality, 15), 10, 99)),
    occasionFit:     Math.round(clamp(gaussian(quality, 10), 10, 99)),
    weatherFit:      Math.round(clamp(gaussian(quality, 18), 10, 99)),
    behaviorSignal:  Math.round(clamp(gaussian(quality, 15), 10, 99)),
    bodyTypeMatch:   Math.round(clamp(gaussian(quality, 15), 10, 99)),
    fabricMatch:     Math.round(clamp(gaussian(quality, 15), 10, 99)),
    trendScore:      Math.round(clamp(gaussian(quality, 20), 10, 99)),
  };

  // Probability of acceptance rises with quality but is never deterministic —
  // a 90-quality outfit still gets rejected sometimes, a 40-quality one is
  // still sometimes accepted. Sigmoid centered around quality=55.
  const acceptProbability = 1 / (1 + Math.exp(-(quality - 55) / 12));
  const accepted = Math.random() < acceptProbability;

  const status = accepted ? pick(['worn', 'saved', 'liked']) : pick(['disliked', 'skipped']);
  const userRating = accepted ? randInt(4, 5) : (Math.random() < 0.5 ? randInt(1, 2) : null);

  const occasion = pick(OCCASIONS);
  const wardrobeOnly = Math.random() < 0.3;
  const weatherTemp = randInt(2, 34);

  return { scores, status, userRating, occasion, wardrobeOnly, weatherTemp, confidence: Math.round(quality) };
}

function buildOutfitSlot() {
  return { item: null, name: '', suggestion: '', reason: '' };
}

function buildSession(userId) {
  const sample = generateSample();
  return {
    user: userId,
    context: {
      occasion: sample.occasion,
      wardrobeOnly: sample.wardrobeOnly,
      weather: { temp: sample.weatherTemp, feelsLike: sample.weatherTemp, humidity: 60, windSpeed: 5, rainProb: 20, condition: 'Partly cloudy', code: 2 },
      season: 'Autumn (Sharad)',
      timeOfDay: pick(['morning', 'afternoon', 'evening', 'night']),
      requestedBy: 'user',
    },
    recommendations: [{
      category: pick(CATEGORIES),
      categoryLabel: 'Best Match', categoryEmoji: '⭐', categoryBrief: 'Synthetic bootstrap sample',
      rank: 1, confidence: sample.confidence,
      scores: sample.scores,
      outfitName: 'Synthetic Bootstrap Outfit',
      outfit: {
        top: buildOutfitSlot(), bottom: buildOutfitSlot(), dress: buildOutfitSlot(),
        outerwear: buildOutfitSlot(), footwear: buildOutfitSlot(), accessory: buildOutfitSlot(),
        jewelry: buildOutfitSlot(), bag: buildOutfitSlot(), belt: buildOutfitSlot(),
        watch: buildOutfitSlot(), scarf: buildOutfitSlot(), sunglasses: buildOutfitSlot(), hair_accessory: buildOutfitSlot(),
      },
      status: sample.status,
      userRating: sample.userRating,
      generationMethod: 'deterministic_v2',
      explanationSource: 'template',
    }],
    status: 'complete',
    generationMeta: { candidatePoolSize: randInt(20, 90), diversityMethod: 'mmr_jaccard_v1', pipelineVersion: 'v2-synthetic-bootstrap' },
  };
}

async function main() {
  const count = parseInt(process.argv[2], 10) || 200;
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to Mongo. Generating ${count} synthetic bootstrap samples...`);

  let user = await User.findOne({ email: SYNTHETIC_EMAIL });
  if (!user) {
    user = await User.create({
      name: 'Synthetic Bootstrap (ML training data — not a real user)',
      email: SYNTHETIC_EMAIL, password: 'NotARealAccount123!',
      onboardingCompleted: true, role: 'user', status: 'inactive',
    });
    console.log('Created dedicated synthetic-data user.');
  }

  const sessions = Array.from({ length: count }, () => buildSession(user._id));
  await Recommendation.insertMany(sessions);

  console.log(`Inserted ${count} synthetic Recommendation sessions under ${SYNTHETIC_EMAIL}.`);
  console.log('Run `npm run train:ml` (or the admin Retrain button) now to train on this + any real data.');
  console.log('Remove later with: node scripts/removeSyntheticTrainingBehavior.js');

  await mongoose.disconnect();
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
