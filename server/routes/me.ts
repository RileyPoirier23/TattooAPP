// The logged-in user's own profile, portfolio, availability, plan, earnings and notifications.
import { Router } from 'express';
import { z } from 'zod';
import { isArtistRole, requireArtist, requireUser, getUser } from '../auth';
import { getDb, newId, nowIso, parseJson } from '../db';
import { badRequest, conflict, forbidden, parse, todayStr, zDate } from '../http';
import { toMe } from '../mappers';
import { deleteUpload, saveImage, upload } from '../uploads';
import { subscribe } from '../events';
import { earningsFor, subscribePro } from '../billing';
import { disableCard } from '../square';
import { notifyAdmins } from '../notify';
import type { PortfolioImage } from '../../shared/types';

export const meRouter = Router();

const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time like 09:00');
const zUrl = z.string().trim().max(300).refine(v => v === '' || /^https?:\/\//i.test(v), 'must start with http:// or https://');

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

meRouter.post('/me/avatar', upload.single('image'), (req, res) => {
  const user = requireUser(req);
  const url = saveImage(req.file);
  getDb().prepare('update users set avatar_url = ?, updated_at = ? where id = ?').run(url, nowIso(), user.id);
  deleteUpload(user.avatar_url);
  res.json({ user: toMe(getUser(user.id)!) });
});

meRouter.post('/me/portfolio', upload.array('images', 6), (req, res) => {
  const user = requireArtist(req);
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) throw badRequest('Choose at least one image.');
  const current = parseJson<PortfolioImage[]>(user.portfolio, []);
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

meRouter.delete('/me/card', async (req, res) => {
  const user = requireUser(req);
  if (user.square_card_id) await disableCard(user.square_card_id);
  getDb()
    .prepare('update users set square_card_id = null, card_label = null, pro_auto_renew = 0, updated_at = ? where id = ?')
    .run(nowIso(), user.id);
  res.json({ user: toMe(getUser(user.id)!) });
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
