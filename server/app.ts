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
import { getDb, parseJson } from './db';
import { publicRouter } from './routes/public';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';
import { bookingsRouter } from './routes/bookings';
import { messagesRouter } from './routes/messages';
import { shopsRouter } from './routes/shops';
import { adminRouter } from './routes/admin';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
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
  // A missing script/style file must be a real 404 (not the page HTML), so an old open tab can recover after a deploy.
  app.use('/assets', (_req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });
  app.use(express.static(config.publicDir, { index: false, maxAge: '1h' }));

  // Every other path renders the single-page app (the client-side router takes over).
  app.get(/.*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(renderIndex(req.path));
  });

  return app;
}

let template: string | null = null;

/** Title, description and preview image for link previews (Instagram, iMessage, Facebook…) and search engines. */
function pageMeta(urlPath: string): { title: string; description: string; image: string } {
  const s = getSettings();
  const base = { title: s.siteName, description: s.tagline, image: s.heroImageUrl || s.logoUrl || '' };
  try {
    const artist = /^\/artists\/([^/]+)$/.exec(urlPath);
    if (artist) {
      const u = getDb()
        .prepare("select name, specialty, city, bio, portfolio, avatar_url from users where id = ? and role in ('artist','dual') and status = 'active'")
        .get(artist[1]) as any;
      if (u) {
        const photo = parseJson<{ url: string }[]>(u.portfolio, [])[0]?.url || u.avatar_url || base.image;
        return {
          title: `${u.name}${u.specialty ? ` — ${u.specialty}` : ''} tattoo artist${u.city ? ` in ${u.city}` : ''} | ${s.siteName}`,
          description: (u.bio || `Book ${u.name} on ${s.siteName}.`).slice(0, 200),
          image: photo,
        };
      }
    }
    const shop = /^\/shops\/([^/]+)$/.exec(urlPath);
    if (shop) {
      const r = getDb().prepare('select name, city, description, image_url from shops where id = ?').get(shop[1]) as any;
      if (r) {
        return {
          title: `${r.name}${r.city ? `, ${r.city}` : ''} — guest spots | ${s.siteName}`,
          description: (r.description || `Rent a booth at ${r.name}.`).slice(0, 200),
          image: r.image_url || base.image,
        };
      }
    }
  } catch {
    /* fall back to site defaults */
  }
  return base;
}

function renderIndex(urlPath = '/'): string {
  if (!template || !config.isProduction) {
    const file = path.join(config.publicDir, 'index.html');
    template = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8')
      : '<!doctype html><html><body><p>The site has not been built yet. Run <code>npm run build</code>.</p></body></html>';
  }
  const s = getSettings();
  const meta = pageMeta(urlPath);
  const image = meta.image ? (meta.image.startsWith('http') ? meta.image : `${config.appUrl}${meta.image}`) : '';
  return template
    .replaceAll('%PAGE_TITLE%', escapeHtml(meta.title))
    .replaceAll('%PAGE_DESCRIPTION%', escapeHtml(meta.description))
    .replaceAll('%OG_IMAGE%', escapeHtml(image))
    .replaceAll('%PAGE_URL%', escapeHtml(`${config.appUrl}${urlPath}`))
    .replaceAll('%SITE_NAME%', escapeHtml(s.siteName))
    .replaceAll('%SITE_DESCRIPTION%', escapeHtml(s.tagline))
    .replaceAll('%THEME%', s.defaultTheme === 'light' ? 'light' : 'dark')
    .replaceAll('%FAVICON%', escapeHtml(s.faviconUrl || '/favicon.svg'));
}
