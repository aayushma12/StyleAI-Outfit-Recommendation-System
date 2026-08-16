'use strict';

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const WardrobeItem = require('../../models/WardrobeItem');
const BehaviorLog = require('../../models/BehaviorLog');
const Recommendation = require('../../models/Recommendation');

const ADMIN_PASSWORD = 'StrongAdmin@Pass1';

async function mkAdminToken() {
  await User.create({
    name: 'Test Admin', email: `admin-${Date.now()}-${Math.random()}@example.com`,
    password: ADMIN_PASSWORD, consentGiven: true, role: 'admin',
  });
  const email = (await User.findOne({ role: 'admin' }).sort({ createdAt: -1 })).email;
  const res = await request(app).post('/api/auth/login').send({ email, password: ADMIN_PASSWORD });
  return res.body.token;
}

async function mkPlainUser(overrides = {}) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Plain User', email: `plain-${Date.now()}-${Math.random()}@example.com`,
    password: 'StrongP@ss123', consentGiven: 'true', ...overrides,
  });
  return { token: res.body.token, userId: res.body.user.id };
}

describe('GET /api/admin/users — search + status combined', () => {
  test('does not silently drop the search term when status=suspended is also supplied', async () => {
    const adminToken = await mkAdminToken();
    const { userId } = await mkPlainUser({ name: 'Findable Suspendo', email: `suspendo-${Date.now()}@example.com` });
    await User.findByIdAndUpdate(userId, { status: 'suspended' });
    await mkPlainUser({ name: 'Other Suspended User' }).then(({ userId: id2 }) =>
      User.findByIdAndUpdate(id2, { status: 'suspended' })
    );

    const res = await request(app)
      .get('/api/admin/users?status=suspended&search=Findable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].name).toBe('Findable Suspendo');
  });
});

describe('GET /api/admin/wardrobe — userId validation', () => {
  test('returns a clean 400 for a malformed userId instead of a raw 500', async () => {
    const adminToken = await mkAdminToken();
    const res = await request(app)
      .get('/api/admin/wardrobe?userId=not-a-valid-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/users/:id — full data cleanup', () => {
  test('removes Recommendation and BehaviorLog documents, not just wardrobe/combo/calendar/feedback', async () => {
    const adminToken = await mkAdminToken();
    const { token, userId } = await mkPlainUser();

    await request(app).post('/api/wardrobe').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Doomed Item', category: 'tops', color: 'blue' });
    await Recommendation.create({ user: userId, recommendations: [{ category: 'best_match', outfitName: 'x', outfit: {} }] });
    await BehaviorLog.create({ user: userId, action: 'wardrobe_add', metadata: {} });

    const del = await request(app).delete(`/api/admin/users/${userId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    expect(await WardrobeItem.countDocuments({ user: userId })).toBe(0);
    expect(await Recommendation.countDocuments({ user: userId })).toBe(0);
    expect(await BehaviorLog.countDocuments({ user: userId })).toBe(0);
    expect(await User.findById(userId)).toBeNull();
  });
});

describe('POST/PUT /api/admin/outfits — imageVerified never trusted implicitly', () => {
  test('defaults imageVerified to false even when an imageUrl is supplied', async () => {
    const adminToken = await mkAdminToken();
    const res = await request(app).post('/api/admin/outfits').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Test Catalog Item', category: 'tops',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/item.jpg',
    });
    expect(res.status).toBe(201);
    expect(res.body.outfit.imageVerified).toBe(false);
  });

  test('persists imageVerified:true only when explicitly set (a real upload or confirmed manual URL)', async () => {
    const adminToken = await mkAdminToken();
    const res = await request(app).post('/api/admin/outfits').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Verified Catalog Item', category: 'footwear',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/item.jpg',
      imageVerified: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.outfit.imageVerified).toBe(true);
  });

  test('rejects a non-Cloudinary imageUrl (SSRF guard applied at the route layer, same as wardrobe)', async () => {
    const adminToken = await mkAdminToken();
    const res = await request(app).post('/api/admin/outfits').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Bad Image Item', category: 'tops', imageUrl: 'http://169.254.169.254/latest/meta-data/',
    });
    expect(res.status).toBe(400);
  });

  test('PUT can toggle imageVerified independently of imageUrl', async () => {
    const adminToken = await mkAdminToken();
    const create = await request(app).post('/api/admin/outfits').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Togglable Item', category: 'tops' });
    const id = create.body.outfit._id;

    const update = await request(app).put(`/api/admin/outfits/${id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/item.jpg', imageVerified: true });
    expect(update.status).toBe(200);
    expect(update.body.outfit.imageVerified).toBe(true);
  });
});
