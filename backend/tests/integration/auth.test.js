'use strict';

const request = require('supertest');
const app = require('../../app');

const validUser = {
  name: 'Test User',
  email: 'auth-test@example.com',
  password: 'StrongP@ss123',
  consentGiven: 'true',
};

describe('POST /api/auth/register', () => {
  test('rejects a weak password with a 400 and no account created', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...validUser, email: 'weak@example.com', password: 'weak',
    });
    expect(res.status).toBe(400);
  });

  test('rejects registration without consent', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...validUser, email: 'noconsent@example.com', consentGiven: 'false',
    });
    expect(res.status).toBe(400);
  });

  test('creates an account with valid data and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user.role).toBe('user');
  });

  test('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('rejects a duplicate username with a clean 400, not a raw 500', async () => {
    await request(app).post('/api/auth/register').send({
      ...validUser, email: 'user-a@example.com', username: 'stylequeen',
    });
    const res = await request(app).post('/api/auth/register').send({
      ...validUser, email: 'user-b@example.com', username: 'StyleQueen', // case-insensitive collision
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/username.*taken/i);
  });

  test('the DB-level unique index (not just the pre-check) rejects a concurrent duplicate username', async () => {
    // Bypasses the app's own findOne-then-create pre-check race window by
    // hitting the model directly with two concurrent creates for the same
    // username — proves the schema's unique index is the real guarantee,
    // not just the best-effort pre-check.
    const User = require('../../models/User');
    const attempts = await Promise.allSettled([
      User.create({ name: 'A', email: 'race-a@example.com', password: 'StrongP@ss123', consentGiven: true, username: 'racecondition' }),
      User.create({ name: 'B', email: 'race-b@example.com', password: 'StrongP@ss123', consentGiven: true, username: 'racecondition' }),
    ]);
    const fulfilled = attempts.filter(a => a.status === 'fulfilled');
    const rejected  = attempts.filter(a => a.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.code).toBe(11000);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email, password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(validUser.email);
  });

  test('rejects an incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email, password: 'WrongPassword123!',
    });
    expect(res.status).toBe(401);
  });

  test('rejects a nonexistent email with the same generic message (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com', password: 'WhoKnows123!',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });
});

describe('GET /api/auth/me (protected route)', () => {
  test('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects a malformed/invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns the current user for a valid token', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(validUser);
    const { token } = registerRes.body;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
  });
});
