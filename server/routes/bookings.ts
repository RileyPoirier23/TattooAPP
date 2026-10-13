// Client booking requests (B2C), booth rentals (B2B) and their payments.
import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getUser, isArtistRole, randomToken, requireArtist, requireUser, type UserRow } from '../auth';
import { getDb, newId, nowIso, parseJson } from '../db';
import {
  badRequest, conflict, daysBetweenInclusive, forbidden, formatMoney, formatRange, formatWhen, HttpError, notFound, parse, parseDate, todayStr,
  toCents, zDate,
} from '../http';
import {
  BOOKING_REQUEST_SELECT, BOOTH_BOOKING_SELECT, intakeOf, recomputeArtistRating, recomputeShopRating, toBookingRequest,
  toBoothBooking,
} from '../mappers';
import { saveImage, upload, uploadLimiter } from '../uploads';
import { getSettings } from '../settings';
import { notify, notifyAdmins } from '../notify';
import { emailReady, sendEmail } from '../email';
import { emit } from '../events';
import { config } from '../config';
import { boothClash, depositFeeCents, payBoothBooking, payDeposit } from '../billing';
import { sendSystemMessage } from './messages';
import type { ArtistService, GuestBookingView, MyBookings, WeeklyHours } from '../../shared/types';

export const bookingsRouter = Router();

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.isProduction ? 15 : 1000,
  message: { error: 'Too many booking requests. Please try again later.' },
});

const guestLink = (r: { id: string; access_token: string }) => `${config.appUrl}/booking/${r.id}?token=${r.access_token}`;

// Guest email addresses aren't verified, so one booking can only trigger a few emails a day — enough for any real
// booking, but nobody can use a booking made with someone else's address to flood their inbox.
const EMAILS_PER_BOOKING_PER_DAY = 6;
const bookingEmails = new Map<string, number[]>();

function bookingEmailAllowed(bookingId: string): boolean {
  const now = Date.now();
  const recent = (bookingEmails.get(bookingId) ?? []).filter(t => now - t < 86_400_000);
  const allowed = recent.length < EMAILS_PER_BOOKING_PER_DAY;
  if (allowed) recent.push(now);
  bookingEmails.set(bookingId, recent);
  if (bookingEmails.size > 50_000) bookingEmails.delete(bookingEmails.keys().next().value!);
  return allowed;
}

function tokenMatches(a: unknown, b: string) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Returns a reason the artist can't take a booking on `date`, or null if they can. */
export function unavailableReason(artist: UserRow, date: string): string | null {
  const hours = parseJson<WeeklyHours>(artist.hours, {});
  const hasHours = Object.values(hours).some(s => s?.length);
  if (hasHours && !hours[String(parseDate(date).getDay())]?.length) return `${artist.name} doesn't work on that day of the week.`;
  const off = getDb().prepare('select 1 from days_off where artist_id = ? and date = ?').get(artist.id, date);
  if (off) return `${artist.name} is not available on that date.`;
  return null;
}

// ---------- Create a booking request ----------

const requestSchema = z.object({
  artistId: z.string().min(1),
  serviceId: z.string().max(60).optional().nullable(),
  date: zDate,
  preferredTime: z.enum(['anytime', 'morning', 'afternoon', 'evening']).default('anytime'),
  message: z.string().trim().max(3000).default(''),
  tattooWidth: z.coerce.number().min(0).max(200).optional().nullable(),
  tattooHeight: z.coerce.number().min(0).max(200).optional().nullable(),
  bodyPlacement: z.string().trim().max(100).default(''),
  budget: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  guestName: z.string().trim().max(100).optional(),
  guestEmail: z.string().trim().toLowerCase().email('Enter a valid email address').max(200).optional().or(z.literal('')),
  guestPhone: z.string().trim().max(40).optional(),
  acceptTerms: z.literal(true, { message: 'Please confirm you are 18 or older and accept the booking policy.' }),
  website: z.string().max(200).optional(), // honeypot: hidden from people, filled in by spam bots
});

const GUEST_REQUESTS_PER_DAY = 3;
const PENDING_PER_ARTIST = 3;

