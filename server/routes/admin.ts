// Admin panel API: site customization, settings, and management of every record.
import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { destroyAllSessions, getUser, hashPassword, requireAdmin } from '../auth';
import { getDb, newId, nowIso, parseJson } from '../db';
import { badRequest, conflict, notFound, parse, toCents, todayStr, zDate } from '../http';
import { getSecrets, getSettings, saveSecrets, saveSettings } from '../settings';
import { BOOKING_REQUEST_SELECT, BOOTH_BOOKING_SELECT, recomputeArtistRating, recomputeShopRating, toBookingRequest, toBoothBooking } from '../mappers';
import { saveImage, upload } from '../uploads';
import { earningsFor, refund } from '../billing';
import { emailReady, sendEmailNow } from '../email';
import { locationCurrency, paymentsReady } from '../square';
import { notify } from '../notify';
import { createPasswordResetLink } from './auth';
import { emit } from '../events';
import { config } from '../config';

export const adminRouter = Router();

// Every admin route requires an admin session.
adminRouter.use((req, _res, next) => {
  requireAdmin(req);
  next();
});

// ---------- Dashboard ----------

adminRouter.get('/stats', (_req, res) => {
  const db = getDb();
  const one = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as any) ?? {};
  const usersByRole = Object.fromEntries(
    (db.prepare('select role, count(*) c from users group by role').all() as any[]).map(r => [r.role, r.c]),
  );
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const revenue = one("select coalesce(sum(amount_cents),0) gross, coalesce(sum(fee_cents),0) fees from payments where status = 'completed'");
  const revenue30 = one("select coalesce(sum(amount_cents),0) gross, coalesce(sum(fee_cents),0) fees from payments where status = 'completed' and created_at >= ?", since30);
  const owed = one(
    `select coalesce(sum(bal),0) owed from (
       select (select coalesce(sum(payee_amount_cents),0) from payments p where p.payee_id = u.id and p.status = 'completed')
            - (select coalesce(sum(amount_cents),0) from payouts o where o.payee_id = u.id) bal
       from users u) where bal > 0`,
  );
  const monthly = db
    .prepare(
      `select substr(created_at,1,7) month, sum(amount_cents) gross, sum(fee_cents) fees from payments
       where status = 'completed' and created_at >= ? group by month order by month`,
    )
    .all(new Date(Date.now() - 365 * 86_400_000).toISOString());
  res.json({
    usersByRole,
    totalUsers: Object.values(usersByRole).reduce((a: number, b) => a + (b as number), 0),
    newUsers30: one('select count(*) c from users where created_at >= ?', since30).c,
    shops: one('select count(*) c from shops').c,
    bookingRequests: Object.fromEntries((db.prepare('select status, count(*) c from booking_requests group by status').all() as any[]).map(r => [r.status, r.c])),
    upcomingBoothRentals: one("select count(*) c from booth_bookings where status = 'paid' and end_date >= ?", todayStr()).c,
    grossCents: revenue.gross,
    feesCents: revenue.fees,
    gross30Cents: revenue30.gross,
    fees30Cents: revenue30.fees,
    owedCents: owed.owed,
    pendingVerifications: one("select count(*) c from verification_requests where status = 'pending'").c,
    pendingReports: one("select count(*) c from reports where status = 'pending'").c,
    monthly,
    currency: getSettings().currency,
    paymentsReady: paymentsReady(),
    emailReady: emailReady(),
  });
});

// ---------- Settings & customization ----------

function maskedSecrets() {
  const s = getSecrets();
  return {
    squareAccessTokenSet: !!s.squareAccessToken,
    squareAccessTokenFromEnv: !!config.squareAccessToken,
    squareConfigFromEnv: !!(config.squareApplicationId || config.squareLocationId || config.squareEnvironment),
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpSecure: s.smtpSecure,
    smtpUser: s.smtpUser,
    smtpPassSet: !!s.smtpPass,
    smtpFrom: s.smtpFrom,
    smtpFromEnv: !!config.smtpUrl,
  };
}

adminRouter.get('/settings', (_req, res) => {
  res.json({ settings: getSettings(), secrets: maskedSecrets() });
});

const zHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #F04E98');
const settingsSchema = z
  .object({
    siteName: z.string().trim().min(1).max(60),
    tagline: z.string().max(200),
    logoUrl: z.string().max(500),
    faviconUrl: z.string().max(500),
    primaryColor: zHex,
    secondaryColor: zHex,
    defaultTheme: z.enum(['dark', 'light']),
    heroTitle: z.string().max(120),
    heroHighlight: z.string().max(120),
    heroSubtitle: z.string().max(500),
    heroImageUrl: z.string().max(500),
    aboutTitle: z.string().max(120),
    aboutText: z.string().max(5000),
    announcementEnabled: z.boolean(),
    announcementText: z.string().max(300),
    contactEmail: z.string().max(200),
    instagramUrl: z.string().max(300),
    tiktokUrl: z.string().max(300),
    facebookUrl: z.string().max(300),
    footerText: z.string().max(500),
    features: z
      .object({
        clientBooking: z.boolean(),
        guestBooking: z.boolean(),
        boothRental: z.boolean(),
        messaging: z.boolean(),
        proPlan: z.boolean(),
        reviews: z.boolean(),
        unclaimedShops: z.boolean(),
      })
      .partial(),
    depositFeePercent: z.coerce.number().min(0).max(50),
    boothFeePercent: z.coerce.number().min(0).max(50),
    proMonthlyPrice: z.coerce.number().min(0).max(10000),
    defaultDeposit: z.coerce.number().min(0).max(100000),
    currency: z.string().regex(/^[A-Z]{3}$/, 'must be a 3-letter currency code like USD'),
    boothHoldHours: z.coerce.number().int().min(1).max(720),
    bodyPlacements: z.array(z.string().trim().min(1).max(60)).max(60),
    specialties: z.array(z.string().trim().min(1).max(60)).max(100),
    squareApplicationId: z.string().trim().max(200),
    squareLocationId: z.string().trim().max(200),
    squareEnvironment: z.enum(['sandbox', 'production']),
    googleMapsApiKey: z.string().trim().max(200),
  })
  .partial();

const secretsSchema = z
  .object({
    squareAccessToken: z.string().trim().max(500),
    smtpHost: z.string().trim().max(200),
    smtpPort: z.coerce.number().int().min(1).max(65535),
    smtpSecure: z.boolean(),
    smtpUser: z.string().trim().max(200),
    smtpPass: z.string().max(500),
    smtpFrom: z.string().trim().max(200),
  })
  .partial();

adminRouter.put('/settings', (req, res) => {
  const body = parse(z.object({ settings: settingsSchema.optional(), secrets: secretsSchema.optional() }), req.body);
  if (body.settings) saveSettings(body.settings as any);
  if (body.secrets) saveSecrets(body.secrets);
  res.json({ settings: getSettings(), secrets: maskedSecrets() });
});

adminRouter.post('/upload', upload.single('image'), (req, res) => {
  res.json({ url: saveImage(req.file) });
});

adminRouter.post('/test-email', async (req, res) => {
  const { to } = parse(z.object({ to: z.string().trim().email() }), req.body);
  if (!emailReady()) throw badRequest('Email is not configured yet. Fill in the SMTP settings first.');
  try {
    await sendEmailNow({ to, subject: `Test email from ${getSettings().siteName}`, lines: ['Email is working! 🎉'] });
  } catch (err) {
    throw badRequest(`Sending failed: ${(err as Error).message}`);
  }
  res.json({ ok: true });
});

adminRouter.post('/square-check', async (_req, res) => {
  if (!paymentsReady()) throw badRequest('Enter your Square access token, application ID and location ID first.');
  const currency = await locationCurrency();
  if (currency !== getSettings().currency) saveSettings({ currency });
  res.json({ ok: true, currency });
});

// ---------- Pages ----------

const toPage = (p: any) => ({
  id: p.id, slug: p.slug, title: p.title, body: p.body, published: !!p.published,
  showInFooter: !!p.show_in_footer, sortOrder: p.sort_order, updatedAt: p.updated_at,
});

const pageSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'use lowercase letters, numbers and dashes').min(1).max(60),
  title: z.string().trim().min(1).max(120),
  body: z.string().max(50000).default(''),
  published: z.boolean().default(true),
  showInFooter: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

adminRouter.get('/pages', (_req, res) => {
  res.json((getDb().prepare('select * from pages order by sort_order, title').all() as any[]).map(toPage));
});

