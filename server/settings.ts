// Site settings (editable in the admin panel) and secrets (never sent to browsers).
import { getDb, newId, nowIso, parseJson } from './db';
import { config } from './config';
import { invalidate } from './cache';
import type { SecretSettings, SiteSettings } from '../shared/types';
import { DEFAULT_PAGES, OLD_PLACEHOLDERS } from './defaultPages';

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'InkSpace',
  tagline: 'Tattoo, barber, nail, lash and beauty pros, booked online',
  logoUrl: '',
  faviconUrl: '',
  // A bright blue for actions and a deep teal for badges.
  primaryColor: '#0066F5',
  secondaryColor: '#0F766E',
  defaultTheme: 'light',
  heroTitle: 'Book your next appointment in minutes.',
  heroHighlight: '',
  heroSubtitle:
    'Tattoo artists, barbers, nail techs, lash artists and more. Look through their work, pick a day and hold it with a deposit.',
  heroImageUrl: '',
  aboutTitle: 'Welcome to InkSpace',
  aboutText:
    'InkSpace connects beauty and tattoo professionals, shops and clients. Clients find pros in their city and request appointments, with deposits handled securely online. Pros who travel can rent a chair at a shop in their next city.',
  announcementEnabled: false,
  announcementText: '',
  contactEmail: '',
  instagramUrl: '',
  tiktokUrl: '',
  facebookUrl: '',
  footerText: '',
  features: {
    clientBooking: true,
    guestBooking: true,
    boothRental: true,
    messaging: true,
    proPlan: false, // switched on later from Admin → Settings
    reviews: true,
    unclaimedShops: true,
  },
  depositFeePercent: 2.9,
  boothFeePercent: 10,
  proMonthlyPrice: 19,
  defaultDeposit: 50,
  currency: 'USD',
  boothHoldHours: 48,
  bodyPlacements: [
    'Upper arm', 'Forearm', 'Hand', 'Shoulder', 'Chest', 'Stomach', 'Ribs', 'Upper back', 'Lower back',
    'Neck', 'Head', 'Thigh', 'Calf', 'Foot', 'Other',
  ],
  categories: ['Tattoo', 'Piercing', 'Barber', 'Hair', 'Nails', 'Lashes & Brows', 'Makeup', 'Skin & Spa'],
  specialties: [
    // Tattoo
    'Traditional', 'Neo-Traditional', 'Realism', 'Black & Grey', 'Fine Line', 'Japanese', 'Blackwork',
    'Geometric', 'Watercolor', 'Script / Lettering', 'Illustrative', 'Cover-ups',
    // Barber and hair
    'Fades', 'Beard trims', 'Classic cuts', 'Colour', 'Balayage', 'Braids', 'Extensions',
    // Nails, lashes, brows, makeup, skin
    'Gel nails', 'Acrylics', 'Nail art', 'Lash extensions', 'Lash lift', 'Brow lamination', 'Microblading',
    'Bridal makeup', 'Facials',
  ],
  squareApplicationId: '',
  squareLocationId: '',
  squareEnvironment: 'sandbox',
  googleMapsApiKey: '',
};

export const DEFAULT_SECRETS: SecretSettings = {
  squareAccessToken: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  resendApiKey: '',
  googleClientId: '',
  googleClientSecret: '',
};

// Defaults from earlier versions. A site still using them (never customized) moves to the current defaults;
// anything an owner chose stays as it is.
const OLD_DEFAULTS: Partial<SiteSettings>[] = [
  { primaryColor: '#F04E98', secondaryColor: '#8A4EFC', defaultTheme: 'dark' },
  { primaryColor: '#F04E98', secondaryColor: '#8A4EFC' },
  { primaryColor: '#B7352B', secondaryColor: '#2F5D50' }, // the 1.2 studio look
  { heroTitle: 'Find Your Space.', heroHighlight: 'Make Your Mark.' },
  { heroSubtitle: 'Book talented tattoo artists near you, or find a guest spot at a shop in your next city — all in one place.' },
  // 1.2: tattoo-only wording, before the site opened to barbers, nails, lashes and other pros
  { tagline: 'Tattoo artists, guest spots & bookings' },
  {
    heroTitle: 'Book tattoo artists near you.',
    heroSubtitle: 'Browse portfolios, send your idea with reference photos and hold your date with a deposit. Travelling artists can rent a chair at a shop in their next city.',
  },
  {
    aboutText:
      'InkSpace connects tattoo artists, shops and clients. Artists find and book guest spots at shops around the world. Clients discover artists in their city and request appointments, with deposits handled securely online.',
  },
  {
    specialties: [
      'Traditional', 'Neo-Traditional', 'Realism', 'Black & Grey', 'Fine Line', 'Japanese', 'Blackwork',
      'Geometric', 'Watercolor', 'Script / Lettering', 'Illustrative', 'Cover-ups',
    ],
  },
];

