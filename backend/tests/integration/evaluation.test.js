'use strict';

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const EvaluationResponse = require('../../models/EvaluationResponse');

const ADMIN_PASSWORD = 'StrongAdmin@Pass1';

async function mkAdminToken() {
  const email = `admin-${Date.now()}-${Math.random()}@example.com`;
  await User.create({
    name: 'Test Admin', email,
    password: ADMIN_PASSWORD, consentGiven: true, role: 'admin', emailVerified: true,
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: ADMIN_PASSWORD });
  return res.body.token;
}

const VALID_PAYLOAD = {
  participantLabel: 'P1',
  recommendationQuality: 5,
  easeOfUse: 4,
  visualDesign: 4,
  systemSpeed: 3,
  overallSatisfaction: 5,
  comments: 'Really liked the outfit suggestions.',
};

describe('POST /api/evaluation — public usability survey submission', () => {
  test('accepts a fully valid submission with no auth required', async () => {
    const res = await request(app).post('/api/evaluation').send(VALID_PAYLOAD);
    expect(res.status).toBe(201);
    expect(res.body.response.recommendationQuality).toBe(5);
    expect(res.body.response.participantLabel).toBe('P1');
  });

  test('rejects a Likert field outside 1-5', async () => {
    const res = await request(app).post('/api/evaluation').send({ ...VALID_PAYLOAD, easeOfUse: 7 });
    expect(res.status).toBe(400);
  });

  test('rejects a missing Likert field', async () => {
    const { overallSatisfaction, ...rest } = VALID_PAYLOAD;
    const res = await request(app).post('/api/evaluation').send(rest);
    expect(res.status).toBe(400);
  });

  test('participantLabel and comments are optional', async () => {
    const { participantLabel, comments, ...rest } = VALID_PAYLOAD;
    const res = await request(app).post('/api/evaluation').send(rest);
    expect(res.status).toBe(201);
    expect(res.body.response.participantLabel).toBe('');
  });
});

describe('GET /api/admin/evaluation-results — admin-only aggregation', () => {
  test('rejects a non-admin request', async () => {
    const res = await request(app).get('/api/admin/evaluation-results');
    expect(res.status).toBe(401);
  });

  test('reflects a just-submitted response in the aggregate averages', async () => {
    await EvaluationResponse.deleteMany({});
    await request(app).post('/api/evaluation').send(VALID_PAYLOAD);
    await request(app).post('/api/evaluation').send({ ...VALID_PAYLOAD, recommendationQuality: 3, participantLabel: 'P2' });

    const adminToken = await mkAdminToken();
    const res = await request(app).get('/api/admin/evaluation-results').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.averages.recommendationQuality).toBe(4); // (5 + 3) / 2
    expect(res.body.responses.length).toBe(2);
  });
});

describe('GET /api/admin/reports/evaluation — CSV export', () => {
  test('returns a CSV with the submitted rows', async () => {
    await EvaluationResponse.deleteMany({});
    await request(app).post('/api/evaluation').send(VALID_PAYLOAD);

    const adminToken = await mkAdminToken();
    const res = await request(app).get('/api/admin/reports/evaluation').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Recommendation Quality');
    expect(res.text).toContain('P1');
  });
});
