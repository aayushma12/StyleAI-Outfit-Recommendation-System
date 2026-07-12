'use strict';

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const WardrobeItem = require('../../models/WardrobeItem');
const visionExtraction = require('../../services/visionExtractionService');

jest.mock('../../services/visionExtractionService');

const ADMIN_PASSWORD = 'StrongAdmin@Pass1';

async function mkAdminToken() {
  const email = `admin-backfill-${Date.now()}-${Math.random()}@example.com`;
  await User.create({
    name: 'Test Admin', email, password: ADMIN_PASSWORD,
    consentGiven: true, role: 'admin', emailVerified: true,
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: ADMIN_PASSWORD });
  return res.body.token;
}

async function mkPlainUserToken() {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Plain User', email: `plain-backfill-${Date.now()}-${Math.random()}@example.com`,
    password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user.id };
}

describe('Admin wardrobe AI-metadata backfill', () => {
  beforeEach(() => {
    visionExtraction.analyzeWardrobeImage.mockReset();
    visionExtraction.analyzeWardrobeImage.mockResolvedValue({
      colorHex: ['#000000'], colorNames: ['black'], subcategory: 'blazer', pattern: 'solid',
      styleTags: ['classic'], suitableSeasons: ['winter'], suitableOccasions: ['office'],
      formalityLevel: 3, layeringLevel: 'mid', accessoryCompatibility: [],
      unverifiedFields: ['colorHex'],
      aiMeta: { extractedAt: new Date(), provider: 'gemini', fieldConfidence: {}, visionAvailable: true },
    });
  });

  test('GET /admin/wardrobe/ai-coverage reports correct total/tagged counts', async () => {
    const adminToken = await mkAdminToken();
    const { token } = await mkPlainUserToken();

    await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Untagged Item', category: 'tops', color: 'blue', occasion: 'daily', imageUrl: 'https://res.cloudinary.com/demo/image/upload/a.jpg' });
    const tagged = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Already Tagged', category: 'tops', color: 'red', occasion: 'daily', imageUrl: 'https://res.cloudinary.com/demo/image/upload/b.jpg' });
    await WardrobeItem.findByIdAndUpdate(tagged.body.item._id, { 'aiMeta.provider': 'gemini' });

    const res = await request(app).get('/api/admin/wardrobe/ai-coverage').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.tagged).toBe(1);
    expect(res.body.coveragePercent).toBe(50);
  });

  test('POST /admin/wardrobe/ai-backfill only processes untagged items', async () => {
    const adminToken = await mkAdminToken();
    const { token } = await mkPlainUserToken();

    const untagged = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Untagged Item', category: 'tops', color: 'blue', occasion: 'daily', imageUrl: 'https://res.cloudinary.com/demo/image/upload/a.jpg' });
    const tagged = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Already Tagged', category: 'tops', color: 'red', occasion: 'daily', imageUrl: 'https://res.cloudinary.com/demo/image/upload/b.jpg' });
    await WardrobeItem.findByIdAndUpdate(tagged.body.item._id, { 'aiMeta.provider': 'gemini' });

    const res = await request(app).post('/api/admin/wardrobe/ai-backfill')
      .set('Authorization', `Bearer ${adminToken}`).send({ limit: 20 });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1); // only the untagged one
    expect(res.body.tagged).toBe(1);
    expect(res.body.failed).toBe(0);
    expect(visionExtraction.analyzeWardrobeImage).toHaveBeenCalledTimes(1);
    expect(visionExtraction.analyzeWardrobeImage).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/a.jpg', 'tops'
    );

    const refreshed = await WardrobeItem.findById(untagged.body.item._id);
    expect(refreshed.aiMeta.provider).toBe('gemini');
    expect(refreshed.styleTags).toEqual(['classic']);
  });

  test('an item stuck at "color-only" (vision failed last time) is NOT counted as tagged and stays eligible for retry', async () => {
    const adminToken = await mkAdminToken();
    const { token } = await mkPlainUserToken();

    const colorOnlyItem = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Color Only Item', category: 'tops', color: 'blue', occasion: 'daily', imageUrl: 'https://res.cloudinary.com/demo/image/upload/c.jpg' });
    await WardrobeItem.findByIdAndUpdate(colorOnlyItem.body.item._id, { 'aiMeta.provider': 'color-only' });

    const coverage = await request(app).get('/api/admin/wardrobe/ai-coverage').set('Authorization', `Bearer ${adminToken}`);
    expect(coverage.body.tagged).toBe(0); // color-only must not count as genuinely tagged
    expect(coverage.body.coveragePercent).toBe(0);

    const res = await request(app).post('/api/admin/wardrobe/ai-backfill')
      .set('Authorization', `Bearer ${adminToken}`).send({ limit: 20 });
    expect(res.body.processed).toBe(1); // eligible for retry, not skipped
    expect(res.body.tagged).toBe(1); // the mock returns a real 'gemini' provider this time
  });

  test('a per-item failure is counted without aborting the whole batch', async () => {
    const adminToken = await mkAdminToken();
    const { token } = await mkPlainUserToken();

    await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Will Fail', category: 'tops', color: 'blue', occasion: 'daily', imageUrl: 'https://res.cloudinary.com/demo/image/upload/a.jpg' });

    visionExtraction.analyzeWardrobeImage.mockRejectedValueOnce(new Error('vision provider timeout'));

    const res = await request(app).post('/api/admin/wardrobe/ai-backfill')
      .set('Authorization', `Bearer ${adminToken}`).send({ limit: 20 });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.tagged).toBe(0);
  });
});
