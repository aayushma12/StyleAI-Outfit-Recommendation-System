'use strict';

// ── Express app definition (no listen/DB-connect) ───────────────────────────
// Split out of server.js so tests can `require('./app')` and drive it with
// Supertest against an isolated test database, without booting a real server
// or connecting to the real MONGO_URI. server.js is now the thin runtime
// wrapper: it imports this app, connects to the real database, seeds the
// admin account, and calls app.listen().

require('dotenv').config();
require('express-async-errors');

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const compression   = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit     = require('express-rate-limit');
const cookieParser  = require('cookie-parser');
const { isDev }     = require('./config/env');

const noopMiddleware = (_req, _res, next) => next();

const authLimiter = isDev ? noopMiddleware : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = isDev ? noopMiddleware : rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = isDev ? noopMiddleware : rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { message: 'AI request limit reached. Please wait a moment before sending another message.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

// Compress all API responses (gzip/deflate) — typically 60-80% size reduction
app.use(compression());

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'blob:', 'res.cloudinary.com', '*.unsplash.com', 'images.unsplash.com'],
      connectSrc:  ["'self'", 'api.open-meteo.com'],
      fontSrc:     ["'self'", 'data:'],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
      upgradeInsecureRequests: isDev ? null : [],
    },
  },
}));

app.use(cors({
  origin:      isDev ? 'http://localhost:3000' : process.env.CLIENT_URL,
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(cookieParser());
app.use(mongoSanitize());

app.use('/api/',          apiLimiter);
app.use('/api/auth/',     authLimiter);
app.use('/api/ai/chat',   aiLimiter);

app.use('/api/auth',            require('./routes/auth'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/wardrobe',        require('./routes/wardrobe'));
app.use('/api/calendar',        require('./routes/calendar'));
app.use('/api/app-feedback',    require('./routes/appFeedback'));
app.use('/api/history',         require('./routes/history'));
app.use('/api/ai',              require('./routes/ai'));
app.use('/api/recommendations', aiLimiter, require('./routes/recommendations'));
app.use('/api/evaluation',      require('./routes/evaluation'));
app.use('/api/admin',           require('./routes/admin'));

app.use((err, req, res, _next) => {
  console.error(`[${req.method}] ${req.path} —`, err.message);
  if (isDev) console.error(err.stack);
  const status = err.statusCode || err.status || 500;
  // 4xx messages are already written to be client-facing (validation errors,
  // "not found", etc.) — safe to show as-is. An uncaught 5xx in production is
  // an unexpected internal failure (e.g. a raw Mongoose error) and must not
  // leak internals like field/model names or stack details to the client.
  const message = (!isDev && status >= 500) ? 'Internal server error' : (err.message || 'Internal server error');
  res.status(status).json({ message });
});

module.exports = app;