bookingsRouter.post('/booking-requests', createLimiter, uploadLimiter, upload.array('images', 5), (req, res) => {
  const settings = getSettings();
  if (!settings.features.clientBooking) throw forbidden('Online booking is currently turned off.');
  let raw: unknown;
  try {
    raw = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
  } catch {
    throw badRequest('Invalid booking data.');
  }
  const body = parse(requestSchema, raw);
  const user = req.user;
  const db = getDb();

  const artist = db
    .prepare("select * from users where id = ? and role in ('artist','dual') and status = 'active'")
    .get(body.artistId) as UserRow | undefined;
  if (!artist) throw notFound('Artist not found.');
  if (user?.id === artist.id || (!user && body.guestEmail === artist.email)) throw badRequest("You can't book yourself.");
  if (user && !['client', 'dual', 'artist'].includes(user.role)) throw forbidden('Please use a client account to book tattoos.');

  if (body.website) throw badRequest('Your request could not be sent.');
  if (!user) {
    if (!settings.features.guestBooking) throw new HttpError(401, 'Please log in or create an account to book.');
    if (!body.guestName) throw badRequest('Please enter your name.');
    if (/https?:|www\.|[<>]/i.test(body.guestName)) throw badRequest('Please enter just your name.');
    if (!body.guestEmail) throw badRequest('Please enter your email so the artist can reach you.');
    const recent = db
      .prepare('select count(*) c from booking_requests where guest_email = ? and created_at >= ?')
      .get(body.guestEmail, new Date(Date.now() - 86_400_000).toISOString()) as { c: number };
    if (recent.c >= GUEST_REQUESTS_PER_DAY) {
      throw new HttpError(429, "You've sent several requests today. Please wait for a reply, or create a free account to keep track of them.");
    }
  }
  const pending = db
    .prepare("select count(*) c from booking_requests where artist_id = ? and status = 'pending' and (client_id = ? or (client_id is null and guest_email = ?))")
    .get(artist.id, user?.id ?? null, user ? null : body.guestEmail) as { c: number };
  if (pending.c >= PENDING_PER_ARTIST) {
    throw conflict(`You already have ${pending.c} requests waiting for ${artist.name} to reply. Please wait for an answer before sending more.`);
  }

  // One day of slack: the server runs on UTC while clients may be several hours behind.
  if (body.date < todayStr(-1)) throw badRequest('Please choose a date in the future.');
  if (body.date > todayStr(366)) throw badRequest('Bookings can be made up to a year in advance.');
  const reason = unavailableReason(artist, body.date);
  if (reason) throw badRequest(reason);

  const intake = intakeOf(artist);
  const files = (req.files as Express.Multer.File[]) || [];
  if (intake.requireSize && (!body.tattooWidth || !body.tattooHeight)) throw badRequest('Please enter the approximate size of your tattoo.');
  if (intake.requirePlacement && !body.bodyPlacement) throw badRequest('Please choose where on your body the tattoo will go.');
  if (intake.requireDescription && body.message.length < 10) throw badRequest('Please describe your tattoo idea (at least a sentence).');
  if (intake.requireBudget && !body.budget) throw badRequest('Please enter your budget.');
  if (intake.requireReferenceImages && files.length === 0) throw badRequest('Please attach at least one reference image.');

  const services = parseJson<ArtistService[]>(artist.services, []);
  const service = body.serviceId ? services.find(s => s.id === body.serviceId) : undefined;
  if (body.serviceId && !service) throw badRequest('That service is no longer offered. Please pick another.');
  const depositCents = toCents(service ? service.deposit : settings.defaultDeposit);

  const images = files.map(saveImage);
  const id = newId();
  const now = nowIso();
  const token = randomToken(24);
  db.prepare(
    `insert into booking_requests (id, artist_id, client_id, guest_name, guest_email, guest_phone, access_token, service_id,
       service_name, service_price, date, preferred_time, message, tattoo_width, tattoo_height, body_placement, budget,
       reference_images, deposit_cents, fee_cents, terms_accepted_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, artist.id, user?.id ?? null, user ? null : body.guestName, user ? null : body.guestEmail, user ? null : body.guestPhone || null,
    token, service?.id ?? null, service?.name ?? 'Custom tattoo', service?.price ?? null, body.date, body.preferredTime,
    body.message, body.tattooWidth ?? null, body.tattooHeight ?? null, body.bodyPlacement, body.budget ?? null,
    JSON.stringify(images), depositCents, depositFeeCents(depositCents, artist), now, now, now,
  );

  const clientName = user?.name || body.guestName!;
  notify(artist.id, `New booking request from ${clientName} for ${formatWhen(body.date)}.`, {
    link: '/dashboard',
    email: { subject: `New booking request from ${clientName}`, actionLabel: 'Review request' },
  });
  emit(artist.id, 'bookings');

  const row = db.prepare(`${BOOKING_REQUEST_SELECT} where br.id = ?`).get(id) as any;
  if (!user && body.guestEmail) {
    sendEmail({
      to: body.guestEmail,
      subject: `Your booking request to ${artist.name}`,
      lines: [
        `Hi ${body.guestName},`,
        `Your request for ${formatWhen(body.date)} has been sent to ${artist.name}. We'll email you when they respond.`,
        'Use the link below any time to check your request or pay your deposit once it is approved.',
      ],
      action: { label: 'View your request', url: guestLink(row) },
    });
  }
  res.status(201).json({ request: toBookingRequest(row, { includeToken: true }), link: guestLink(row) });
});

