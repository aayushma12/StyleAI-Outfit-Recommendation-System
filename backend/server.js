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

const LISTEN_MAX_ATTEMPTS = 10;
const LISTEN_RETRY_MS     = 400;

// Retries the bind instead of crashing on EADDRINUSE. This matters most on
// Windows: nodemon's restart signal (SIGUSR2) is not a real, catchable POSIX
// signal there, so the previous instance's graceful-shutdown handler often
// never runs before the OS force-terminates it — the new process can start
// before the old one's socket is actually released. Retrying for a couple of
// seconds rides out that race instead of crash-looping on every restart.
function listenWithRetry(port, attempt = 1) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`[StyleAI] Server ready on http://localhost:${port}`);
      resolve(server);
    });
    server.once('error', err => {
      if (err.code === 'EADDRINUSE' && attempt < LISTEN_MAX_ATTEMPTS) {
        console.warn(`[StyleAI] Port ${port} still in use (previous instance likely still shutting down) — retrying in ${LISTEN_RETRY_MS}ms (attempt ${attempt}/${LISTEN_MAX_ATTEMPTS})...`);
        setTimeout(() => listenWithRetry(port, attempt + 1).then(resolve, reject), LISTEN_RETRY_MS);
      } else {
        reject(err);
      }
    });
  });
}

const boot = async () => {
  try {
    const host = await connectDB();
    console.log(`[StyleAI] MongoDB connected: ${host}`);
    await seedAdminIfNeeded();
    const server = await listenWithRetry(PORT);

    // Close the socket deterministically on every shutdown path we CAN catch
    // (Ctrl+C, container stop) — belt-and-suspenders alongside the retry
    // above, which is what actually protects against nodemon restarts.
    const shutdown = signal => {
      console.log(`[StyleAI] ${signal} received, closing server...`);
      server.close(() => process.exit(0));
    };
    process.once('SIGINT',  () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGUSR2', () => shutdown('SIGUSR2')); // caught when the platform actually delivers it
  } catch (err) {
    console.error('[StyleAI] Startup failed:', err.message);
    process.exit(1);
  }
};

boot();
