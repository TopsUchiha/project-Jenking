import 'dotenv/config.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase } from './config/db.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin-suite';

// ── CATCH SILENT CRASHES ────────────────────────────────────────
// Without these, an uncaught error or rejected promise anywhere in the
// app can crash the process with no explanation in the Render logs.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  process.exit(1);
});

// ── Validate required env vars ──────────────────────────────────
// Fails fast with a clear message instead of crashing deep inside
// some unrelated route the first time it's hit.
const requiredEnvVars = ['JWT_SECRET', 'SENDGRID_API_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`[BOOT] Missing required env vars: ${missingVars.join(', ')}`);
  console.error('[BOOT] Set these in your .env file locally, or in your Render');
  console.error('[BOOT] dashboard under Settings → Environment for production.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('[BOOT] JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

// Trust proxy (Vercel, Render, Heroku)
app.set('trust proxy', 1);

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// ── SECURITY: Helmet with strict CSP ──────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Permissions-Policy header
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  next();
});

// ── CORS: same-origin only ────────────────────────────────────
const isLocalhost = (o) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
app.use(cors((req, callback) => {
  const origin = req.headers.origin;
  const ownOrigin = `${req.protocol}://${req.get('host')}`;
  const allowed = !origin || origin === ownOrigin || isLocalhost(origin);
  callback(null, { origin: allowed, credentials: true });
}));

// ── BODY PARSING ──────────────────────────────────────────────
// Admin image upload sends base64 payloads (5MB file -> ~6.7MB base64),
// so it needs a higher limit than the rest of the API.
app.use('/admin/api/upload', express.json({ limit: '8mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── RATE LIMITING ─────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
}));

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please wait before trying again.' }
});

// Login-specific limiter — prevents brute-forcing the admin password.
// Keeps the generous global limiter above for everything else.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

app.use('/api/orders', formLimiter);
app.use('/api/contact', formLimiter);
app.use('/admin/api/login', loginLimiter);

// ── STATIC FILES ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
}));

// ── API ROUTES ────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/admin/api', adminRoutes);

// ── HTML ROUTES ───────────────────────────────────────────────
const pages = ['/', '/products', '/product-detail', '/cart', '/checkout', '/order-confirmation', '/account', '/privacy-policy', '/terms', '/about', '/contact'];

pages.forEach(route => {
  app.get(route, (_req, res) => {
    const file = route === '/' ? 'index.html' : route.substring(1) + '.html';
    res.sendFile(path.join(__dirname, 'public', file), (err) => {
      if (err) res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    });
  });
});

// Admin dashboard
app.get(ADMIN_PATH, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── 404 HANDLER ───────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── ERROR HANDLER (must be last) ──────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.status || 500, err.message);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }

  const status = err.status || 500;
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/')) {
    return res.status(status).json({
      error: process.env.NODE_ENV === 'production'
        ? 'An internal error occurred.'
        : err.message
    });
  }
  res.status(status).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── BOOT ──────────────────────────────────────────────────────
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      // Render sets RENDER_EXTERNAL_URL automatically in production.
      // Falls back to localhost for local development.
      const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
      console.log(`\n════════════════════════════════════════════════════`);
      console.log(`✓ Smokeyz BBQ Server Running`);
      console.log(`✓ URL: ${baseUrl}`);
      console.log(`✓ Admin: ${baseUrl}${ADMIN_PATH}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ Database: ${process.env.DATABASE_URL || '(default path)'}`);
      console.log(`════════════════════════════════════════════════════\n`);
    });
  })
  .catch((err) => {
    console.error('[BOOT] Database init failed:', err);
    process.exit(1);
  });

export default app;