// ---------- Read ----------

bookingsRouter.get('/bookings', (req, res) => {
  const user = requireUser(req);
  const db = getDb();
  const asClient = (db.prepare(`${BOOKING_REQUEST_SELECT} where br.client_id = ? order by br.date desc`).all(user.id) as any[])
    .map(r => toBookingRequest(r, { includeToken: true }));
  const asArtist = isArtistRole(user.role)
    ? (db.prepare(`${BOOKING_REQUEST_SELECT} where br.artist_id = ? order by br.date`).all(user.id) as any[])
        .map(r => toBookingRequest(r, { includeContact: true }))
    : [];
  const boothBookings = isArtistRole(user.role)
    ? (db.prepare(`${BOOTH_BOOKING_SELECT} where bb.artist_id = ? order by bb.start_date desc`).all(user.id) as any[]).map(toBoothBooking)
    : [];
  const shopBookings =
    user.role === 'shop-owner'
      ? (db.prepare(`${BOOTH_BOOKING_SELECT} where s.owner_id = ? order by bb.start_date`).all(user.id) as any[]).map(toBoothBooking)
      : [];
  const body: MyBookings = { asClient, asArtist, boothBookings, shopBookings };
  res.json(body);
});

type Access = { row: any; role: 'artist' | 'client' | 'admin' };

/** Who is acting on this booking request: the artist, the client (account or guest link), or an admin. */
function loadRequestAccess(req: Request, id: string, token?: unknown): Access {
  const row = getDb().prepare(`${BOOKING_REQUEST_SELECT} where br.id = ?`).get(id) as any;
  if (!row) throw notFound('Booking not found.');
  const user = req.user;
  if (user?.id === row.artist_id) return { row, role: 'artist' };
  if (user && user.id === row.client_id) return { row, role: 'client' };
  if (tokenMatches(token, row.access_token)) return { row, role: 'client' };
  if (user?.role === 'admin') return { row, role: 'admin' };
  throw notFound('Booking not found.');
}

bookingsRouter.get('/booking-requests/:id', (req, res) => {
  const { row, role } = loadRequestAccess(req, req.params.id, req.query.token);
  const artist = getUser(row.artist_id)!;
  const view: GuestBookingView = {
    request: toBookingRequest(row, { includeToken: role === 'client', includeContact: role !== 'client' }),
    artist: { id: artist.id, name: artist.name, city: artist.city, avatarUrl: artist.avatar_url },
  };
  res.json(view);
});

/** A logged-in client adds a booking they made as a guest to their account (the private link proves it's theirs). */
bookingsRouter.post('/booking-requests/:id/claim', (req, res) => {
  const user = requireUser(req);
  if (!['client', 'dual', 'artist'].includes(user.role)) throw forbidden('Use a client account to keep bookings.');
  const { token } = parse(z.object({ token: z.string().min(1) }), req.body);
  const row = getDb().prepare('select * from booking_requests where id = ?').get(req.params.id) as any;
  if (!row || !tokenMatches(token, row.access_token)) throw notFound('Booking not found.');
  if (row.client_id) throw conflict(row.client_id === user.id ? 'This booking is already in your account.' : 'This booking belongs to another account.');
  if (row.artist_id === user.id) throw badRequest("You can't book yourself.");
  getDb().prepare('update booking_requests set client_id = ?, updated_at = ? where id = ?').run(user.id, nowIso(), row.id);
  emit(row.artist_id, 'bookings');
  res.json({ ok: true });
});

