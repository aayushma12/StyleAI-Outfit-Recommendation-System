'use strict';

const request = require('supertest');
const app = require('../../app');
const UserHistory = require('../../models/UserHistory');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'History Test', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user.id };
}

async function mkEntry(userId, overrides = {}) {
  return UserHistory.create({
    user: userId, action: 'wardrobe_added', category: 'wardrobe',
    title: 'Added a top', ...overrides,
  });
}

describe('GET /api/history', () => {
  test('returns only the authenticated user\'s own entries', async () => {
    const a = await registerAndGetToken(`hist-mine-${Date.now()}@example.com`);
    const b = await registerAndGetToken(`hist-other-${Date.now()}@example.com`);
    await mkEntry(a.userId, { title: 'Entry A' });
    await mkEntry(b.userId, { title: 'Entry B' });

    const res = await request(app).get('/api/history').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.logs[0].title).toBe('Entry A');
  });

  test('filters by category', async () => {
    const { token, userId } = await registerAndGetToken(`hist-cat-${Date.now()}@example.com`);
    await mkEntry(userId, { category: 'wardrobe', action: 'wardrobe_added', title: 'Wardrobe entry' });
    await mkEntry(userId, { category: 'calendar', action: 'calendar_scheduled', title: 'Calendar entry' });

    const res = await request(app).get('/api/history?category=calendar').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.logs[0].title).toBe('Calendar entry');
  });

  test('filters by search text across title/description', async () => {
    const { token, userId } = await registerAndGetToken(`hist-search-${Date.now()}@example.com`);
    await mkEntry(userId, { title: 'Blue Denim Jacket added' });
    await mkEntry(userId, { title: 'Red Sneakers added' });

    const res = await request(app).get('/api/history?search=denim').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.logs[0].title).toBe('Blue Denim Jacket added');
  });

  test('filters by date range (from/to)', async () => {
    const { token, userId } = await registerAndGetToken(`hist-daterange-${Date.now()}@example.com`);
    // createdAt must be set at creation time — Mongoose's timestamps plugin
    // re-stamps it on update operations, so a post-hoc findByIdAndUpdate
    // silently has no effect.
    await mkEntry(userId, { title: 'Old entry', createdAt: new Date('2020-01-01') });
    await mkEntry(userId, { title: 'Recent entry' });

    const res = await request(app).get('/api/history?from=2025-01-01').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.logs[0].title).toBe('Recent entry');
  });

  test('paginates results', async () => {
    const { token, userId } = await registerAndGetToken(`hist-page-${Date.now()}@example.com`);
    for (let i = 0; i < 5; i++) await mkEntry(userId, { title: `Entry ${i}` });

    const res = await request(app).get('/api/history?page=1&limit=2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(2);
    expect(res.body.pages).toBe(3);
  });
});

describe('GET /api/history/analytics', () => {
  test('returns zeroed summary for a brand-new user with no activity', async () => {
    const { token } = await registerAndGetToken(`hist-analytics-empty-${Date.now()}@example.com`);
    const res = await request(app).get('/api/history/analytics').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.totalEvents).toBe(0);
    expect(res.body.summary.totalWardrobe).toBe(0);
  });

  test('reflects real history counts by category and action', async () => {
    const { token, userId } = await registerAndGetToken(`hist-analytics-${Date.now()}@example.com`);
    await mkEntry(userId, { category: 'wardrobe', action: 'wardrobe_added' });
    await mkEntry(userId, { category: 'wardrobe', action: 'wardrobe_added' });
    await mkEntry(userId, { category: 'calendar', action: 'calendar_scheduled' });

    const res = await request(app).get('/api/history/analytics').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.totalEvents).toBe(3);
    expect(res.body.activityByCategory.wardrobe).toBe(2);
    expect(res.body.activityByCategory.calendar).toBe(1);
  });
});

describe('DELETE /api/history/:id', () => {
  test('deletes an owned entry', async () => {
    const { token, userId } = await registerAndGetToken(`hist-delete-${Date.now()}@example.com`);
    const entry = await mkEntry(userId);

    const res = await request(app).delete(`/api/history/${entry._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await UserHistory.findById(entry._id)).toBeNull();
  });

  test('404s for an entry owned by another user', async () => {
    const owner = await registerAndGetToken(`hist-owner-${Date.now()}@example.com`);
    const entry = await mkEntry(owner.userId);
    const other = await registerAndGetToken(`hist-notowner-${Date.now()}@example.com`);

    const res = await request(app).delete(`/api/history/${entry._id}`).set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });

  test('returns a clean 400 for a malformed id', async () => {
    const { token } = await registerAndGetToken(`hist-badid-${Date.now()}@example.com`);
    const res = await request(app).delete('/api/history/not-a-valid-id').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/history/bulk', () => {
  test('clears only entries matching the given category', async () => {
    const { token, userId } = await registerAndGetToken(`hist-bulk-${Date.now()}@example.com`);
    await mkEntry(userId, { category: 'wardrobe', action: 'wardrobe_added' });
    await mkEntry(userId, { category: 'wardrobe', action: 'wardrobe_added' });
    await mkEntry(userId, { category: 'calendar', action: 'calendar_scheduled' });

    const res = await request(app).delete('/api/history/bulk').set('Authorization', `Bearer ${token}`)
      .send({ category: 'wardrobe' });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);

    const remaining = await UserHistory.find({ user: userId });
    expect(remaining.length).toBe(1);
    expect(remaining[0].category).toBe('calendar');
  });

  test('clears all entries when no category is specified', async () => {
    const { token, userId } = await registerAndGetToken(`hist-bulk-all-${Date.now()}@example.com`);
    await mkEntry(userId);
    await mkEntry(userId);

    const res = await request(app).delete('/api/history/bulk').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
  });
});
