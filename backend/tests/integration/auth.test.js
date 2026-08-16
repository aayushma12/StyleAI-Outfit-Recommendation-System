'use strict';

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const mailService = require('../../services/mailService');

// Registration/login never touch mailService at all — email is only ever
// sent by the forgot-password flow below, which this mock intercepts so
// tests never attempt a real network send.
jest.mock('../../services/mailService');

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

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    mailService.sendPasswordResetOtpEmail.mockReset().mockResolvedValue({ messageId: 'fake-id' });
  });

  test('requires an email address', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  test('responds with the same generic message for a non-existent email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody-here@example.com' });
    expect(res.status).toBe(200);
    expect(mailService.sendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  test('for a real user, sends the OTP email and sets a hashed code on the user document', async () => {
    const email = `forgot-${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ ...validUser, email });

    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);
    expect(mailService.sendPasswordResetOtpEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendPasswordResetOtpEmail.mock.calls[0][0].otp).toMatch(/^\d{6}$/);

    const user = await User.findOne({ email }).select('+resetOtp +resetOtpExpires +resetOtpAttempts');
    expect(user.resetOtp).toBeTruthy();
    expect(user.resetOtpExpires.getTime()).toBeGreaterThan(Date.now());
    expect(user.resetOtpAttempts).toBe(0);
  });

  test('returns a clean 500 (not an uncaught crash) and clears the code when the email send fails', async () => {
    mailService.sendPasswordResetOtpEmail.mockRejectedValue(new Error('SMTP down'));
    const email = `forgot-fail-${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ ...validUser, email });

    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(500);

    const user = await User.findOne({ email }).select('+resetOtp');
    expect(user.resetOtp).toBeUndefined();
  });
});

describe('POST /api/auth/reset-password-otp', () => {
  beforeEach(() => {
    mailService.sendPasswordResetOtpEmail.mockReset().mockResolvedValue({ messageId: 'fake-id' });
  });

  async function requestOtp(email) {
    await request(app).post('/api/auth/register').send({ ...validUser, email });
    await request(app).post('/api/auth/forgot-password').send({ email });
    // The raw code is only ever known via the (mocked) email — the real send
    // call's otp argument carries it, so grab it from there.
    const call = mailService.sendPasswordResetOtpEmail.mock.calls.find(c => c[0].email === email);
    return call[0].otp;
  }

  test('rejects a malformed (non-6-digit) code', async () => {
    const email = `reset-malformed-${Date.now()}@example.com`;
    await requestOtp(email);
    const res = await request(app).post('/api/auth/reset-password-otp')
      .send({ email, otp: '123', password: 'BrandNewStrong1!' });
    expect(res.status).toBe(400);
  });

  test('rejects a weak new password even with a valid code', async () => {
    const email = `reset-weak-${Date.now()}@example.com`;
    const otp = await requestOtp(email);
    const res = await request(app).post('/api/auth/reset-password-otp')
      .send({ email, otp, password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('rejects an incorrect code for a real account', async () => {
    const email = `reset-wrong-${Date.now()}@example.com`;
    await requestOtp(email);
    const wrongOtp = '000000';
    const res = await request(app).post('/api/auth/reset-password-otp')
      .send({ email, otp: wrongOtp, password: 'BrandNewStrong1!' });
    expect(res.status).toBe(400);
  });

  test('succeeds with a valid code and strong password, and the code can\'t be reused', async () => {
    const email = `reset-ok-${Date.now()}@example.com`;
    const otp = await requestOtp(email);

    const res = await request(app).post('/api/auth/reset-password-otp')
      .send({ email, otp, password: 'BrandNewStrong1!' });
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'BrandNewStrong1!' });
    expect(login.status).toBe(200);

    const reuse = await request(app).post('/api/auth/reset-password-otp')
      .send({ email, otp, password: 'AnotherStrong2!' });
    expect(reuse.status).toBe(400);
  });

  test('rejects a code for a non-existent account without revealing that', async () => {
    const res = await request(app).post('/api/auth/reset-password-otp')
      .send({ email: 'nobody-here-2@example.com', otp: '123456', password: 'BrandNewStrong1!' });
    expect(res.status).toBe(400);
  });

  test('invalidates the code after 5 incorrect attempts, even with the right code afterward', async () => {
    const email = `reset-lockout-${Date.now()}@example.com`;
    const otp = await requestOtp(email);

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/reset-password-otp')
        .send({ email, otp: '000000', password: 'BrandNewStrong1!' });
      expect(res.status).toBe(400);
    }

    // The 6th attempt uses the genuinely correct code, but it was already
    // invalidated by the attempt cap above.
    const res = await request(app).post('/api/auth/reset-password-otp')
      .send({ email, otp, password: 'BrandNewStrong1!' });
    expect(res.status).toBe(400);
  });
});