// ---------- Status changes ----------

const actionSchema = z.object({
  action: z.enum(['approve', 'decline', 'cancel', 'complete', 'no-show', 'reschedule', 'archive', 'unarchive']),
  date: zDate.optional(),
  preferredTime: z.enum(['anytime', 'morning', 'afternoon', 'evening']).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time like 13:00').optional().or(z.literal('')),
  note: z.string().trim().max(1000).optional(),
  depositAmount: z.coerce.number().min(0).max(100000).optional(),
  token: z.string().optional(),
});

bookingsRouter.post('/booking-requests/:id/action', (req, res) => {
  const body = parse(actionSchema, req.body);
  const { row, role } = loadRequestAccess(req, req.params.id, body.token);
  const db = getDb();
  const now = nowIso();
  const artist = getUser(row.artist_id)!;
  const statusLink = guestLink(row);

  const isArtist = role === 'artist' || role === 'admin';
  const when = formatWhen(row.date, row.appointment_time);

  const tellClient = (message: string, subject: string, extra: string[] = []) => {
    const email = bookingEmailAllowed(row.id);
    if (row.client_id) {
      notify(row.client_id, message, { link: '/bookings', ...(email ? { email: { subject, lines: [message, ...extra], actionLabel: 'View booking' } } : {}) });
    } else if (row.guest_email && email) {
      sendEmail({ to: row.guest_email, subject, lines: [`Hi ${row.guest_name},`, message, ...extra], action: { label: 'View your booking', url: statusLink } });
    }
  };
  const set = (sql: string, ...params: unknown[]) => db.prepare(`update booking_requests set ${sql}, updated_at = ? where id = ?`).run(...params, now, row.id);

  switch (body.action) {
    case 'approve': {
      if (!isArtist) throw forbidden();
      if (row.status !== 'pending') throw conflict('Only pending requests can be approved.');
      if (row.date < todayStr(-1)) throw conflict('This request is for a date that has passed. Reschedule it first, or decline it.');
      const depositCents = body.depositAmount !== undefined ? toCents(body.depositAmount) : row.deposit_cents;
      const time = body.time || null;
      set("status = 'approved', deposit_cents = ?, fee_cents = ?, artist_note = ?, appointment_time = ?", depositCents, depositFeeCents(depositCents, artist), body.note ?? row.artist_note, time);
      const feeCents = depositFeeCents(depositCents, artist);
      const currency = getSettings().currency;
      const payLine = depositCents > 0
        ? `Please pay your ${formatMoney(depositCents, currency)} deposit${feeCents ? ` (plus a ${formatMoney(feeCents, currency)} booking fee, ${formatMoney(depositCents + feeCents, currency)} in total)` : ''} to lock in your appointment.`
        : 'No deposit is required.';
      tellClient(`${artist.name} approved your booking for ${formatWhen(row.date, time)}! ${payLine}`, `${artist.name} approved your booking`, body.note ? [`Note from ${artist.name}: ${body.note}`] : []);
      break;
    }
    case 'decline':
      if (!isArtist) throw forbidden();
      if (row.status !== 'pending') throw conflict('Only pending requests can be declined.');
      set("status = 'declined', artist_note = ?", body.note ?? row.artist_note);
      tellClient(`${artist.name} isn't able to take your booking for ${when}.`, 'Update on your booking request', body.note ? [`Note from ${artist.name}: ${body.note}`] : []);
      break;
    case 'cancel':
      if (!['pending', 'approved'].includes(row.status)) throw conflict('This booking can no longer be cancelled.');
      if (role === 'client' && row.status === 'approved' && row.date < todayStr(-1)) {
        throw conflict('This appointment date has passed. Contact the artist if something went wrong.');
      }
      set("status = 'cancelled', cancelled_by = ?", role);
      if (role === 'client') {
        notify(artist.id, `${row.client_name || row.guest_name} cancelled their booking for ${when}.`, {
          link: '/dashboard',
          email: { subject: 'A client cancelled their booking', actionLabel: 'Open dashboard' },
        });
      } else if (role === 'admin') {
        tellClient(`Your booking with ${artist.name} for ${when} was cancelled.`, 'Your booking was cancelled', body.note ? [`Note: ${body.note}`] : []);
        notify(artist.id, `The site admin cancelled your booking with ${row.client_name || row.guest_name} for ${when}.`, { link: '/dashboard' });
      } else {
        tellClient(`${artist.name} cancelled your booking for ${when}.`, 'Your booking was cancelled', body.note ? [`Note: ${body.note}`] : []);
      }
      if (row.payment_status === 'paid') {
        notifyAdmins(`A paid booking was cancelled (${artist.name}, ${when}). Review it for a refund in Payments.`, '/admin/payments', true);
      }
      break;
    case 'complete':
    case 'no-show':
      if (!isArtist) throw forbidden();
      if (row.status !== 'approved') throw conflict('Only approved bookings can be updated.');
      if (row.date > todayStr(1)) throw conflict("You can mark this after the appointment date.");
      set('status = ?', body.action === 'complete' ? 'completed' : 'no-show');
      if (body.action === 'complete' && getSettings().features.reviews) {
        tellClient(`Thanks for getting tattooed by ${artist.name}! How did it go? Leave a review to help others.`, `How was your session with ${artist.name}?`);
      }
      break;
    case 'reschedule': {
      if (!body.date) throw badRequest('Choose a new date.');
      if (!['pending', 'approved'].includes(row.status)) throw conflict('This booking can no longer be rescheduled.');
      if (!isArtist) throw forbidden('Please contact the artist to change your date.');
      if (body.date < todayStr(-1)) throw badRequest('Please choose a date in the future.');
      const time = body.time === undefined ? row.appointment_time : body.time || null;
      set('date = ?, preferred_time = ?, appointment_time = ?', body.date, body.preferredTime || row.preferred_time, time);
      tellClient(
        role === 'admin'
          ? `Your appointment with ${artist.name} was moved to ${formatWhen(body.date, time)}.`
          : `${artist.name} moved your appointment to ${formatWhen(body.date, time)}.`,
        'Your appointment was rescheduled',
        body.note ? [`Note: ${body.note}`] : [],
      );
      if (role === 'admin') {
        notify(artist.id, `The site admin moved your appointment with ${row.client_name || row.guest_name} to ${formatWhen(body.date, time)}.`, { link: '/dashboard' });
      }
      // The new date gets its own reminder.
      db.prepare('update booking_requests set reminder_sent_at = null where id = ?').run(row.id);
      break;
    }
    case 'archive':
    case 'unarchive':
      if (!isArtist) throw forbidden();
      set('artist_archived = ?', body.action === 'archive' ? 1 : 0);
      break;
  }
  emit(row.client_id, 'bookings');
  emit(row.artist_id, 'bookings');
  const updated = db.prepare(`${BOOKING_REQUEST_SELECT} where br.id = ?`).get(row.id) as any;
  res.json(toBookingRequest(updated, { includeToken: role === 'client', includeContact: role !== 'client' }));
});

