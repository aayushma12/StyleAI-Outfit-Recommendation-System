'use strict';

const request = require('supertest');
const app = require('../../app');
const Recommendation = require('../../models/Recommendation');
const WardrobeItem = require('../../models/WardrobeItem');
const WardrobeCombo = require('../../models/WardrobeCombo');
const Outfit = require('../../models/Outfit');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Rec Test User', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user?._id || res.body.user?.id };
}

async function mkWardrobeItem(userId, overrides = {}) {
  return WardrobeItem.create({
    user: userId, name: 'Test Top', category: 'tops', color: 'blue', occasion: 'daily', ...overrides,
  });
}

async function mkSession(userId, { category = 'best_match', topItemId, status = 'pending' } = {}) {
  return Recommendation.create({
    user: userId,
    context: { occasion: 'daily', season: 'spring', weather: { temp: 22, condition: 'Clear' } },
    recommendations: [{
      category,
      categoryLabel: 'Best Match',
      confidence: 88,
      outfitName: 'Test Outfit',
      outfit: {
        top: { item: topItemId, name: 'Test Top' },
        bottom: { name: '', suggestion: 'dark jeans' },
      },
      explanation: { summary: 'A clean, weather-appropriate look.' },
      status,
    }],
  });
}

describe('POST /api/recommendations/:id/feedback — Saved Outfits integration', () => {
  let token, userId;

  beforeEach(async () => {
    ({ token, userId } = await registerAndGetToken(`rec-test-${Date.now()}-${Math.random()}@example.com`));
  });

  test('saving an AI recommendation creates a linked WardrobeCombo with score + explanation', async () => {
    const item = await mkWardrobeItem(userId);
    const session = await mkSession(userId, { topItemId: item._id });

    const res = await request(app)
      .post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'best_match', status: 'saved' });

    expect(res.status).toBe(200);

    const combo = await WardrobeCombo.findOne({ user: userId, sourceRecommendationId: session._id });
    expect(combo).not.toBeNull();
    expect(combo.source).toBe('recommendation');
    expect(combo.aiConfidence).toBe(88);
    expect(combo.aiExplanation.summary).toBe('A clean, weather-appropriate look.');
    expect(combo.items.map(String)).toContain(String(item._id));
    expect(combo.season).toBe('spring');
  });

  test('re-saving the same category is idempotent (no duplicate combo)', async () => {
    const item = await mkWardrobeItem(userId);
    const session = await mkSession(userId, { topItemId: item._id });

    await request(app).post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`).send({ category: 'best_match', status: 'saved' });
    await request(app).post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`).send({ category: 'best_match', status: 'saved' });

    const combos = await WardrobeCombo.find({ user: userId, sourceRecommendationId: session._id });
    expect(combos.length).toBe(1);
  });

  test('undoing (status: pending) removes the linked combo', async () => {
    const item = await mkWardrobeItem(userId);
    const session = await mkSession(userId, { topItemId: item._id });

    await request(app).post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`).send({ category: 'best_match', status: 'saved' });
    expect(await WardrobeCombo.countDocuments({ user: userId, sourceRecommendationId: session._id })).toBe(1);

    const undoRes = await request(app).post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`).send({ category: 'best_match', status: 'pending' });
    expect(undoRes.status).toBe(200);

    expect(await WardrobeCombo.countDocuments({ user: userId, sourceRecommendationId: session._id })).toBe(0);
  });

  test('the manual Outfit Builder save flow is unaffected', async () => {
    const item = await mkWardrobeItem(userId);
    const res = await request(app).post('/api/wardrobe/outfits/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Manual Look', items: [item._id], occasion: 'daily', matchScore: 70 });

    expect(res.status).toBe(201);
    expect(res.body.combination.source).toBe('manual');
    expect(res.body.combination.sourceRecommendationId).toBeFalsy();
  });

  test('a non-"saved" status (e.g. disliked) does not create a combo', async () => {
    const item = await mkWardrobeItem(userId);
    const session = await mkSession(userId, { topItemId: item._id });

    await request(app).post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`).send({ category: 'best_match', status: 'disliked' });

    expect(await WardrobeCombo.countDocuments({ user: userId, sourceRecommendationId: session._id })).toBe(0);
  });
});

describe('POST /api/recommendations/daily/regenerate', () => {
  test('returns a different session than the cached GET /daily on the same day', async () => {
    const { token, userId } = await registerAndGetToken(`daily-test-${Date.now()}-${Math.random()}@example.com`);
    await mkWardrobeItem(userId, { name: 'Regen Top' });
    await mkWardrobeItem(userId, { name: 'Regen Bottom', category: 'bottoms', color: 'black' });

    const first = await request(app).get('/api/recommendations/daily').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    const regenerated = await request(app).post('/api/recommendations/daily/regenerate').set('Authorization', `Bearer ${token}`);
    expect(regenerated.status).toBe(200);
    expect(String(regenerated.body.session._id)).not.toBe(String(first.body.session._id));

    // A subsequent passive GET should now see the regenerated session (latest wins).
    const second = await request(app).get('/api/recommendations/daily').set('Authorization', `Bearer ${token}`);
    expect(String(second.body.session._id)).toBe(String(regenerated.body.session._id));
  }, 60000);
});

describe('POST /api/recommendations/:id/feedback — session-level adaptive re-ranking', () => {
  test('disliking a rec with "wrong_color" boosts a differently-colored pending rec over a same-colored one', async () => {
    const { token, userId } = await registerAndGetToken(`rerank-test-${Date.now()}-${Math.random()}@example.com`);

    const redTop = await mkWardrobeItem(userId, { name: 'Red Top', color: 'red', colorHex: ['#cc2222'] });
    const blueTop = await mkWardrobeItem(userId, { name: 'Blue Top', color: 'blue', colorHex: ['#2222cc'] });

    const session = await Recommendation.create({
      user: userId,
      context: { occasion: 'daily', season: 'spring', weather: { temp: 22, condition: 'Clear' } },
      recommendations: [
        {
          category: 'best_match', categoryLabel: 'Best Match', confidence: 80,
          outfitName: 'Red Look', outfit: { top: { item: redTop._id, name: 'Red Top' } },
          explanation: { summary: 'Red outfit.' }, status: 'pending',
        },
        {
          category: 'most_stylish', categoryLabel: 'Most Stylish', confidence: 70,
          outfitName: 'Also Red Look', outfit: { top: { item: redTop._id, name: 'Red Top' } },
          explanation: { summary: 'Also red.' }, status: 'pending',
        },
        {
          category: 'weather_optimized', categoryLabel: 'Weather Smart', confidence: 70,
          outfitName: 'Blue Look', outfit: { top: { item: blueTop._id, name: 'Blue Top' } },
          explanation: { summary: 'Blue outfit.' }, status: 'pending',
        },
      ],
    });

    const res = await request(app)
      .post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'best_match', status: 'disliked', reasons: ['wrong_color'] });

    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();

    const stylish = res.body.session.find(r => r.category === 'most_stylish'); // shares red with the disliked rec
    const weather = res.body.session.find(r => r.category === 'weather_optimized'); // blue — not penalized
    expect(weather.confidence).toBeGreaterThan(stylish.confidence);
  });

  test('a dislike with no reasons does not include a session in the response (unchanged behavior)', async () => {
    const { token, userId } = await registerAndGetToken(`rerank-noreasons-${Date.now()}-${Math.random()}@example.com`);
    const item = await mkWardrobeItem(userId);
    const session = await mkSession(userId, { topItemId: item._id });

    const res = await request(app)
      .post(`/api/recommendations/${session._id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'best_match', status: 'disliked' });

    expect(res.status).toBe(200);
    expect(res.body.session).toBeUndefined();
    expect(res.body.updated).toEqual({ category: 'best_match', status: 'disliked', rating: null });
  });
});

