// The logged-in user's own profile, portfolio, availability, plan, earnings and notifications.
import { Router } from 'express';
import { z } from 'zod';
import { destroySession, isArtistRole, requireArtist, requireUser, getUser, verifyPassword } from '../auth';
import { getDb, newId, nowIso, parseJson } from '../db';
import { badRequest, conflict, forbidden, parse, todayStr, zDate } from '../http';
import { BOOKING_REQUEST_SELECT, BOOTH_BOOKING_SELECT, toBookingRequest, toBoothBooking, toMe } from '../mappers';
import { getSettings } from '../settings';
import { deleteUpload, saveImage, upload, uploadLimiter } from '../uploads';
import { subscribe } from '../events';
import { deletionBlockers, earningsFor, subscribePro, updateCard } from '../billing';
import { disableCard } from '../square';
import { notifyAdmins } from '../notify';
import { deleteAccount } from '../accounts';
import type { PortfolioImage } from '../../shared/types';

export const meRouter = Router();

const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time like 09:00');
// Links typed without "https://" (e.g. instagram.com/me) get it added.
const zUrl = z
  .string()
  .trim()
  .max(300)
  .transform(v => (v && !/^https?:\/\//i.test(v) ? `https://${v.replace(/^\/+/, '')}` : v))
  .refine(v => v === '' || /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v), 'must be a web address like https://instagram.com/yourname');

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().max(100).optional(),
  specialty: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(2000).optional(),
  socials: z
    .object({ instagram: zUrl.optional(), tiktok: zUrl.optional(), facebook: zUrl.optional(), website: zUrl.optional() })
    .optional(),
  services: z
    .array(
      z.object({
        id: z.string().max(60).optional(),
        name: z.string().trim().min(1, 'Service name is required').max(100),
        description: z.string().trim().max(500).optional(),
        duration: z.coerce.number().min(0.25).max(24),
        price: z.coerce.number().min(0).max(100000),
        deposit: z.coerce.number().min(0).max(100000),
        minSize: z.coerce.number().min(0).max(10000).optional().nullable(),
        maxSize: z.coerce.number().min(0).max(10000).optional().nullable(),
      }),
    )
    .max(30)
    .optional(),
  hours: z
    .record(z.string().regex(/^[0-6]$/, 'must be a day number 0-6'), z.array(z.object({ start: zTime, end: zTime })).max(4))
    .optional(),
  intakeSettings: z
    .object({
      requireSize: z.boolean(),
      requirePlacement: z.boolean(),
      requireDescription: z.boolean(),
      requireBudget: z.boolean(),
      requireReferenceImages: z.boolean(),
    })
    .optional(),
  aftercareMessage: z.string().trim().max(4000).optional(),
  payoutMethod: z
    .object({ type: z.enum(['etransfer', 'paypal', 'bank', 'other']).optional(), details: z.string().trim().max(500).optional() })
    .optional(),
});