bookingsRouter.post('/booking-requests/:id/review', (req, res) => {
  if (!getSettings().features.reviews) throw forbidden('Reviews are turned off.');
  const body = parse(
    z.object({ rating: z.coerce.number().int().min(1).max(5), text: z.string().trim().max(2000).default(''), token: z.string().optional() }),
    req.body,
  );
  const { row, role } = loadRequestAccess(req, req.params.id, body.token);
  if (role !== 'client') throw forbidden('Only the client can review this booking.');
  if (row.status !== 'completed') throw conflict('You can leave a review once your session is completed.');
  if (row.review_rating) throw conflict("You've already reviewed this booking.");
  if (!row.client_id && !(row.payment_status === 'paid' && row.deposit_cents > 0)) {
    throw conflict('Reviews from guest bookings are only possible after a paid deposit. Create an account to review your artist.');
  }
  getDb()
    .prepare('update booking_requests set review_rating = ?, review_text = ?, review_at = ?, updated_at = ? where id = ?')
    .run(body.rating, body.text, nowIso(), nowIso(), row.id);
  recomputeArtistRating(row.artist_id);
  notify(row.artist_id, `${row.client_name || row.guest_name} left you a ${body.rating}-star review.`, { link: `/artists/${row.artist_id}` });
  res.json({ ok: true });
});