describe('POST /api/recommendations/wizard — 3-question flow (occasion, style, notes only)', () => {
  test('generates a session from just occasion + style + extraNotes', async () => {
    const { token, userId } = await registerAndGetToken(`wizard-test-${Date.now()}-${Math.random()}@example.com`);

    await WardrobeItem.insertMany([
      { user: userId, name: 'Blazer', category: 'tops', color: 'black', colorHex: ['#111111'], occasion: 'office', formalityLevel: 4 },
      { user: userId, name: 'Trousers', category: 'bottoms', color: 'black', colorHex: ['#111111'], occasion: 'office', formalityLevel: 4 },
      { user: userId, name: 'Oxford Shoes', category: 'footwear', color: 'black', colorHex: ['#111111'], occasion: 'office', formalityLevel: 4 },
      { user: userId, name: 'Gold Cufflinks', category: 'accessories', subcategory: 'jewelry', color: 'gold', occasion: 'office' },
    ]);

    const res = await request(app).post('/api/recommendations/wizard')
      .set('Authorization', `Bearer ${token}`)
      .send({ occasion: 'office', style: 'Smart Casual', extraNotes: 'Nothing synthetic please' });

    expect(res.status).toBe(200);
    expect(res.body.session.recommendations.length).toBeGreaterThan(0);
    expect(res.body.session.wizardContext).toMatchObject({ occasion: 'office', style: 'Smart Casual', extraNotes: 'Nothing synthetic please' });
  });

  test('budget/dresscode/vibe are no longer collectible from the wizard, so those scoring dimensions persist as null — same as a standard session', async () => {
    const { token, userId } = await registerAndGetToken(`wizard-nulls-${Date.now()}-${Math.random()}@example.com`);
    await mkWardrobeItem(userId, { name: 'Office Top', category: 'tops', occasion: 'office' });
    await mkWardrobeItem(userId, { name: 'Office Bottom', category: 'bottoms', occasion: 'office' });

    const res = await request(app).post('/api/recommendations/wizard')
      .set('Authorization', `Bearer ${token}`)
      .send({ occasion: 'office', style: 'Formal' });

    expect(res.status).toBe(200);
    const scores = res.body.session.recommendations[0].scores;
    expect(scores.dresscodeFit).toBeNull();
    expect(scores.vibeMatch).toBeNull();
    expect(scores.budgetFit).toBeNull();
  });

  test('a standard (non-wizard) session never carries the wizard-only score keys', async () => {
    const { token, userId } = await registerAndGetToken(`wizard-standard-${Date.now()}-${Math.random()}@example.com`);
    await mkWardrobeItem(userId, { name: 'Daily Top', category: 'tops', occasion: 'daily' });
    await mkWardrobeItem(userId, { name: 'Daily Bottom', category: 'bottoms', occasion: 'daily' });

    const res = await request(app).post('/api/recommendations/generate')
      .set('Authorization', `Bearer ${token}`).send({ occasion: 'daily' });

    expect(res.status).toBe(200);
    const scores = res.body.session.recommendations[0].scores;
    // The schema declares these fields with `default: null` (so the shape is
    // consistent across all sessions once persisted) — a standard session
    // never has real signal for them, so they round-trip as null, not a
    // computed value.
    expect(scores.dresscodeFit).toBeNull();
    expect(scores.vibeMatch).toBeNull();
    expect(scores.budgetFit).toBeNull();
  });
});

