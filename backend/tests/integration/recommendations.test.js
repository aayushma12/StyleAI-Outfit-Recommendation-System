'use strict';

const request = require('supertest');
const app = require('../../app');
const Recommendation = require('../../models/Recommendation');
const WardrobeItem = require('../../models/WardrobeItem');
const WardrobeCombo = require('../../models/WardrobeCombo');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Rec Test User', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user?._id || res.body.user?.id };
}

async function mkWardrobeItem(userId, overrides = {}) {
  return WardrobeItem.create({
    user: userId, name: 'Test Top', category: 'tops', color: 'blue', ...overrides,
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