bookingsRouter.post('/booking-requests/:id/pay', async (req, res) => {
  const body = parse(
    z.object({ sourceId: z.string().min(1).max(500), idempotencyKey: z.string().min(8).max(100), token: z.string().optional() }),
    req.body,
  );
  const { role } = loadRequestAccess(req, req.params.id, body.token);
  if (role !== 'client') throw forbidden('Only the client can pay this deposit.');
  const result = await payDeposit(req.params.id, body.sourceId, body.idempotencyKey);
  res.json(result);
});

bookingsRouter.post('/booking-requests/:id/aftercare', async (req, res) => {
  const { row, role } = loadRequestAccess(req, req.params.id);
  if (role !== 'artist') throw forbidden();
  const { kind } = parse(z.object({ kind: z.enum(['aftercare', 'healed-photo']) }), req.body);
  if (row.status !== 'completed') throw conflict('Mark the appointment as completed first.');
  if (!row.client_id && !row.guest_email) throw badRequest('This client has no contact details.');
  if (!row.client_id && !emailReady()) {
    throw conflict("Email isn't set up on this site yet, so this can't be sent to a guest. Ask the site owner to set up email.");
  }
  if (!bookingEmailAllowed(row.id)) throw new HttpError(429, "You've already sent this client several messages today. Please try again tomorrow.");
  const artist = req.user!;
  const text =
    kind === 'aftercare'
      ? artist.aftercare_message ||
        'Aftercare instructions:\n1. Leave the wrap on for a few hours, then wash gently with fragrance-free soap.\n2. Pat dry and apply a thin layer of unscented moisturizer 2–3 times a day.\n3. Don\'t pick, scratch or soak it (no swimming or baths) for 2–3 weeks.\n4. Keep it out of the sun while it heals.'
      : `Hi! I'd love to see how your tattoo healed. Could you send me a photo when you get a chance? Thank you!`;
  if (row.client_id) {
    sendSystemMessage(artist.id, row.client_id, text);
  } else if (row.guest_email) {
    sendEmail({
      to: row.guest_email,
      subject: kind === 'aftercare' ? `Aftercare from ${artist.name}` : `${artist.name} would love to see your healed tattoo`,
      lines: [`Hi ${row.guest_name},`, ...text.split('\n'), ...(kind === 'healed-photo' ? ['Create a free account with this email address and use your booking link to message your artist and send photos.'] : [])],
      action: { label: 'Open your booking', url: guestLink(row) },
    });
  } else {
    throw badRequest('This client has no contact details.');
  }
  res.json({ ok: true });
});

// ---------- Booth rentals ----------

