'use strict';

const request = require('supertest');
const app = require('../../app');
const WardrobeItem = require('../../models/WardrobeItem');
const WardrobeCombo = require('../../models/WardrobeCombo');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Wardrobe Test User', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return res.body.token;
}

describe('Wardrobe item CRUD + validation', () => {
  let token;

  beforeEach(async () => {
    token = await registerAndGetToken(`wardrobe-test-${Date.now()}-${Math.random()}@example.com`);
  });

  test('rejects creation with missing required fields', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('rejects an invalid category', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', category: 'not-a-real-category', color: 'blue', occasion: 'daily' });
    expect(res.status).toBe(400);
  });

  test('rejects a retired category value (jackets/traditional no longer valid)', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Jacket', category: 'jackets', color: 'blue', occasion: 'daily' });
    expect(res.status).toBe(400);
  });

  test('rejects creation with a missing occasion', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', category: 'tops', color: 'blue' });
    expect(res.status).toBe(400);
  });

  test('rejects creation with an invalid occasion value', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', category: 'tops', color: 'blue', occasion: 'not-a-real-occasion' });
    expect(res.status).toBe(400);
  });

  test('rejects a non-Cloudinary imageUrl (SSRF guard applied at the route layer)', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', category: 'tops', color: 'blue', imageUrl: 'http://169.254.169.254/latest/meta-data/' });
    expect(res.status).toBe(400);
  });

  test('creates a valid item and returns it', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', category: 'tops', color: 'blue', occasion: 'daily' });
    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Test Shirt');
    expect(res.body.item._id).toBeDefined();
  });

  test('full lifecycle: create -> get -> partial update -> delete', async () => {
    const create = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lifecycle Item', category: 'tops', color: 'red', occasion: 'daily' });
    const id = create.body.item._id;

    const get = await request(app).get(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.item.name).toBe('Lifecycle Item');

    // Partial update (only notes) must succeed without requiring name/category/color.
    const update = await request(app).put(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ notes: 'updated notes only' });
    expect(update.status).toBe(200);
    expect(update.body.item.notes).toBe('updated notes only');
    expect(update.body.item.name).toBe('Lifecycle Item'); // untouched

    const del = await request(app).delete(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const getAfterDelete = await request(app).get(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${token}`);
    expect(getAfterDelete.status).toBe(404);
  });

  test('rejects a bad category on a partial update without requiring the other fields', async () => {
    const create = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Item', category: 'tops', color: 'blue', occasion: 'daily' });
    const id = create.body.item._id;

    const res = await request(app).put(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ category: 'bogus-category' });
    expect(res.status).toBe(400);
  });

  test('returns a clean 400 (not a 500) for a malformed ObjectId', async () => {
    const res = await request(app).get('/api/wardrobe/not-a-valid-object-id').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('a wardrobe item created by one user is not accessible to another', async () => {
    const create = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Private Item', category: 'tops', color: 'blue', occasion: 'daily' });
    const id = create.body.item._id;

    const otherToken = await registerAndGetToken(`other-user-${Date.now()}@example.com`);
    const res = await request(app).get(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404); // scoped to req.user._id — another user's item looks nonexistent, not forbidden
  });
});

describe('AI-detected metadata actually persists (regression: pattern used to be silently dropped)', () => {
  let token;
  beforeEach(async () => {
    token = await registerAndGetToken(`ai-meta-persist-${Date.now()}-${Math.random()}@example.com`);
  });

  test('pattern, neckline, genderCategory, and details all persist on create', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`).send({
      name: 'AI Tagged Item', category: 'tops', color: 'blue', occasion: 'daily',
      pattern: 'striped', neckline: 'v_neck', genderCategory: 'women',
      details: { hasHood: false, hasButtons: true, hasZipper: false, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false },
    });
    expect(res.status).toBe(201);
    expect(res.body.item.pattern).toBe('striped');
    expect(res.body.item.neckline).toBe('v_neck');
    expect(res.body.item.genderCategory).toBe('women');
    expect(res.body.item.details.hasButtons).toBe(true);

    // Re-fetch independently to confirm it actually reached the database,
    // not just echoed back in the create response.
    const refetch = await request(app).get(`/api/wardrobe/${res.body.item._id}`).set('Authorization', `Bearer ${token}`);
    expect(refetch.body.item.pattern).toBe('striped');
    expect(refetch.body.item.neckline).toBe('v_neck');
    expect(refetch.body.item.genderCategory).toBe('women');
  });

  test('pattern, neckline, genderCategory, and details all persist on update', async () => {
    const create = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Update Target', category: 'tops', color: 'red', occasion: 'daily' });
    const id = create.body.item._id;

    const update = await request(app).put(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${token}`).send({
      pattern: 'floral', neckline: 'boat_neck', genderCategory: 'unisex',
      details: { hasHood: true, hasButtons: false, hasZipper: true, hasPockets: false, hasLogo: false, hasBelt: false, isTransparent: false },
    });
    expect(update.status).toBe(200);
    expect(update.body.item.pattern).toBe('floral');
    expect(update.body.item.neckline).toBe('boat_neck');
    expect(update.body.item.genderCategory).toBe('unisex');
    expect(update.body.item.details.hasZipper).toBe(true);
  });

  test('isCompleteOutfit persists on create and update (regression: same silent-drop bug class)', async () => {
    const create = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`).send({
      name: 'Co-ord Set', category: 'tops', color: 'cream', occasion: 'daily', isCompleteOutfit: true,
    });
    expect(create.status).toBe(201);
    expect(create.body.item.isCompleteOutfit).toBe(true);

    const refetch = await request(app).get(`/api/wardrobe/${create.body.item._id}`).set('Authorization', `Bearer ${token}`);
    expect(refetch.body.item.isCompleteOutfit).toBe(true);

    const update = await request(app).put(`/api/wardrobe/${create.body.item._id}`).set('Authorization', `Bearer ${token}`)
      .send({ isCompleteOutfit: false });
    expect(update.status).toBe(200);
    expect(update.body.item.isCompleteOutfit).toBe(false);
  });
});

