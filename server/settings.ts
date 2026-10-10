// Site settings (editable in the admin panel) and secrets (never sent to browsers).
import { getDb, newId, nowIso, parseJson } from './db';
import { config } from './config';
import type { SecretSettings, SiteSettings } from '../shared/types';

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'InkSpace',
  tagline: 'Tattoo artists, guest spots & bookings',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#F04E98',
  secondaryColor: '#8A4EFC',
  defaultTheme: 'dark',
  heroTitle: 'Find Your Space.',
  heroHighlight: 'Make Your Mark.',
  heroSubtitle:
    'Book talented tattoo artists near you, or find a guest spot at a shop in your next city — all in one place.',
  heroImageUrl: '',
  aboutTitle: 'Welcome to InkSpace',
  aboutText:
    'InkSpace connects tattoo artists, shops and clients. Artists find and book guest spots at shops around the world. Clients discover artists in their city and request appointments, with deposits handled securely online.',
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
    proPlan: true,
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
  specialties: [
    'Traditional', 'Neo-Traditional', 'Realism', 'Black & Grey', 'Fine Line', 'Japanese', 'Blackwork',
    'Geometric', 'Watercolor', 'Script / Lettering', 'Illustrative', 'Cover-ups',
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
};

const DEFAULT_PAGES = [
  {
    slug: 'faq',
    title: 'FAQ',
    body: `## How do deposits work?
When an artist approves your request you'll be asked to pay a deposit to lock in your date. The deposit is put towards the price of your tattoo.

## Do I need an account to book?
No. You can request a booking as a guest — you'll get a private link to check your request and pay your deposit.

## How do guest spots work?
Artists can rent a booth at a participating shop for one or more days. Pay for the booth to confirm it.`,
  },
  {
    slug: 'booking-policy',
    title: 'Booking & Cancellation Policy',
    body: `## Deposits
Deposits secure your appointment and are generally non-refundable. They are applied to the final price of your tattoo.

## Rescheduling
Contact your artist as early as possible if you need to change your appointment.

## No-shows
Missing an appointment without notice may forfeit your deposit.`,
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    body: `Edit this page from the admin panel (Admin → Pages) to add your terms of service.`,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    body: `Edit this page from the admin panel (Admin → Pages) to add your privacy policy.`,
  },
];

function readKey<T extends object>(key: string, defaults: T): T {
  const row = getDb().prepare('select value from settings where key = ?').get(key) as { value: string } | undefined;
  const stored = parseJson<Partial<T>>(row?.value, {});
  const merged = { ...defaults, ...stored } as T;
  // Merge nested feature flags so new flags get their defaults.
  if ('features' in defaults) {
    (merged as any).features = { ...(defaults as any).features, ...((stored as any).features || {}) };
  }
  return merged;
}

function writeKey(key: string, value: object) {
  getDb()
    .prepare('insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value')
    .run(key, JSON.stringify(value));
}

export function getSettings(): SiteSettings {
  const s = readKey('site', DEFAULT_SETTINGS);
  // Environment variables win over values saved in the admin panel.
  if (config.squareApplicationId) s.squareApplicationId = config.squareApplicationId;
  if (config.squareLocationId) s.squareLocationId = config.squareLocationId;
  if (config.squareEnvironment) s.squareEnvironment = config.squareEnvironment;
  return s;
}

export function saveSettings(patch: Partial<SiteSettings>): SiteSettings {
  const current = readKey('site', DEFAULT_SETTINGS);
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
}
