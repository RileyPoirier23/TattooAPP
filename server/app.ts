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
import { contactRouter } from './routes/contact';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false, // set below
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  // The payment form (Square) and maps (Google) load scripts and frames from their own domains, so scripts
  // aren't restricted (React escapes all rendered text). The policy still blocks plugins, <base> tag hijacking,
  // forms posting to other sites and other sites framing this one (clickjacking).
  const csp = ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"];
  if (config.appUrl.startsWith('https://')) csp.push('upgrade-insecure-requests');
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', csp.join('; '));
    // Only "Near me" uses the visitor's location; nothing here needs the camera or microphone.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    next();
  });
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
  api.use(contactRouter);
  api.use('/admin', adminRouter);
  api.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  api.use(errorHandler);
  app.use('/api', api);

  // Used by hosts (Railway, Docker) to decide whether a deploy is working: the database must answer.
  app.get('/health', (_req, res) => {
    try {
      getDb().prepare('select 1').get();
      res.json({ ok: true });
    } catch (err) {
      console.error('[health] database check failed', err);
      res.status(503).json({ ok: false });
    }
  });

  // --- Search engines ---
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(
      ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /booking/', 'Disallow: /api/', 'Disallow: /reset-password', '', `Sitemap: ${config.appUrl}/sitemap.xml`, ''].join('\n'),
    );
  });
  app.get('/sitemap.xml', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(renderSitemap());
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

/** Public pages for search engines: listed artists, shops and published content pages. */
function renderSitemap(): string {
  const db = getDb();
  const s = getSettings();
  const entries: { loc: string; lastmod?: string }[] = [{ loc: '/' }];
  if (s.features.clientBooking) {
    entries.push({ loc: '/artists' });
    const artists = db
      .prepare("select id, updated_at from users where role in ('artist','dual') and status = 'active' and json_array_length(portfolio) > 0")
      .all() as { id: string; updated_at: string }[];
    artists.forEach(a => entries.push({ loc: `/artists/${a.id}`, lastmod: a.updated_at }));
  }
  if (s.features.boothRental) {
    entries.push({ loc: '/shops' });
    (db.prepare('select id, updated_at from shops').all() as { id: string; updated_at: string }[]).forEach(r =>
      entries.push({ loc: `/shops/${r.id}`, lastmod: r.updated_at }),
    );
  }
  (db.prepare('select slug, updated_at from pages where published = 1').all() as { slug: string; updated_at: string }[]).forEach(p =>
    entries.push({ loc: `/p/${p.slug}`, lastmod: p.updated_at }),
  );
  const urls = entries
    .map(e => `  <url><loc>${escapeHtml(`${config.appUrl}${e.loc}`)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
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
  const values: Record<string, string> = {
    PAGE_TITLE: escapeHtml(meta.title),
    PAGE_DESCRIPTION: escapeHtml(meta.description),
    OG_IMAGE: escapeHtml(image),
    PAGE_URL: escapeHtml(`${config.appUrl}${urlPath}`),
    SITE_NAME: escapeHtml(s.siteName),
    SITE_DESCRIPTION: escapeHtml(s.tagline),
    THEME: s.defaultTheme === 'light' ? 'light' : 'dark',
    FAVICON: escapeHtml(s.faviconUrl || '/favicon.svg'),
  };
  // A replacer function inserts values literally (a string replacement would treat "$&", "$`"… specially).
  return template.replace(/%([A-Z_]+)%/g, (match, key: string) => values[key] ?? match);
}
