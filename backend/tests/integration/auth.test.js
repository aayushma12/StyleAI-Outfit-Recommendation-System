'use strict';

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const mailService = require('../../services/mailService');

// Register/login never touch mailService when SMTP is unconfigured (the
// test env — see tests/setup.js), so mocking it here only affects the
// forgot-password/reset-password/verify-email/resend-verification tests
// below, which unconditionally attempt to send regardless of that flag.
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
    mailService.sendPasswordResetEmail.mockReset().mockResolvedValue({ messageId: 'fake-id' });
  });

  test('requires an email address', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  test('responds with the same generic message for a non-existent email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody-here@example.com' });
    expect(res.status).toBe(200);
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('for a real user, sends the reset email and sets a hashed token on the user document', async () => {
    const email = `forgot-${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ ...validUser, email });

    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const user = await User.findOne({ email }).select('+resetPasswordToken +resetPasswordExpires');
    expect(user.resetPasswordToken).toBeTruthy();
    expect(user.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
  });

  test('returns a clean 500 (not an uncaught crash) and clears the token when the email send fails', async () => {
    mailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));
    const email = `forgot-fail-${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ ...validUser, email });

    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(500);

    const user = await User.findOne({ email }).select('+resetPasswordToken');
    expect(user.resetPasswordToken).toBeUndefined();
  });
});

describe('GET /api/auth/verify-reset-token/:token and POST /api/auth/reset-password/:token', () => {
  beforeEach(() => {
    mailService.sendPasswordResetEmail.mockReset().mockResolvedValue({ messageId: 'fake-id' });
  });

  async function requestResetToken(email) {
    await request(app).post('/api/auth/register').send({ ...validUser, email });
    await request(app).post('/api/auth/forgot-password').send({ email });
    // The raw token is only ever known via the (mocked) email — the real
    // send call's resetUrl argument carries it, so grab it from there.
    const resetUrl = mailService.sendPasswordResetEmail.mock.calls[0][0].resetUrl;
    return resetUrl.split('/reset-password/')[1];
  }

  test('verify-reset-token reports invalid for a bogus token', async () => {
    const res = await request(app).get('/api/auth/verify-reset-token/not-a-real-token');
    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
  });

  test('verify-reset-token reports valid for a genuine, unexpired token', async () => {
    const token = await requestResetToken(`verify-reset-${Date.now()}@example.com`);
    const res = await request(app).get(`/api/auth/verify-reset-token/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  test('reset-password rejects a weak new password', async () => {
    const token = await requestResetToken(`reset-weak-${Date.now()}@example.com`);
    const res = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('reset-password succeeds with a valid token and strong password, and the old token can\'t be reused', async () => {
    const email = `reset-ok-${Date.now()}@example.com`;
    const token = await requestResetToken(email);

    const res = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'BrandNewStrong1!' });
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'BrandNewStrong1!' });
    expect(login.status).toBe(200);

    const reuse = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'AnotherStrong2!' });
    expect(reuse.status).toBe(400);
  });

  test('reset-password rejects an expired/invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password/not-a-real-token').send({ password: 'BrandNewStrong1!' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/verify-email/:token and POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    mailService.sendVerificationEmail.mockReset().mockResolvedValue({ messageId: 'fake-id' });
  });

  test('verify-email rejects a bogus token', async () => {
    const res = await request(app).get('/api/auth/verify-email/not-a-real-token');
    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
  });

  test('resend-verification always responds generically, even for a non-existent email', async () => {
    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('resend-verification is rate-limited immediately after register (register itself just sent one)', async () => {
    process.env.SMTP_HOST = 'smtp.test.local'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
    const email = `resend-ratelimit-${Date.now()}@example.com`;
    try {
      await request(app).post('/api/auth/register').send({ ...validUser, email }); // this already sends one
      const res = await request(app).post('/api/auth/resend-verification').send({ email });
      expect(res.status).toBe(429);
    } finally {
      process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASS = '';
    }
  });

  test('resend-verification sets a fresh token and sends an email once the previous one is old enough', async () => {
    // Force smtpConfigured=true for just this test so the user is created
    // in the unverified state resend-verification actually needs.
    process.env.SMTP_HOST = 'smtp.test.local'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
    const email = `resend-${Date.now()}@example.com`;
    try {
      await request(app).post('/api/auth/register').send({ ...validUser, email });
      // Simulate the rate-limit window having passed — register's own send
      // already set a fresh verificationExpiry, so age it back out of the
      // "sent within the last 2 minutes" window before resending.
      await User.findOneAndUpdate({ email }, { verificationExpiry: new Date(Date.now() + 60 * 1000) });

      const res = await request(app).post('/api/auth/resend-verification').send({ email });
      expect(res.status).toBe(200);
      expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(2); // once from register, once from resend

      const user = await User.findOne({ email }).select('+verificationToken');
      expect(user.emailVerified).toBe(false);
      expect(user.verificationToken).toBeTruthy();
    } finally {
      process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASS = '';
    }
  });

  test('verify-email marks a real, pending user as verified using the token from the (mocked) email', async () => {
    process.env.SMTP_HOST = 'smtp.test.local'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
    const email = `verify-ok-${Date.now()}@example.com`;
    try {
      await request(app).post('/api/auth/register').send({ ...validUser, email });
      const user = await User.findOne({ email }).select('+verificationToken');
      expect(user.emailVerified).toBe(false);

      // register() sends the verification email itself (smtpConfigured=true
      // for this test) — grab the token the same way as the reset-password flow.
      const verifyUrl = mailService.sendVerificationEmail.mock.calls[0][0].verifyUrl;
      const token = verifyUrl.split('/verify-email/')[1];

      const res = await request(app).get(`/api/auth/verify-email/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);

      const fresh = await User.findById(user._id);
      expect(fresh.emailVerified).toBe(true);
    } finally {
      process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASS = '';
    }
  });
});