adminRouter.post('/pages', (req, res) => {
  const b = parse(pageSchema, req.body);
  const id = newId();
  try {
    getDb()
      .prepare('insert into pages (id, slug, title, body, published, show_in_footer, sort_order, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, b.slug, b.title, b.body, b.published ? 1 : 0, b.showInFooter ? 1 : 0, b.sortOrder, nowIso());
  } catch {
    throw conflict('A page with that address already exists.');
  }
  res.status(201).json(toPage(getDb().prepare('select * from pages where id = ?').get(id)));
});

adminRouter.patch('/pages/:id', (req, res) => {
  const b = parse(pageSchema.partial(), req.body);
  const db = getDb();
  const p = db.prepare('select * from pages where id = ?').get(req.params.id) as any;
  if (!p) throw notFound();
  try {
    db.prepare('update pages set slug = ?, title = ?, body = ?, published = ?, show_in_footer = ?, sort_order = ?, updated_at = ? where id = ?').run(
      b.slug ?? p.slug, b.title ?? p.title, b.body ?? p.body,
      b.published === undefined ? p.published : b.published ? 1 : 0,
      b.showInFooter === undefined ? p.show_in_footer : b.showInFooter ? 1 : 0,
      b.sortOrder ?? p.sort_order, nowIso(), p.id,
    );
  } catch {
    throw conflict('A page with that address already exists.');
  }
  res.json(toPage(db.prepare('select * from pages where id = ?').get(p.id)));
});

adminRouter.delete('/pages/:id', (req, res) => {
  getDb().prepare('delete from pages where id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Users ----------

const toAdminUser = (u: any) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  city: u.city,
  status: u.status,
  isVerified: !!u.is_verified,
  subscriptionTier: u.subscription_tier,
  proUntil: u.pro_until,
  proAutoRenew: !!u.pro_auto_renew,
  payoutMethod: parseJson(u.payout_method, {}),
  averageRating: u.average_rating,
  reviewCount: u.review_count,
  createdAt: u.created_at,
});

adminRouter.get('/users', (req, res) => {
  const q = typeof req.query.q === 'string' ? `%${req.query.q.trim()}%` : '%';
  const role = typeof req.query.role === 'string' && req.query.role ? req.query.role : null;
  const rows = getDb()
    .prepare(
      `select * from users where (name like @q or email like @q or city like @q) and (@role is null or role = @role)
       order by created_at desc limit 500`,
    )
    .all({ q, role });
  res.json(rows.map(toAdminUser));
});

adminRouter.patch('/users/:id', async (req, res) => {
  const admin = req.user!;
  const b = parse(
    z.object({
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().toLowerCase().email(),
      role: z.enum(['client', 'artist', 'dual', 'shop-owner', 'admin']),
      status: z.enum(['active', 'suspended']),
      isVerified: z.boolean(),
      subscriptionTier: z.enum(['free', 'pro']),
      proUntil: zDate.nullable(),
      password: z.string().min(8).max(200),
    }).partial(),
    req.body,
  );
  const db = getDb();
  const u = getUser(req.params.id);
  if (!u) throw notFound('User not found.');
  if (u.id === admin.id && (b.role && b.role !== 'admin' || b.status === 'suspended')) {
    throw badRequest("You can't remove your own admin access or suspend yourself.");
  }
  if (b.email && b.email !== u.email && db.prepare('select 1 from users where email = ? and id != ?').get(b.email, u.id)) {
    throw conflict('Another account already uses that email.');
  }
  const columns: Record<string, unknown> = {
    name: b.name,
    email: b.email,
    role: b.role,
    status: b.status,
    is_verified: b.isVerified === undefined ? undefined : b.isVerified ? 1 : 0,
    subscription_tier: b.subscriptionTier,
    // Admin-granted Pro: a date means "until then", null means "no end date".
    pro_until: b.proUntil === undefined ? undefined : b.proUntil ? new Date(`${b.proUntil}T23:59:59`).toISOString() : null,
    password_hash: b.password ? await hashPassword(b.password) : undefined,
  };
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
  if (entries.length) {
    db.prepare(`update users set ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? where id = ?`)
      .run(...entries.map(([, v]) => v), nowIso(), u.id);
  }
  if (b.status === 'suspended' || b.password) destroyAllSessions(u.id);
  if (b.isVerified && !u.is_verified) notify(u.id, 'Your profile is now verified! ✅', { link: '/dashboard' });
  emit(u.id, 'me');
  res.json(toAdminUser(getUser(u.id)));
});

adminRouter.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user!.id) throw badRequest("You can't delete your own account.");
  const u = getUser(req.params.id);
  if (!u) throw notFound('User not found.');
  getDb().prepare('delete from users where id = ?').run(u.id);
  res.json({ ok: true });
});