bookingsRouter.post('/booth-bookings', (req, res) => {
  const artist = requireArtist(req);
  const settings = getSettings();
  if (!settings.features.boothRental) throw forbidden('Booth rentals are currently turned off.');
  const body = parse(z.object({ boothId: z.string().min(1), startDate: zDate, endDate: zDate }), req.body);
  if (body.startDate < todayStr(-1)) throw badRequest('The start date must be today or later.');
  if (body.endDate < body.startDate) throw badRequest('The end date must be on or after the start date.');
  const days = daysBetweenInclusive(body.startDate, body.endDate);
  if (days > 60) throw badRequest('Booth rentals can be up to 60 days.');
  if (body.startDate > todayStr(366)) throw badRequest('Rentals can be booked up to a year in advance.');

  const db = getDb();
  const booth = db
    .prepare(
      `select bo.*, s.name shop_name, s.owner_id from booths bo join shops s on s.id = bo.shop_id
       join users o on o.id = s.owner_id where bo.id = ? and bo.active = 1 and o.status = 'active'`,
    )
    .get(body.boothId) as any;
  if (!booth) throw notFound('That booth is no longer available.');

  const id = newId();
  const totalCents = toCents(booth.daily_rate * days);
  const feeCents = Math.round((totalCents * settings.boothFeePercent) / 100);
  const holdCutoff = new Date(Date.now() - settings.boothHoldHours * 3_600_000).toISOString();
  const openHolds = (db.prepare("select count(*) c from booth_bookings where artist_id = ? and status = 'unpaid' and created_at > ?").get(artist.id, holdCutoff) as { c: number }).c;
  if (openHolds >= 3) throw conflict('You have 3 unpaid reservations. Pay for or cancel one before reserving another.');

  db.transaction(() => {
    if (boothClash(booth.id, body.startDate, body.endDate)) {
      throw conflict('Those dates are already booked or blocked for this booth. Please pick different dates.');
    }
    db.prepare(
      `insert into booth_bookings (id, artist_id, booth_id, shop_id, start_date, end_date, days, total_cents, fee_cents, status, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
    ).run(id, artist.id, booth.id, booth.shop_id, body.startDate, body.endDate, days, totalCents, feeCents, nowIso());
  })();

  notify(booth.owner_id, `${artist.name} reserved ${booth.name} for ${body.startDate} → ${body.endDate} (awaiting payment).`, { link: '/shop' });
  emit(booth.owner_id, 'bookings');
  const row = db.prepare(`${BOOTH_BOOKING_SELECT} where bb.id = ?`).get(id);
  res.status(201).json(toBoothBooking(row));
});

bookingsRouter.post('/booth-bookings/:id/pay', async (req, res) => {
  const artist = requireArtist(req);
  const body = parse(z.object({ sourceId: z.string().min(1).max(500), idempotencyKey: z.string().min(8).max(100) }), req.body);
  res.json(await payBoothBooking(req.params.id, artist, body.sourceId, body.idempotencyKey));
});

bookingsRouter.post('/booth-bookings/:id/cancel', (req, res) => {
  const user = requireUser(req);
  const db = getDb();
  const b = db.prepare(`${BOOTH_BOOKING_SELECT} where bb.id = ?`).get(req.params.id) as any;
  if (!b) throw notFound('Booking not found.');
  const shop = db.prepare('select owner_id from shops where id = ?').get(b.shop_id) as { owner_id: string };
  const isOwner = shop.owner_id === user.id;
  if (b.artist_id !== user.id && !isOwner && user.role !== 'admin') throw notFound('Booking not found.');
  if (b.status === 'paid' && !isOwner && user.role !== 'admin') {
    throw conflict('Paid rentals can only be cancelled by the shop or the site admin, so the payment can be refunded. Message the shop to arrange it.');
  }
  if (b.status !== 'unpaid' && b.status !== 'paid') throw conflict('This rental is already cancelled.');
  const wasPaid = b.status === 'paid';
  db.prepare("update booth_bookings set status = 'cancelled' where id = ?").run(b.id);
  if (isOwner) {
    notify(b.artist_id, `${b.shop_name} cancelled your ${wasPaid ? '' : 'unpaid '}reservation for ${b.booth_name} (${formatRange(b.start_date, b.end_date)}).${wasPaid ? ' Your payment will be refunded.' : ''}`, {
      link: '/bookings',
      email: wasPaid ? { subject: `${b.shop_name} cancelled your guest spot`, actionLabel: 'View bookings' } : undefined,
    });
  } else {
    notify(shop.owner_id, `${b.artist_name} cancelled their reservation for ${b.booth_name}.`, { link: '/shop' });
  }
  if (wasPaid) notifyAdmins(`A paid booth rental was cancelled (${b.shop_name}, ${formatRange(b.start_date, b.end_date)}). Refund it in Payments.`, '/admin/payments', true);
  emit(b.artist_id, 'bookings');
  emit(shop.owner_id, 'bookings');
  res.json({ ok: true });
});

bookingsRouter.post('/booth-bookings/:id/review', (req, res) => {
  const artist = requireArtist(req);
  if (!getSettings().features.reviews) throw forbidden('Reviews are turned off.');
  const body = parse(z.object({ rating: z.coerce.number().int().min(1).max(5), text: z.string().trim().max(2000).default('') }), req.body);
  const db = getDb();
  const b = db.prepare('select * from booth_bookings where id = ? and artist_id = ?').get(req.params.id, artist.id) as any;
  if (!b) throw notFound('Booking not found.');
  if (b.status !== 'paid') throw conflict('You can review shops you have rented from.');
  if (b.start_date > todayStr()) throw conflict('You can review the shop once your guest spot has started.');
  try {
    db.prepare('insert into shop_reviews (id, shop_id, booth_booking_id, author_id, rating, text, created_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(newId(), b.shop_id, b.id, artist.id, body.rating, body.text, nowIso());
  } catch {
    throw conflict("You've already reviewed this stay.");
  }
  recomputeShopRating(b.shop_id);
  const shop = db.prepare('select owner_id from shops where id = ?').get(b.shop_id) as { owner_id: string };
  notify(shop.owner_id, `${artist.name} left your shop a ${body.rating}-star review.`, { link: `/shops/${b.shop_id}` });
  res.json({ ok: true });
});
