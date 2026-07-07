'use strict';

const request = require('supertest');
const app = require('../../app');
const AppFeedback = require('../../models/AppFeedback');
const User = require('../../models/User');
const WardrobeCombo = require('../../models/WardrobeCombo');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Feedback Test', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user.id };
}

describe('POST /api/app-feedback', () => {
  test('requires type and a message of at least 10 characters', async () => {
    const { token } = await registerAndGetToken(`fb-short-${Date.now()}@example.com`);
    const res = await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${token}`)
      .send({ type: 'suggestion', message: 'too short' });
    expect(res.status).toBe(400);
  });

  test('rejects an invalid feedback type', async () => {
    const { token } = await registerAndGetToken(`fb-badtype-${Date.now()}@example.com`);
    const res = await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${token}`)
      .send({ type: 'not_a_real_type', message: 'This is a valid length message.' });
    expect(res.status).toBe(400);
  });

  // Regression test — VALID_TYPES previously listed 'bug'/'compliment'/'other',
  // none of which the AppFeedback schema's enum (suggestion/complaint/
  // improvement) actually accepts. A submission with one of those stale
  // values passed the controller's own check and then crashed with an
  // uncaught Mongoose ValidationError at .create() — a raw 500, not a clean
  // 400. VALID_TYPES now matches the schema (and the frontend) exactly.
  test('a type the controller used to wrongly accept ("bug") is now cleanly rejected, not a 500', async () => {
    const { token } = await registerAndGetToken(`fb-staletype-${Date.now()}@example.com`);
    const res = await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${token}`)
      .send({ type: 'bug', message: 'This message is a perfectly valid length.' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid feedback type/i);
  });

  test('rejects a message over 1000 characters (matches the schema\'s maxlength)', async () => {
    const { token } = await registerAndGetToken(`fb-long-${Date.now()}@example.com`);
    const res = await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${token}`)
      .send({ type: 'suggestion', message: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  test('creates feedback and clamps ratings to 1-5', async () => {
    const { token, userId } = await registerAndGetToken(`fb-ok-${Date.now()}@example.com`);
    const res = await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${token}`)
      .send({ type: 'suggestion', message: 'A genuinely useful piece of feedback here.', satisfactionRating: 99 });
    expect(res.status).toBe(201);
    expect(res.body.feedback.satisfactionRating).toBe(5);

    const stored = await AppFeedback.findOne({ user: userId });
    expect(stored.message).toBe('A genuinely useful piece of feedback here.');
  });
});

describe('GET /api/app-feedback', () => {
  test('returns only the authenticated user\'s own feedback', async () => {
    const a = await registerAndGetToken(`fb-mine-${Date.now()}@example.com`);
    const b = await registerAndGetToken(`fb-other-${Date.now()}@example.com`);
    await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${a.token}`)
      .send({ type: 'suggestion', message: 'A message from user A here.' });
    await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${b.token}`)
      .send({ type: 'suggestion', message: 'A message from user B here.' });

    const res = await request(app).get('/api/app-feedback').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.feedbacks[0].message).toBe('A message from user A here.');
  });
});

describe('GET /api/app-feedback/public — no auth required', () => {
  test('only returns feedback explicitly marked isPublic', async () => {
    const { token } = await registerAndGetToken(`fb-public-${Date.now()}@example.com`);
    const created = await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${token}`)
      .send({ type: 'improvement', message: 'This app is genuinely great to use.' });
    await AppFeedback.findByIdAndUpdate(created.body.feedback._id, { isPublic: true });

    const res = await request(app).get('/api/app-feedback/public');
    expect(res.status).toBe(200);
    expect(res.body.testimonials.length).toBe(1);
    expect(res.body.testimonials[0].message).toBe('This app is genuinely great to use.');
  });

  test('exposes only the first name, not the full name (privacy)', async () => {
    const { token } = await registerAndGetToken(`fb-privacy-${Date.now()}@example.com`);
    const created = await request(app).post('/api/app-feedback').set('Authorization', `Bearer ${token}`)
      .send({ type: 'improvement', message: 'Another genuinely nice compliment here.' });
    await AppFeedback.findByIdAndUpdate(created.body.feedback._id, { isPublic: true });

    const res = await request(app).get('/api/app-feedback/public');
    const testimonial = res.body.testimonials.find(t => t.message.includes('Another genuinely'));
    expect(testimonial.name).toBe('Feedback');
    expect(testimonial.name).not.toContain('Test');
  });
});

describe('GET /api/app-feedback/public-stats — no auth required', () => {
  test('returns real onboarded-user and combo counts', async () => {
    const { userId } = await registerAndGetToken(`fb-stats-${Date.now()}@example.com`);
    await User.findByIdAndUpdate(userId, { onboardingCompleted: true });
    await WardrobeCombo.create({ user: userId, name: 'A Combo' });

    const res = await request(app).get('/api/app-feedback/public-stats');
    expect(res.status).toBe(200);
    expect(res.body.userCount).toBeGreaterThanOrEqual(1);
    expect(res.body.outfitCount).toBeGreaterThanOrEqual(1);
    expect(res.body.occasionsCount).toBe(8);
  });
});