meRouter.patch('/me', (req, res) => {
  const user = requireUser(req);
  const body = parse(profileSchema, req.body);
  const artistOnly = ['specialty', 'bio', 'socials', 'services', 'hours', 'intakeSettings', 'aftercareMessage'] as const;
  if (!isArtistRole(user.role) && artistOnly.some(k => body[k] !== undefined)) throw forbidden('Only artists can edit those fields.');
  if (body.payoutMethod && !(isArtistRole(user.role) || user.role === 'shop-owner')) throw forbidden();

  if (body.hours) {
    for (const slots of Object.values(body.hours)) {
      if (slots.some(s => s.start >= s.end)) throw badRequest('Each time slot must end after it starts.');
    }
  }
  const services = body.services?.map(s => {
    if (s.minSize != null && s.maxSize != null && s.minSize > s.maxSize) throw badRequest(`"${s.name}": minimum size is larger than maximum size.`);
    return { ...s, id: s.id || newId(), minSize: s.minSize ?? undefined, maxSize: s.maxSize ?? undefined };
  });

  const columns: Record<string, unknown> = {
    name: body.name,
    city: body.city,
    specialty: body.specialty,
    bio: body.bio,
    socials: body.socials && JSON.stringify(body.socials),
    services: services && JSON.stringify(services),
    hours: body.hours && JSON.stringify(body.hours),
    intake_settings: body.intakeSettings && JSON.stringify(body.intakeSettings),
    aftercare_message: body.aftercareMessage,
    payout_method: body.payoutMethod && JSON.stringify(body.payoutMethod),
  };
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
  if (entries.length) {
    const db = getDb();
    db.prepare(`update users set ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? where id = ?`)
      .run(...entries.map(([, v]) => v), nowIso(), user.id);
  }
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.post('/me/avatar', uploadLimiter, upload.single('image'), (req, res) => {
  const user = requireUser(req);
  const url = saveImage(req.file);
  getDb().prepare('update users set avatar_url = ?, updated_at = ? where id = ?').run(url, nowIso(), user.id);
  deleteUpload(user.avatar_url);
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.post('/me/portfolio', uploadLimiter, upload.array('images', 6), (req, res) => {
  const user = requireArtist(req);
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) throw badRequest('Choose at least one image.');
  // Re-read now: the portfolio may have changed (e.g. a photo deleted) while this upload was in progress.
  const current = parseJson<PortfolioImage[]>(getUser(user.id)!.portfolio, []);
  if (current.length + files.length > 60) throw badRequest('Your portfolio can hold up to 60 images.');
  const caption = typeof req.body.caption === 'string' ? req.body.caption.slice(0, 200) : undefined;
  const added = files.map(f => ({ url: saveImage(f), ...(caption ? { caption } : {}) }));
  getDb().prepare('update users set portfolio = ?, updated_at = ? where id = ?').run(JSON.stringify([...added, ...current]), nowIso(), user.id);
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.put('/me/portfolio', (req, res) => {
  // Reorder / caption / remove: the client sends the full list of images it wants to keep.
  const user = requireArtist(req);
  const { portfolio } = parse(
    z.object({ portfolio: z.array(z.object({ url: z.string().max(500), caption: z.string().max(200).optional() })).max(60) }),
    req.body,
  );
  const current = parseJson<PortfolioImage[]>(user.portfolio, []);
  const known = new Set(current.map(p => p.url));
  if (portfolio.some(p => !known.has(p.url))) throw badRequest('Unknown image in portfolio.');
  const keep = new Set(portfolio.map(p => p.url));
  current.filter(p => !keep.has(p.url)).forEach(p => deleteUpload(p.url));
  getDb().prepare('update users set portfolio = ?, updated_at = ? where id = ?').run(JSON.stringify(portfolio), nowIso(), user.id);
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.put('/me/days-off/:date', (req, res) => {
  const user = requireArtist(req);
  const date = parse(zDate, req.params.date);
  if (date < todayStr(-1)) throw badRequest('That date is in the past.');
  getDb().prepare('insert or ignore into days_off (artist_id, date) values (?, ?)').run(user.id, date);
  res.json({ user: toMe(user) });
});

meRouter.delete('/me/days-off/:date', (req, res) => {
  const user = requireArtist(req);
  getDb().prepare('delete from days_off where artist_id = ? and date = ?').run(user.id, req.params.date);
  res.json({ user: toMe(user) });
});

meRouter.post('/me/verification', (req, res) => {
  const user = requireUser(req);
  const { note } = parse(z.object({ note: z.string().trim().max(1000).optional() }), req.body ?? {});
  const db = getDb();
  let type: 'artist' | 'shop';
  let shopId: string | null = null;
  if (isArtistRole(user.role)) {
    if (user.is_verified) throw conflict('Your profile is already verified.');
    type = 'artist';
  } else if (user.role === 'shop-owner') {
    const shop = db.prepare('select id, is_verified from shops where owner_id = ?').get(user.id) as any;
    if (!shop) throw badRequest('Create your shop first.');
    if (shop.is_verified) throw conflict('Your shop is already verified.');
    type = 'shop';
    shopId = shop.id;
  } else {
    throw forbidden('Only artists and shops can be verified.');
  }
  const pending = db.prepare("select 1 from verification_requests where user_id = ? and status = 'pending'").get(user.id);
  if (pending) throw conflict('You already have a verification request waiting for review.');
  db.prepare('insert into verification_requests (id, type, user_id, shop_id, note, created_at) values (?, ?, ?, ?, ?, ?)')
    .run(newId(), type, user.id, shopId, note || '', nowIso());
  notifyAdmins(`New ${type} verification request from ${user.name}.`, '/admin/verifications');
  res.json({ user: toMe(user) });
});

meRouter.get('/me/earnings', (req, res) => {
  const user = requireUser(req);
  if (!(isArtistRole(user.role) || user.role === 'shop-owner')) throw forbidden();
  res.json(earningsFor(user.id));
});

// --- Pro plan ---

const zCard = z.object({ sourceId: z.string().min(1).max(500), idempotencyKey: z.string().min(8).max(100) });

meRouter.post('/me/subscription', async (req, res) => {
  const user = requireArtist(req);
  const body = parse(zCard, req.body);
  const result = await subscribePro(user, body.sourceId, body.idempotencyKey);
  res.json({ ...result, user: toMe(getUser(user.id)!) });
});

meRouter.post('/me/subscription/cancel', (req, res) => {
  const user = requireArtist(req);
  getDb().prepare('update users set pro_auto_renew = 0, updated_at = ? where id = ?').run(nowIso(), user.id);
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.post('/me/subscription/resume', (req, res) => {
  const user = requireArtist(req);
  if (!user.square_card_id) throw badRequest('Add a card to resume your plan.');
  getDb().prepare('update users set pro_auto_renew = 1, updated_at = ? where id = ?').run(nowIso(), user.id);
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.post('/me/card', async (req, res) => {
  const user = requireArtist(req);
  const body = parse(zCard, req.body);
  await updateCard(user, body.sourceId, body.idempotencyKey);
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.delete('/me/card', async (req, res) => {
  const user = requireUser(req);
  if (user.square_card_id) await disableCard(user.square_card_id);
  getDb()
    .prepare('update users set square_card_id = null, card_label = null, pro_auto_renew = 0, updated_at = ? where id = ?')
    .run(nowIso(), user.id);
  res.json({ user: toMe(getUser(user.id)!) });
});

// --- Clients who are also artists ---

/** A client turns on artist features (their account becomes "Artist & Client"; their bookings stay). */
meRouter.post('/me/become-artist', (req, res) => {
  const user = requireUser(req);
  if (user.role !== 'client') throw conflict(isArtistRole(user.role) ? 'Your account already has artist features.' : 'Only client accounts can switch on artist features.');
  const { city } = parse(z.object({ city: z.string().trim().max(100).optional() }), req.body ?? {});
  const newCity = city || user.city;
  if (!newCity) throw badRequest('Please enter the city you work in.');
  getDb().prepare("update users set role = 'dual', city = ?, updated_at = ? where id = ?").run(newCity, nowIso(), user.id);
  notifyAdmins(`${user.name} switched on artist features.`, '/admin/users');
  res.json({ user: toMe(getUser(user.id)!) });
});

// --- Download my data ---

meRouter.get('/me/export', (req, res) => {
  const user = requireUser(req);
  const db = getDb();
  const all = (sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as any[];
  const shop = db.prepare('select * from shops where owner_id = ?').get(user.id) as any;
  const conversations = all(
    `select c.id, u.name other_name from conversations c
     join users u on u.id = case when c.user_a = @me then c.user_b else c.user_a end
     where c.user_a = @me or c.user_b = @me`,
    { me: user.id },
  );
  const data = {
    exportedAt: nowIso(),
    site: getSettings().siteName,
    account: {
      ...toMe(user),
      status: user.status,
      termsAcceptedAt: user.terms_accepted_at,
      createdAt: user.created_at,
    },
    bookingsYouMade: all(`${BOOKING_REQUEST_SELECT} where br.client_id = ? order by br.created_at`, user.id).map(r => toBookingRequest(r)),
    bookingsFromYourClients: isArtistRole(user.role)
      ? all(`${BOOKING_REQUEST_SELECT} where br.artist_id = ? order by br.created_at`, user.id).map(r => toBookingRequest(r, { includeContact: true }))
      : [],
    boothRentals: all(`${BOOTH_BOOKING_SELECT} where bb.artist_id = ? order by bb.created_at`, user.id).map(toBoothBooking),
    shop: shop
      ? {
          name: shop.name, city: shop.city, address: shop.address, description: shop.description,
          amenities: parseJson(shop.amenities, []), imageUrl: shop.image_url, createdAt: shop.created_at,
          booths: all('select name, daily_rate dailyRate, description, active from booths where shop_id = ?', shop.id),
          rentals: all(`${BOOTH_BOOKING_SELECT} where bb.shop_id = ? order by bb.created_at`, shop.id).map(toBoothBooking),
        }
      : null,
    shopReviewsYouWrote: all('select r.rating, r.text, r.created_at createdAt, s.name shop from shop_reviews r join shops s on s.id = r.shop_id where r.author_id = ?', user.id),
    payments: all(
      'select kind, description, amount_cents amountCents, currency, status, receipt_url receiptUrl, created_at createdAt, refunded_at refundedAt from payments where user_id = ? order by created_at',
      user.id,
    ),
    payoutsToYou: all('select amount_cents amountCents, currency, method, note, created_at createdAt from payouts where payee_id = ? order by created_at', user.id),
    messages: conversations.map(c => ({
      with: c.other_name,
      messages: all('select sender_id, content, attachment_url, created_at from messages where conversation_id = ? order by created_at', c.id).map(m => ({
        from: m.sender_id === user.id ? 'you' : c.other_name,
        text: m.content,
        attachment: m.attachment_url,
        sentAt: m.created_at,
      })),
    })),
    notifications: all('select message, link, read, created_at createdAt from notifications where user_id = ? order by created_at', user.id),
    reportsYouSent: all('select target_type targetType, reason, status, created_at createdAt from reports where reporter_id = ?', user.id),
    contactMessages: all('select message, created_at createdAt from contact_messages where user_id = ?', user.id),
  };
  res.setHeader('Content-Disposition', `attachment; filename="my-data-${todayStr()}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
});

// --- Delete my account ---

meRouter.post('/me/delete', async (req, res) => {
  const user = requireUser(req);
  if (user.role === 'admin') throw forbidden("Admins can't delete their own account here. Ask another admin, or remove admin access first.");
  const { password } = parse(z.object({ password: z.string().max(200) }), req.body);
  if (!(await verifyPassword(password, user.password_hash))) throw badRequest('Your password is incorrect.');
  const blockers = deletionBlockers(user.id);
  if (blockers.length) {
    throw conflict(`Your account can't be deleted yet because you have ${blockers.join(' and ')}. Cancel or finish those first, or contact us.`);
  }
  await deleteAccount(user);
  destroySession(req, res);
  res.json({ ok: true });
});

// --- Notifications & live events ---

meRouter.get('/notifications', (req, res) => {
  const user = requireUser(req);
  const rows = getDb()
    .prepare('select * from notifications where user_id = ? order by created_at desc limit 50')
    .all(user.id) as any[];
  res.json(rows.map(n => ({ id: n.id, message: n.message, link: n.link, read: !!n.read, createdAt: n.created_at })));
});

meRouter.post('/notifications/read', (req, res) => {
  const user = requireUser(req);
  getDb().prepare('update notifications set read = 1 where user_id = ? and read = 0').run(user.id);
  res.json({ ok: true });
});

meRouter.get('/events', (req, res) => {
  const user = requireUser(req);
  subscribe(req, res, user.id);
});

// --- Reports ---

meRouter.post('/reports', (req, res) => {
  const user = requireUser(req);
  const body = parse(
    z.object({
      targetType: z.enum(['user', 'booking', 'shop', 'review', 'message']),
      targetId: z.string().min(1).max(100),
      reason: z.string().trim().min(5, 'Please describe the problem').max(2000),
    }),
    req.body,
  );
  getDb()
    .prepare('insert into reports (id, reporter_id, target_type, target_id, reason, created_at) values (?, ?, ?, ?, ?, ?)')
    .run(newId(), user.id, body.targetType, body.targetId, body.reason, nowIso());
  notifyAdmins(`New report from ${user.name}.`, '/admin/reports');
  res.status(201).json({ ok: true });
});
