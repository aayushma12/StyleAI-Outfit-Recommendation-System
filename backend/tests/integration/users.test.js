'use strict';

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const WardrobeCombo = require('../../models/WardrobeCombo');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'User Test', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user.id };
}

describe('GET /api/users/profile', () => {
  test('returns the authenticated user\'s own profile', async () => {
    const { token } = await registerAndGetToken(`profile-${Date.now()}@example.com`);
    const res = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('User Test');
  });

  test('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/users/profile', () => {
  test('updates allowed fields', async () => {
    const { token } = await registerAndGetToken(`update-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'A short bio', location: 'Kathmandu' });
    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe('A short bio');
    expect(res.body.user.location).toBe('Kathmandu');
  });

  test('silently ignores fields not in the allow-list', async () => {
    const { token, userId } = await registerAndGetToken(`allowlist-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' }); // not in allowedFields
    expect(res.status).toBe(200);
    const fresh = await User.findById(userId);
    expect(fresh.role).toBe('user');
  });

  test('rejects an age outside 13-100', async () => {
    const { token } = await registerAndGetToken(`age-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ age: 5 });
    expect(res.status).toBe(400);
  });

  test('rejects a budgetRange where min exceeds max', async () => {
    const { token } = await registerAndGetToken(`budget-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ budgetRange: { min: 5000, max: 1000 } });
    expect(res.status).toBe(400);
  });

  test('rejects a username already taken by another user', async () => {
    const first = await registerAndGetToken(`user1-${Date.now()}@example.com`);
    await request(app).put('/api/users/profile').set('Authorization', `Bearer ${first.token}`).send({ username: 'stylequeen' });

    const second = await registerAndGetToken(`user2-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/profile')
      .set('Authorization', `Bearer ${second.token}`).send({ username: 'StyleQueen' }); // case-insensitive collision
    expect(res.status).toBe(409);
  });
});

describe('POST /api/users/onboarding', () => {
  // Regression: the style quiz (Onboarding.jsx) never asks for bodyType, it only
  // passes through whatever the account already has — an account that reaches
  // this endpoint without one yet must still be able to complete onboarding.
  test('succeeds without bodyType (style quiz never collects it)', async () => {
    const { token } = await registerAndGetToken(`onboard-missing-${Date.now()}@example.com`);
    const res = await request(app).post('/api/users/onboarding').set('Authorization', `Bearer ${token}`)
      .send({ stylePreferences: ['minimalist'] });
    expect(res.status).toBe(200);
    expect(res.body.user.onboardingCompleted).toBe(true);
    expect(res.body.user.bodyType).toBeFalsy();
  });

  test('completes onboarding and sets onboardingCompleted true', async () => {
    const { token } = await registerAndGetToken(`onboard-ok-${Date.now()}@example.com`);
    const res = await request(app).post('/api/users/onboarding').set('Authorization', `Bearer ${token}`)
      .send({ bodyType: 'hourglass', stylePreferences: ['minimalist'] });
    expect(res.status).toBe(200);
    expect(res.body.user.onboardingCompleted).toBe(true);
    expect(res.body.user.bodyType).toBe('hourglass');
  });
});

describe('GET /api/users/profile/completion', () => {
  test('reports a higher completion score after filling in more fields', async () => {
    const { token } = await registerAndGetToken(`completion-${Date.now()}@example.com`);
    const before = await request(app).get('/api/users/profile/completion').set('Authorization', `Bearer ${token}`);
    await request(app).put('/api/users/profile').set('Authorization', `Bearer ${token}`)
      .send({ bio: 'bio', location: 'Kathmandu', occupation: 'student' });
    const after = await request(app).get('/api/users/profile/completion').set('Authorization', `Bearer ${token}`);
    expect(after.body.score).toBeGreaterThan(before.body.score);
  });
});

describe('PUT /api/users/password', () => {
  test('changes the password when the current password is correct', async () => {
    const email = `pw-${Date.now()}@example.com`;
    const { token } = await registerAndGetToken(email);
    const res = await request(app).put('/api/users/password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'StrongP@ss123', newPassword: 'NewStrongP@ss456' });
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'NewStrongP@ss456' });
    expect(login.status).toBe(200);
  });

  test('rejects an incorrect current password', async () => {
    const { token } = await registerAndGetToken(`pw-wrong-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'NewStrongP@ss456' });
    expect(res.status).toBe(400);
  });

  test('rejects a weak new password', async () => {
    const { token } = await registerAndGetToken(`pw-weak-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'StrongP@ss123', newPassword: 'weak' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/users/theme', () => {
  test('accepts "dark" and rejects an invalid value', async () => {
    const { token } = await registerAndGetToken(`theme-${Date.now()}@example.com`);
    const ok = await request(app).patch('/api/users/theme').set('Authorization', `Bearer ${token}`).send({ theme: 'dark' });
    expect(ok.status).toBe(200);
    expect(ok.body.themePreference).toBe('dark');

    const bad = await request(app).patch('/api/users/theme').set('Authorization', `Bearer ${token}`).send({ theme: 'rainbow' });
    expect(bad.status).toBe(400);
  });
});

describe('PUT /api/users/consent', () => {
  test('updates consentGiven and sets consentDate', async () => {
    const { token } = await registerAndGetToken(`consent-${Date.now()}@example.com`);
    const res = await request(app).put('/api/users/consent').set('Authorization', `Bearer ${token}`).send({ consentGiven: true });
    expect(res.status).toBe(200);
    expect(res.body.user.consentGiven).toBe(true);
    expect(res.body.user.consentDate).toBeTruthy();
  });
});

describe('GET /api/users/stats', () => {
  test('returns wardrobe and saved-outfit counts', async () => {
    const { token } = await registerAndGetToken(`stats-${Date.now()}@example.com`);
    const res = await request(app).get('/api/users/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ wardrobeCount: 0, savedOutfitCount: 0 });
  });
});

describe('POST /api/users/saved/:outfitId — toggleSaved', () => {
  test('toggles an owned combo in and out of savedOutfits', async () => {
    const { token, userId } = await registerAndGetToken(`toggle-${Date.now()}@example.com`);
    const combo = await WardrobeCombo.create({ user: userId, name: 'Test Combo' });

    const on = await request(app).post(`/api/users/saved/${combo._id}`).set('Authorization', `Bearer ${token}`);
    expect(on.status).toBe(200);
    expect(on.body.saved).toBe(true);

    const off = await request(app).post(`/api/users/saved/${combo._id}`).set('Authorization', `Bearer ${token}`);
    expect(off.status).toBe(200);
    expect(off.body.saved).toBe(false);
  });

  test('404s for a combo owned by another user', async () => {
    const owner = await registerAndGetToken(`owner-${Date.now()}@example.com`);
    const combo = await WardrobeCombo.create({ user: owner.userId, name: 'Owners Combo' });
    const other = await registerAndGetToken(`other-${Date.now()}@example.com`);

    const res = await request(app).post(`/api/users/saved/${combo._id}`).set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/users/account', () => {
  test('deletes the account so a subsequent login fails', async () => {
    const email = `delete-${Date.now()}@example.com`;
    const { token } = await registerAndGetToken(email);
    const res = await request(app).delete('/api/users/account').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'StrongP@ss123' });
    expect(login.status).toBe(401); // no matching user
  });
});