function upgradeOldDefaults(s: SiteSettings): SiteSettings {
  for (const old of OLD_DEFAULTS) {
    const keys = Object.keys(old) as (keyof SiteSettings)[];
    // Compared by value, so lists (like the specialties) match too.
    if (keys.every(k => JSON.stringify(s[k]) === JSON.stringify(old[k]))) for (const k of keys) (s as any)[k] = DEFAULT_SETTINGS[k];
  }
  return s;
}

// Settings are read on almost every request; a one-second cache keeps that off the database, and a save
// clears it straight away (another process, if one ever runs, sees the change within the second).
const readCache = new Map<string, { value: object; expires: number }>();

function readKey<T extends object>(key: string, defaults: T): T {
  const hit = readCache.get(key);
  if (hit && hit.expires > Date.now()) return structuredClone(hit.value) as T;
  const row = getDb().prepare('select value from settings where key = ?').get(key) as { value: string } | undefined;
  const stored = parseJson<Partial<T>>(row?.value, {});
  const merged = { ...defaults, ...stored } as T;
  // Merge nested feature flags so new flags get their defaults.
  if ('features' in defaults) {
    (merged as any).features = { ...(defaults as any).features, ...((stored as any).features || {}) };
  }
  readCache.set(key, { value: structuredClone(merged), expires: Date.now() + 1000 });
  return merged;
}

function writeKey(key: string, value: object) {
  readCache.delete(key);
  invalidate();
  getDb()
    .prepare('insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value')
    .run(key, JSON.stringify(value));
}

export function getSettings(): SiteSettings {
  const s = upgradeOldDefaults(readKey('site', DEFAULT_SETTINGS));
  // Environment variables win over values saved in the admin panel.
  if (config.squareApplicationId) s.squareApplicationId = config.squareApplicationId;
  if (config.squareLocationId) s.squareLocationId = config.squareLocationId;
  if (config.squareEnvironment) s.squareEnvironment = config.squareEnvironment;
  return s;
}

export function saveSettings(patch: Partial<SiteSettings>): SiteSettings {
  const current = upgradeOldDefaults(readKey('site', DEFAULT_SETTINGS));
  const next = { ...current, ...patch, features: { ...current.features, ...(patch.features || {}) } };
  writeKey('site', next);
  return getSettings();
}

export function getSecrets(): SecretSettings {
  const s = readKey('secrets', DEFAULT_SECRETS);
  if (config.squareAccessToken) s.squareAccessToken = config.squareAccessToken;
  return s;
}

export function saveSecrets(patch: Partial<SecretSettings>) {
  const current = readKey('secrets', DEFAULT_SECRETS);
  writeKey('secrets', { ...current, ...patch });
}

export function seedDefaults() {
  const db = getDb();
  const count = (db.prepare('select count(*) c from pages').get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare(
      'insert into pages (id, slug, title, body, published, show_in_footer, sort_order, updated_at) values (?, ?, ?, ?, 1, 1, ?, ?)',
    );
    DEFAULT_PAGES.forEach((p, i) => insert.run(newId(), p.slug, p.title, p.body, i, nowIso()));
  }
  // Pages never edited since an older version still hold one-line placeholders: give them the full templates.
  for (const p of DEFAULT_PAGES) {
    for (const old of OLD_PLACEHOLDERS[p.slug] ?? []) {
      db.prepare('update pages set body = ?, updated_at = ? where slug = ? and body = ?').run(p.body, nowIso(), p.slug, old);
    }
  }
}
