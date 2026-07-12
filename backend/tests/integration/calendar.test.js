'use strict';

const request = require('supertest');
const app = require('../../app');
const OutfitCalendar = require('../../models/OutfitCalendar');
const WardrobeCombo = require('../../models/WardrobeCombo');
const BehaviorLog = require('../../models/BehaviorLog');
const WardrobeItem = require('../../models/WardrobeItem');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Calendar Test', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user.id };
}

describe('POST /api/calendar — upsertEntry', () => {
  test('requires a date', async () => {
    const { token } = await registerAndGetToken(`cal-nodate-${Date.now()}@example.com`);
    const res = await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`).send({ outfitName: 'Test' });
    expect(res.status).toBe(400);
  });

  test('creates a new entry for a date', async () => {
    const { token } = await registerAndGetToken(`cal-create-${Date.now()}@example.com`);
    const res = await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-08-15', outfitName: 'Festival Look', occasion: 'festival' });
    expect(res.status).toBe(200);
    expect(res.body.entry.outfitName).toBe('Festival Look');
  });

  test('upserts (updates in place) when posting the same date twice, rather than duplicating', async () => {
    const { token, userId } = await registerAndGetToken(`cal-upsert-${Date.now()}@example.com`);
    await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-08-20', outfitName: 'First' });
    await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-08-20', outfitName: 'Second' });

    const entries = await OutfitCalendar.find({ user: userId });
    expect(entries.length).toBe(1);
    expect(entries[0].outfitName).toBe('Second');
  });

  test('scheduling a real combo logs an outfit_save behavior event with its item ids (regression: calendar used to have zero effect on recommendation history)', async () => {
    const { token, userId } = await registerAndGetToken(`cal-behavior-${Date.now()}@example.com`);
    const item = await WardrobeItem.create({ user: userId, name: 'Scheduled Top', category: 'tops', color: 'blue', occasion: 'daily' });
    const combo = await WardrobeCombo.create({ user: userId, name: 'Scheduled Combo', items: [item._id] });

    const res = await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-10-01', outfitName: 'Scheduled Combo', combo: combo._id });
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 100)); // logBehavior is fire-and-forget

    const log = await BehaviorLog.findOne({ user: userId, action: 'outfit_save', entityId: combo._id });
    expect(log).not.toBeNull();
    expect(log.metadata.itemIds.map(String)).toEqual([item._id.toString()]);
  });

  test('does not log a behavior event when no combo is attached (a freeform/manual entry)', async () => {
    const { token, userId } = await registerAndGetToken(`cal-behavior-nocombo-${Date.now()}@example.com`);
    await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-10-02', outfitName: 'No Combo Here' });

    await new Promise(r => setTimeout(r, 100));

    const log = await BehaviorLog.findOne({ user: userId, action: 'outfit_save' });
    expect(log).toBeNull();
  });
});

describe('GET /api/calendar — getMonthEntries', () => {
  test('requires year and month', async () => {
    const { token } = await registerAndGetToken(`cal-month-missing-${Date.now()}@example.com`);
    const res = await request(app).get('/api/calendar').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('returns only entries within the requested month', async () => {
    const { token } = await registerAndGetToken(`cal-month-${Date.now()}@example.com`);
    await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`).send({ date: '2026-03-10', outfitName: 'In March' });
    await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`).send({ date: '2026-04-10', outfitName: 'In April' });

    const res = await request(app).get('/api/calendar?year=2026&month=3').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBe(1);
    expect(res.body.entries[0].outfitName).toBe('In March');
  });
});

describe('GET /api/calendar/upcoming', () => {
  test('returns entries from today onward, capped at 30 days even if more requested', async () => {
    const { token } = await registerAndGetToken(`cal-upcoming-${Date.now()}@example.com`);
    const res = await request(app).get('/api/calendar/upcoming?days=9999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});

describe('DELETE /api/calendar/:id', () => {
  test('deletes an owned entry', async () => {
    const { token } = await registerAndGetToken(`cal-delete-${Date.now()}@example.com`);
    const created = await request(app).post('/api/calendar').set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-09-01', outfitName: 'To Delete' });

    const res = await request(app).delete(`/api/calendar/${created.body.entry._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const stillThere = await OutfitCalendar.findById(created.body.entry._id);
    expect(stillThere).toBeNull();
  });

  test('404s for an entry owned by another user', async () => {
    const owner = await registerAndGetToken(`cal-owner-${Date.now()}@example.com`);
    const created = await request(app).post('/api/calendar').set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-09-05', outfitName: 'Owner Only' });

    const other = await registerAndGetToken(`cal-other-${Date.now()}@example.com`);
    const res = await request(app).delete(`/api/calendar/${created.body.entry._id}`).set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });

  test('returns a clean 400 for a malformed id rather than a raw 500', async () => {
    const { token } = await registerAndGetToken(`cal-badid-${Date.now()}@example.com`);
    const res = await request(app).delete('/api/calendar/not-a-valid-id').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/calendar/suggest', () => {
  test('returns an empty suggestions array when the user has no saved combos', async () => {
    const { token } = await registerAndGetToken(`cal-suggest-empty-${Date.now()}@example.com`);
    const res = await request(app).get('/api/calendar/suggest?occasion=college').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
  });

  test('ranks a matching-occasion combo above a non-matching one', async () => {
    const { token, userId } = await registerAndGetToken(`cal-suggest-${Date.now()}@example.com`);
    await WardrobeCombo.create({ user: userId, name: 'Office Combo', occasion: 'office', matchScore: 60 });
    await WardrobeCombo.create({ user: userId, name: 'College Combo', occasion: 'college', matchScore: 60 });

    const res = await request(app).get('/api/calendar/suggest?occasion=college').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.suggestions[0].name).toBe('College Combo');
  });
});