adminRouter.post('/users/:id/reset-link', (req, res) => {
  const u = getUser(req.params.id);
  if (!u) throw notFound('User not found.');
  res.json({ link: createPasswordResetLink(u.id, 72) });
});

// ---------- Shops ----------

adminRouter.get('/shops', (_req, res) => {
  const rows = getDb()
    .prepare(
      `select s.*, u.name owner_name, u.email owner_email,
        (select count(*) from booths b where b.shop_id = s.id and b.active = 1) booth_count
       from shops s join users u on u.id = s.owner_id order by s.created_at desc`,
    )
    .all() as any[];
  res.json(
    rows.map(s => ({
      id: s.id, name: s.name, city: s.city, address: s.address, isVerified: !!s.is_verified,
      averageRating: s.average_rating, reviewCount: s.review_count, boothCount: s.booth_count,
      ownerId: s.owner_id, ownerName: s.owner_name, ownerEmail: s.owner_email, createdAt: s.created_at,
    })),
  );
});

adminRouter.patch('/shops/:id', (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(1).max(120), isVerified: z.boolean() }).partial(), req.body);
  const db = getDb();
  const s = db.prepare('select * from shops where id = ?').get(req.params.id) as any;
  if (!s) throw notFound('Shop not found.');
  db.prepare('update shops set name = ?, is_verified = ?, updated_at = ? where id = ?').run(
    b.name ?? s.name, b.isVerified === undefined ? s.is_verified : b.isVerified ? 1 : 0, nowIso(), s.id,
  );
  if (b.isVerified && !s.is_verified) notify(s.owner_id, 'Your shop is now verified! ✅', { link: '/shop' });
  res.json({ ok: true });
});

adminRouter.delete('/shops/:id', (req, res) => {
  const paid = getDb().prepare("select 1 from booth_bookings where shop_id = ? and status = 'paid' and end_date >= ?").get(req.params.id, todayStr());
  if (paid) throw conflict('This shop has upcoming paid rentals. Refund or wait for them to finish before deleting.');
  getDb().prepare('delete from shops where id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Bookings ----------

adminRouter.get('/booking-requests', (req, res) => {
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null;
  const rows = getDb()
    .prepare(`${BOOKING_REQUEST_SELECT} where (@status is null or br.status = @status) order by br.created_at desc limit 500`)
    .all({ status }) as any[];
  res.json(rows.map(r => ({ ...toBookingRequest(r, { includeContact: true }), guestEmail: r.guest_email || r.client_email })));
});

adminRouter.post('/booking-requests/:id/status', (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['pending', 'approved', 'declined', 'cancelled', 'completed', 'no-show']) }), req.body);
  const db = getDb();
  const r = db.prepare('select * from booking_requests where id = ?').get(req.params.id) as any;
  if (!r) throw notFound();
  db.prepare('update booking_requests set status = ?, updated_at = ? where id = ?').run(status, nowIso(), r.id);
  emit(r.artist_id, 'bookings');
  emit(r.client_id, 'bookings');
  res.json({ ok: true });
});

adminRouter.get('/booth-bookings', (_req, res) => {
  const rows = getDb().prepare(`${BOOTH_BOOKING_SELECT} order by bb.created_at desc limit 500`).all() as any[];
  res.json(rows.map(toBoothBooking));
});

adminRouter.post('/booth-bookings/:id/cancel', (req, res) => {
  const db = getDb();
  const b = db.prepare('select * from booth_bookings where id = ?').get(req.params.id) as any;
  if (!b) throw notFound();
  if (b.status === 'paid') throw conflict('Refund the payment first (Payments tab) — that also cancels the rental.');
  db.prepare("update booth_bookings set status = 'cancelled' where id = ?").run(b.id);
  emit(b.artist_id, 'bookings');
  res.json({ ok: true });
});

// ---------- Payments, refunds, payouts ----------

adminRouter.get('/payments', (_req, res) => {
  const rows = getDb()
    .prepare(
      `select p.*, u.name payer_name, e.name payee_name from payments p
       left join users u on u.id = p.user_id left join users e on e.id = p.payee_id
       order by p.created_at desc limit 1000`,
    )
    .all() as any[];
  res.json(
    rows.map(p => ({
      id: p.id, kind: p.kind, refId: p.ref_id, description: p.description, payerName: p.payer_name, payerEmail: p.payer_email,
      payeeId: p.payee_id, payeeName: p.payee_name, amountCents: p.amount_cents, feeCents: p.fee_cents,
      payeeAmountCents: p.payee_amount_cents, currency: p.currency, squarePaymentId: p.square_payment_id,
      receiptUrl: p.receipt_url, status: p.status, refundedAt: p.refunded_at, createdAt: p.created_at,
    })),
  );
});

