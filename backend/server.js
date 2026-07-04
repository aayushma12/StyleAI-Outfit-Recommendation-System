'use strict';

const app         = require('./app');
const connectDB   = require('./config/db');
const validateEnv = require('./config/validateEnv');

const seedAdminIfNeeded = async () => {
  const User = require('./models/User');
  const exists = await User.findOne({ role: 'admin' });
  if (!exists) {
    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      console.warn('[StyleAI] No admin account found and ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping seed.');
      return;
    }
    await User.create({
      name:                'StyleAI Administrator',
      email:               adminEmail,
      password:            adminPassword,
      role:                'admin',
      consentGiven:        true,
      consentDate:         new Date(),
      onboardingCompleted: true,
    });
    console.log(`[StyleAI] Admin account created: ${adminEmail}`);
  }
};

validateEnv();

const PORT = process.env.PORT || 5000;

const boot = async () => {
  try {
    const host = await connectDB();
    console.log(`[StyleAI] MongoDB connected: ${host}`);
    await seedAdminIfNeeded();
    app.listen(PORT, () => {
      console.log(`[StyleAI] Server ready on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[StyleAI] Startup failed:', err.message);
    process.exit(1);
  }
};

boot();
