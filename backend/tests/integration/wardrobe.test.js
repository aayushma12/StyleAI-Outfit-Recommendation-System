'use strict';

const request = require('supertest');
const app = require('../../app');

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
      .send({ name: 'Test Shirt', category: 'not-a-real-category', color: 'blue' });
    expect(res.status).toBe(400);
  });

  test('rejects a non-Cloudinary imageUrl (SSRF guard applied at the route layer)', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', category: 'tops', color: 'blue', imageUrl: 'http://169.254.169.254/latest/meta-data/' });
    expect(res.status).toBe(400);
  });

  test('creates a valid item and returns it', async () => {
    const res = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', category: 'tops', color: 'blue' });
    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Test Shirt');
    expect(res.body.item._id).toBeDefined();
  });

  test('full lifecycle: create -> get -> partial update -> delete', async () => {
    const create = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lifecycle Item', category: 'tops', color: 'red' });
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
      .send({ name: 'Test Item', category: 'tops', color: 'blue' });
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
      .send({ name: 'Private Item', category: 'tops', color: 'blue' });
    const id = create.body.item._id;

    const otherToken = await registerAndGetToken(`other-user-${Date.now()}@example.com`);
    const res = await request(app).get(`/api/wardrobe/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404); // scoped to req.user._id — another user's item looks nonexistent, not forbidden
  });
});

describe('Deleting a wardrobe item referenced by a saved combo', () => {
  let token;
  beforeEach(async () => {
    token = await registerAndGetToken(`combo-cleanup-test-${Date.now()}-${Math.random()}@example.com`);
  });

  test('removes the item from the combo cleanly instead of leaving a dangling ref', async () => {
    const item1 = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Combo Top', category: 'tops', color: 'blue' });
    const item2 = await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Combo Bottom', category: 'bottoms', color: 'black' });

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