describe('Deleting a wardrobe item referenced by a saved combo', () => {
  let token;
  beforeEach(async () => {
    token = await registerAndGetToken(`combo-cleanup-test-${Date.now()}-${Math.random()}@example.com`);
  });

  test('removes the item from the combo cleanly instead of leaving a dangling ref', async () => {
    const item1 = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Combo Top', category: 'tops', color: 'blue', occasion: 'daily' });
    const item2 = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Combo Bottom', category: 'bottoms', color: 'black', occasion: 'daily' });

    const combo = await request(app).post('/api/wardrobe/outfits/save').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Combo', items: [item1.body.item._id, item2.body.item._id], occasion: 'daily' });
    expect(combo.status).toBe(201);
    expect(combo.body.combination.items.length).toBe(2);

    const del = await request(app).delete(`/api/wardrobe/${item1.body.item._id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const after = await request(app).get('/api/wardrobe/outfits/saved').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    const reloadedCombo = after.body.combinations.find(c => c._id === combo.body.combination._id);
    expect(reloadedCombo.items.length).toBe(1); // shrunk, not nulled
    expect(reloadedCombo.items.every(Boolean)).toBe(true); // no null entries at all
    expect(reloadedCombo.items[0].name).toBe('Combo Bottom');
  });
});

describe('POST /api/wardrobe/analyze', () => {
  let token;
  beforeEach(async () => {
    token = await registerAndGetToken(`analyze-test-${Date.now()}@example.com`);
  });

  test('requires imageUrl', async () => {
    const res = await request(app).post('/api/wardrobe/analyze').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  test('rejects a non-Cloudinary imageUrl', async () => {
    const res = await request(app).post('/api/wardrobe/analyze').set('Authorization', `Bearer ${token}`)
      .send({ imageUrl: 'http://internal-service:8000/secrets' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/wardrobe/outfit-preview — ad-hoc composite, never persisted', () => {
  let token, userId;
  beforeEach(async () => {
    const email = `outfit-preview-test-${Date.now()}-${Math.random()}@example.com`;
    const res = await request(app).post('/api/auth/register').send({
      name: 'Preview Test User', email, password: 'StrongP@ss123', consentGiven: 'true',
    });
    token = res.body.token;
    userId = res.body.user?._id || res.body.user?.id;
  });

  test('returns { url: null } when no item ids are supplied', async () => {
    const res = await request(app).get('/api/wardrobe/outfit-preview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: null });
  });

  test('returns { url: null } gracefully when items have no real images, and never creates a WardrobeCombo', async () => {
    const item = await WardrobeItem.create({ user: userId, name: 'Test Top', category: 'tops', color: 'blue', occasion: 'daily' });

    const res = await request(app).get(`/api/wardrobe/outfit-preview?items=${item._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: null });
    expect(await WardrobeCombo.countDocuments({ user: userId })).toBe(0);
  });

  test('only composites items belonging to the requesting user', async () => {
    const otherRes = await request(app).post('/api/auth/register').send({
      name: 'Other User', email: `outfit-preview-other-${Date.now()}@example.com`,
      password: 'StrongP@ss123', consentGiven: 'true',
    });
    const otherUserId = otherRes.body.user?._id || otherRes.body.user?.id;
    const otherItem = await WardrobeItem.create({ user: otherUserId, name: 'Not Mine', category: 'tops', color: 'red', occasion: 'daily' });

    const res = await request(app).get(`/api/wardrobe/outfit-preview?items=${otherItem._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: null });
  });
});

describe('GET /api/wardrobe/stats', () => {
  test('includes utilizationRate alongside the existing breakdown fields', async () => {
    const token = await registerAndGetToken(`stats-util-${Date.now()}-${Math.random()}@example.com`);
    await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Stats Top', category: 'tops', color: 'blue', occasion: 'daily' });

    const res = await request(app).get('/api/wardrobe/stats').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.utilizationRate).toBe('number');
    expect(res.body.total).toBe(1);
  });

  test('returns utilizationRate:0 rather than crashing for an empty wardrobe', async () => {
    const token = await registerAndGetToken(`stats-util-empty-${Date.now()}-${Math.random()}@example.com`);
    const res = await request(app).get('/api/wardrobe/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.utilizationRate).toBe(0);
  });
});
