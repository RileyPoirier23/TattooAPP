// Express app: security headers, API routes, uploads and the single-page site.
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { loadUser, requireCsrfHeader } from './auth';
import { errorHandler, escapeHtml } from './http';
import { getSettings } from './settings';
import { publicRouter } from './routes/public';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';
import { bookingsRouter } from './routes/bookings';
import { messagesRouter } from './routes/messages';
import { shopsRouter } from './routes/shops';
import { adminRouter } from './routes/admin';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The payment form (Square) and maps (Google) load scripts and frames from their own domains,
      // so a strict content-security-policy would break them. React escapes all rendered text.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(compression());

  // --- API ---
  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));
  api.use(loadUser);
  api.use(requireCsrfHeader);
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(publicRouter);
  api.use('/auth', authRouter);
  api.use(meRouter);
  api.use(bookingsRouter);
  api.use(messagesRouter);
  api.use(shopsRouter);
  api.use('/admin', adminRouter);
  api.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  api.use(errorHandler);
  app.use('/api', api);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // --- Uploaded images ---
  app.use(
    '/uploads',
    express.static(config.uploadsDir, {
      maxAge: '30d',
      immutable: true,
      fallthrough: false,
      setHeaders: res => res.set('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // --- Built front-end ---
  app.use('/assets', express.static(path.join(config.publicDir, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(config.publicDir, { index: false, maxAge: '1h' }));

  // Every other path renders the single-page app (the client-side router takes over).
  app.get(/.*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(renderIndex());
  });

  return app;
}

let template: string | null = null;

function renderIndex(): string {
  if (!template || !config.isProduction) {
    const file = path.join(config.publicDir, 'index.html');
    template = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8')
      : '<!doctype html><html><body><p>The site has not been built yet. Run <code>npm run build</code>.</p></body></html>';
  }
  const s = getSettings();
  return template
    .replaceAll('%SITE_NAME%', escapeHtml(s.siteName))
    .replaceAll('%SITE_DESCRIPTION%', escapeHtml(s.tagline))
    .replaceAll('%THEME%', s.defaultTheme === 'light' ? 'light' : 'dark')
    .replaceAll('%FAVICON%', escapeHtml(s.faviconUrl || '/favicon.svg'));
}