describe('Complete-outfit-set recognition (isCompleteOutfit) — end-to-end', () => {
  test('a co-ord set explicitly tagged category:"tops" never gets recommended alongside a separate bottom', async () => {
    const { token, userId } = await registerAndGetToken(`coord-set-${Date.now()}-${Math.random()}@example.com`);
    await mkWardrobeItem(userId, {
      name: 'Cream Co-ord Set', category: 'tops', color: 'cream',
      isCompleteOutfit: true, occasion: 'daily', formalityLevel: 1,
    });
    await mkWardrobeItem(userId, { name: 'Blue Jeans', category: 'bottoms', color: 'blue', occasion: 'daily', formalityLevel: 1 });
    await mkWardrobeItem(userId, { name: 'White Sneakers', category: 'footwear', color: 'white', occasion: 'daily', formalityLevel: 1 });

    const res = await request(app).post('/api/recommendations/generate')
      .set('Authorization', `Bearer ${token}`).send({ occasion: 'daily' });

    expect(res.status).toBe(200);
    for (const rec of res.body.session.recommendations) {
      const outfit = rec.outfit;
      const hasDress  = !!(outfit.dress?.name  || outfit.dress?.item);
      const hasBottom = !!(outfit.bottom?.name || outfit.bottom?.item);
      expect(hasDress && hasBottom).toBe(false);
    }
  });
});

describe('Recommendation.populateAndSanitize — never leaks an unverified catalog image', () => {
  let userId;
  beforeEach(async () => {
    ({ userId } = await registerAndGetToken(`img-verify-${Date.now()}-${Math.random()}@example.com`));
  });

  test('strips imageUrl from an unverified suggestedItem but keeps it for a verified one', async () => {
    const unverified = await Outfit.create({
      name: 'Unverified Heels', category: 'footwear', imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/heels.jpg', imageVerified: false,
    });
    const verified = await Outfit.create({
      name: 'Verified Bag', category: 'accessories', imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/bag.jpg', imageVerified: true,
    });

    const session = await Recommendation.create({
      user: userId,
      recommendations: [{
        category: 'best_match', outfitName: 'Test', outfit: {
          footwear: { suggestedItem: unverified._id, name: unverified.name },
          bag:      { suggestedItem: verified._id,   name: verified.name },
        },
      }],
    });

    const sanitized = await Recommendation.populateAndSanitize(Recommendation.findById(session._id));

    expect(sanitized.recommendations[0].outfit.footwear.suggestedItem.imageUrl).toBe('');
    expect(sanitized.recommendations[0].outfit.bag.suggestedItem.imageUrl).toBe('https://res.cloudinary.com/demo/image/upload/v1/bag.jpg');
  });

  test('a real end-to-end /api/recommendations/generate response never contains an unverified image', async () => {
    const { token } = await registerAndGetToken(`img-verify-e2e-${Date.now()}-${Math.random()}@example.com`);
    await Outfit.create({
      name: 'Unverified Office Heels', category: 'footwear', occasion: ['office'],
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/unverified.jpg', imageVerified: false,
    });

    const res = await request(app).post('/api/recommendations/generate')
      .set('Authorization', `Bearer ${token}`).send({ occasion: 'office' });

    expect(res.status).toBe(200);
    for (const rec of res.body.session.recommendations) {
      for (const slot of Object.values(rec.outfit)) {
        if (slot?.suggestedItem && !slot.suggestedItem.imageVerified) {
          expect(slot.suggestedItem.imageUrl).toBe('');
        }
      }
    }
  });
});