adminRouter.post('/payments/:id/refund', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().max(190).default('') }), req.body ?? {});
  await refund(req.params.id, reason);
  res.json({ ok: true });
});

adminRouter.get('/payouts', (_req, res) => {
  const rows = getDb()
    .prepare(
      `select u.id, u.name, u.email, u.role, u.payout_method,
        (select coalesce(sum(payee_amount_cents),0) from payments p where p.payee_id = u.id and p.status = 'completed') earned,
        (select coalesce(sum(amount_cents),0) from payouts o where o.payee_id = u.id) paid
       from users u
       where exists(select 1 from payments p where p.payee_id = u.id) or exists(select 1 from payouts o where o.payee_id = u.id)
       order by (earned - paid) desc, u.name`,
    )
    .all() as any[];
  res.json(
    rows.map(r => ({
      payee: { id: r.id, name: r.name, email: r.email, role: r.role, payoutMethod: parseJson(r.payout_method, {}) },
      earnedCents: r.earned,
      paidOutCents: r.paid,
      balanceCents: r.earned - r.paid,
    })),
  );
});

adminRouter.get('/payouts/:userId', (req, res) => {
  res.json(earningsFor(req.params.userId));
});

adminRouter.post('/payouts', (req, res) => {
  const b = parse(
    z.object({
      payeeId: z.string().min(1),
      amount: z.coerce.number().positive('Amount must be more than 0').max(1_000_000),
      method: z.string().trim().max(100).default(''),
      note: z.string().trim().max(500).default(''),
    }),
    req.body,
  );
  const payee = getUser(b.payeeId);
  if (!payee) throw notFound('User not found.');
  const amountCents = toCents(b.amount);
  getDb()
    .prepare('insert into payouts (id, payee_id, amount_cents, currency, method, note, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), payee.id, amountCents, getSettings().currency, b.method, b.note, req.user!.id, nowIso());
  notify(payee.id, `A payout of ${(amountCents / 100).toFixed(2)} ${getSettings().currency} has been sent to you${b.method ? ` via ${b.method}` : ''}.`, {
    link: payee.role === 'shop-owner' ? '/shop' : '/dashboard',
  });
  res.status(201).json({ ok: true });
});

adminRouter.delete('/payouts/:id', (req, res) => {
  getDb().prepare('delete from payouts where id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Verifications ----------

adminRouter.get('/verifications', (_req, res) => {
  const rows = getDb()
    .prepare(
      `select v.*, u.name user_name, u.email user_email, s.name shop_name from verification_requests v
       join users u on u.id = v.user_id left join shops s on s.id = v.shop_id
       order by (v.status = 'pending') desc, v.created_at desc limit 500`,
    )
    .all() as any[];
  res.json(
    rows.map(v => ({
      id: v.id, type: v.type, userId: v.user_id, userName: v.user_name, userEmail: v.user_email, shopId: v.shop_id,
      shopName: v.shop_name, status: v.status, note: v.note, createdAt: v.created_at, decidedAt: v.decided_at,
    })),
  );
});

adminRouter.post('/verifications/:id', (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['approved', 'rejected']) }), req.body);
  const db = getDb();
  const v = db.prepare('select * from verification_requests where id = ?').get(req.params.id) as any;
  if (!v) throw notFound();
  db.transaction(() => {
    db.prepare('update verification_requests set status = ?, decided_at = ? where id = ?').run(status, nowIso(), v.id);
    if (status === 'approved') {
      if (v.type === 'artist') db.prepare('update users set is_verified = 1 where id = ?').run(v.user_id);
      else db.prepare('update shops set is_verified = 1 where id = ?').run(v.shop_id);
    }
  })();
  notify(
    v.user_id,
    status === 'approved' ? `Your ${v.type === 'shop' ? 'shop' : 'profile'} is now verified! ✅` : 'Your verification request was not approved. Contact us if you have questions.',
    { link: v.type === 'shop' ? '/shop' : '/dashboard' },
  );
  emit(v.user_id, 'me');
  res.json({ ok: true });
});

// ---------- Reports ----------

adminRouter.get('/reports', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `select r.*, u.name reporter_name, u.email reporter_email from reports r left join users u on u.id = r.reporter_id
       order by (r.status = 'pending') desc, r.created_at desc limit 500`,
    )
    .all() as any[];
  const describe = (type: string, id: string): string => {
    if (type === 'user') return (db.prepare('select name || \' (\' || email || \')\' d from users where id = ?').get(id) as any)?.d || 'Deleted user';
    if (type === 'shop') return (db.prepare('select name d from shops where id = ?').get(id) as any)?.d || 'Deleted shop';
    if (type === 'booking') {
      const b = db.prepare(`${BOOKING_REQUEST_SELECT} where br.id = ?`).get(id) as any;
      return b ? `Booking: ${b.client_name || b.guest_name} with ${b.artist_name} on ${b.date}` : 'Deleted booking';
    }
    return `${type} ${id}`;
  };
  res.json(
    rows.map(r => ({
      id: r.id, reporterName: r.reporter_name || 'Deleted user', reporterEmail: r.reporter_email, targetType: r.target_type,
      targetId: r.target_id, target: describe(r.target_type, r.target_id), reason: r.reason, status: r.status,
      adminNote: r.admin_note, createdAt: r.created_at,
    })),
  );
});

adminRouter.patch('/reports/:id', (req, res) => {
  const b = parse(z.object({ status: z.enum(['pending', 'resolved', 'dismissed']), adminNote: z.string().max(2000).optional() }), req.body);
  getDb().prepare('update reports set status = ?, admin_note = coalesce(?, admin_note) where id = ?').run(b.status, b.adminNote ?? null, req.params.id);
  res.json({ ok: true });
});

// ---------- Reviews ----------

adminRouter.get('/reviews', (_req, res) => {
  const db = getDb();
  const artistReviews = (
    db
      .prepare(
        `select br.id, br.review_rating rating, br.review_text text, br.review_at created_at, br.review_hidden hidden,
           coalesce(c.name, br.guest_name) author, a.name subject
         from booking_requests br join users a on a.id = br.artist_id left join users c on c.id = br.client_id
         where br.review_rating is not null order by br.review_at desc limit 500`,
      )
      .all() as any[]
  ).map(r => ({ ...r, type: 'artist' }));
  const shopReviews = (
    db
      .prepare(
        `select r.id, r.rating, r.text, r.created_at, r.hidden, u.name author, s.name subject
         from shop_reviews r join users u on u.id = r.author_id join shops s on s.id = r.shop_id
         order by r.created_at desc limit 500`,
      )
      .all() as any[]
  ).map(r => ({ ...r, type: 'shop' }));
  res.json(
    [...artistReviews, ...shopReviews]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(r => ({ id: r.id, type: r.type, rating: r.rating, text: r.text, author: r.author, subject: r.subject, hidden: !!r.hidden, createdAt: r.created_at })),
  );
});

adminRouter.patch('/reviews/:type/:id', (req, res) => {
  const { hidden } = parse(z.object({ hidden: z.boolean() }), req.body);
  const db = getDb();
  if (req.params.type === 'artist') {
    const r = db.prepare('select artist_id from booking_requests where id = ?').get(req.params.id) as any;
    if (!r) throw notFound();
    db.prepare('update booking_requests set review_hidden = ? where id = ?').run(hidden ? 1 : 0, req.params.id);
    recomputeArtistRating(r.artist_id);
  } else if (req.params.type === 'shop') {
    const r = db.prepare('select shop_id from shop_reviews where id = ?').get(req.params.id) as any;
    if (!r) throw notFound();
    db.prepare('update shop_reviews set hidden = ? where id = ?').run(hidden ? 1 : 0, req.params.id);
    recomputeShopRating(r.shop_id);
  } else {
    throw badRequest('Unknown review type.');
  }
  res.json({ ok: true });
});

// ---------- Backup ----------

adminRouter.get('/backup', async (_req, res) => {
  const file = path.join(os.tmpdir(), `inkspace-backup-${Date.now()}.db`);
  await getDb().backup(file);
  const stamp = new Date().toISOString().slice(0, 10);
  res.download(file, `${getSettings().siteName.replace(/[^\w-]+/g, '-')}-backup-${stamp}.db`, () => fs.rm(file, { force: true }, () => {}));
});
