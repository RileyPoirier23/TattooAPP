// Money movement: deposits, booth rentals, Pro subscriptions, refunds and the payout ledger.
// All charges go to the site owner's Square account. The ledger tracks what each artist / shop is owed.
import { getDb, newId, nowIso } from './db';
import { getSettings } from './settings';
import { conflict, formatMoney, formatRange, formatWhen, HttpError, notFound, todayStr, toCents } from './http';
import { getUser, isArtistRole, isPro, PRO_GRACE_DAYS, type UserRow } from './auth';
import {
  cardLabel, createCard, createCustomer, createPayment, disableCard, idempotencyKey, locationCurrency, paymentsReady,
  refundPayment, type SquarePayment,
} from './square';
import { notify, notifyAdmins } from './notify';
import { sendEmail } from './email';
import { config } from './config';
import { emit } from './events';
import type { Earnings } from '../shared/types';

const inFlight = new Set<string>();

/** Prevents two simultaneous charges for the same thing (e.g. a double-clicked Pay button). */
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) throw conflict('This payment is already being processed.');
  inFlight.add(key);
  try {
    return await fn();
  } finally {
    inFlight.delete(key);
  }
}

function ensureReady() {
  if (!paymentsReady()) throw new HttpError(503, 'Online payments are not set up yet. Please contact the site owner.');
}

/** Sandbox (test) and production payments are kept apart so test data never mixes with real money. */
export const currentEnvironment = () => getSettings().squareEnvironment;

/** Drops every saved card and Square customer (used when Square switches between Sandbox and Production). */
export function forgetSavedCards(): number {
  return getDb()
    .prepare(
      `update users set square_customer_id = null, square_card_id = null, card_label = null, pro_auto_renew = 0,
         renewal_failed_at = null, updated_at = ? where square_card_id is not null or square_customer_id is not null`,
    )
    .run(nowIso()).changes;
}

interface PaymentRecord {
  kind: 'deposit' | 'booth' | 'subscription';
  refId: string;
  userId: string | null;
  payerEmail: string | null;
  description: string;
  amountCents: number;
  feeCents: number;
  payeeId: string | null;
  payeeAmountCents: number;
  currency: string;
  squarePaymentId: string;
  receiptUrl: string | null;
}

function insertPayment(p: PaymentRecord): string {
  const id = newId();
  getDb()
    .prepare(
      `insert into payments (id, kind, ref_id, user_id, payer_email, description, amount_cents, fee_cents, payee_id,
         payee_amount_cents, currency, square_payment_id, receipt_url, status, environment, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
    )
    .run(id, p.kind, p.refId, p.userId, p.payerEmail, p.description, p.amountCents, p.feeCents, p.payeeId,
      p.payeeAmountCents, p.currency, p.squarePaymentId, p.receiptUrl, currentEnvironment(), nowIso());
  return id;
}

export function depositFeeCents(depositCents: number, artist: Pick<UserRow, 'subscription_tier' | 'pro_until'>): number {
  if (isPro(artist)) return 0;
  return Math.round((depositCents * getSettings().depositFeePercent) / 100);
}

/**
 * The booking changed while the card was being charged (e.g. it was cancelled). Record the charge so it is
 * never lost, refund it straight away, and tell the payer.
 */
async function recordAndRefund(p: PaymentRecord, reason: string): Promise<never> {
  const paymentId = insertPayment(p);
  try {
    await refund(paymentId, reason);
  } catch (err) {
    console.error('[billing] automatic refund failed', paymentId, err);
    notifyAdmins(`A payment needs a manual refund: ${p.description} (${formatMoney(p.amountCents, p.currency)}).`, '/admin/payments', true);
    throw conflict(`${reason} We couldn't refund your card automatically; the site owner has been told and will refund it shortly.`);
  }
  throw conflict(`${reason} Your card has been refunded.`);
}

/**
 * If an earlier, unconfirmed attempt is what went through (see createPayment) and it was for a different amount
 * than is due now, record it and refund it rather than accept the wrong amount.
 */
async function refundIfAmountChanged(payment: SquarePayment, record: PaymentRecord) {
  const charged = payment.amount_money?.amount;
  if (charged === undefined || charged === record.amountCents) return;
  await recordAndRefund({ ...record, amountCents: charged, feeCents: 0, payeeAmountCents: 0 }, 'The amount due changed while you were paying.');
}

// ---------- Client deposits ----------

export async function payDeposit(requestId: string, sourceId: string, clientKey: string) {
  ensureReady();
  return withLock(`deposit:${requestId}`, async () => {
    const db = getDb();
    const r = db.prepare('select * from booking_requests where id = ?').get(requestId) as any;
    if (!r) throw notFound('Booking not found.');
    if (r.payment_status === 'paid') throw conflict('This deposit has already been paid.');
    if (r.status !== 'approved') throw conflict('The artist needs to approve this booking before the deposit can be paid.');
    if (r.deposit_cents <= 0) throw conflict('No deposit is needed for this booking.');
    if (r.date < todayStr(-1)) throw conflict('This appointment date has passed. Please contact the artist.');
    const artist = getUser(r.artist_id);
    if (!artist || artist.status !== 'active') throw conflict("This artist isn't taking bookings right now, so the deposit can't be paid.");
    const client = r.client_id ? getUser(r.client_id) : null;
    const payerEmail = client?.email || r.guest_email;

    const fee = depositFeeCents(r.deposit_cents, artist);
    const total = r.deposit_cents + fee;
    const currency = await locationCurrency();
    const when = formatWhen(r.date, r.appointment_time);
    const description = `Deposit for ${r.service_name} with ${artist.name} on ${when}`;

    const payment = await createPayment({
      sourceId,
      amountCents: total,
      currency,
      idempotencyKey: idempotencyKey('deposit', requestId, clientKey),
      note: description,
      referenceId: requestId,
      buyerEmail: payerEmail || undefined,
      ref: `deposit:${requestId}`,
    });
    const record: PaymentRecord = {
      kind: 'deposit', refId: requestId, userId: r.client_id, payerEmail, description,
      amountCents: total, feeCents: fee, payeeId: artist.id, payeeAmountCents: r.deposit_cents,
      currency, squarePaymentId: payment.id, receiptUrl: payment.receipt_url ?? null,
    };
    await refundIfAmountChanged(payment, record);

    // The booking may have been cancelled while the card was being charged.
    const now = nowIso();
    const ok = db.transaction(() => {
      const fresh = db.prepare('select status, payment_status from booking_requests where id = ?').get(requestId) as any;
      if (!fresh || fresh.status !== 'approved' || fresh.payment_status !== 'unpaid') return false;
      db.prepare("update booking_requests set payment_status = 'paid', fee_cents = ?, deposit_paid_at = ?, updated_at = ? where id = ?")
        .run(fee, now, now, requestId);
      insertPayment(record);
      return true;
    })();
    if (!ok) await recordAndRefund(record, 'This booking changed while you were paying.');

    const clientName = client?.name || r.guest_name;
    notify(artist.id, `${clientName} paid their ${formatMoney(r.deposit_cents, currency)} deposit for ${when}.`, {
      link: '/dashboard',
      email: { subject: 'Deposit received', actionLabel: 'Open dashboard' },
    });
    if (client) notify(client.id, `Your deposit for ${artist.name} is paid. You're booked for ${when}!`, { link: '/bookings' });
    emit(r.client_id, 'bookings');
    emit(artist.id, 'bookings');
    if (payerEmail) {
      sendEmail({
        to: payerEmail,
        subject: `Deposit received — you're booked with ${artist.name}`,
        lines: [
          `Hi ${clientName},`,
          `We've received your deposit of ${formatMoney(total, currency)} for ${r.service_name} with ${artist.name} on ${when}.`,
          ...(payment.receipt_url ? [`Receipt: ${payment.receipt_url}`] : []),
        ],
        action: { label: 'View your booking', url: `${config.appUrl}/booking/${r.id}?token=${r.access_token}` },
      });
    }
    return { amountCents: total, receiptUrl: payment.receipt_url ?? null };
  });
}

// ---------- Booth rentals ----------

/** Is any other paid booking, still-held reservation, or owner block on these dates? */
export function boothClash(boothId: string, start: string, end: string, excludeBookingId?: string): boolean {
  const db = getDb();
  const holdCutoff = new Date(Date.now() - getSettings().boothHoldHours * 3_600_000).toISOString();
  const booking = db
    .prepare(
      `select 1 from booth_bookings where booth_id = ? and id != ? and start_date <= ? and end_date >= ?
       and (status = 'paid' or (status = 'unpaid' and created_at > ?)) limit 1`,
    )
    .get(boothId, excludeBookingId ?? '', end, start, holdCutoff);
  const block = db.prepare('select 1 from booth_blocks where booth_id = ? and start_date <= ? and end_date >= ? limit 1').get(boothId, end, start);
  return !!(booking || block);
}

export async function payBoothBooking(bookingId: string, artist: UserRow, sourceId: string, clientKey: string) {
  return withLock(`booth:${bookingId}`, async () => {
    const db = getDb();
    const b = db
      .prepare(
        `select bb.*, s.name shop_name, s.owner_id, bo.name booth_name, bo.active booth_active, o.status owner_status
         from booth_bookings bb join shops s on s.id = bb.shop_id join booths bo on bo.id = bb.booth_id
         join users o on o.id = s.owner_id where bb.id = ?`,
      )
      .get(bookingId) as any;
    if (!b || b.artist_id !== artist.id) throw notFound('Booking not found.');
    if (b.status === 'paid') throw conflict('This booth rental has already been paid.');
    if (b.status !== 'unpaid') throw conflict('This reservation was cancelled or expired. Please book again.');
    if (b.start_date < todayStr(-1)) throw conflict('This rental has already started. Please book new dates.');
    if (!b.booth_active || b.owner_status !== 'active') throw conflict('This booth is no longer available.');
    // An expired hold may only be paid if nobody else has taken the dates since.
    if (boothClash(b.booth_id, b.start_date, b.end_date, b.id)) {
      throw conflict('Your reservation expired and those dates have since been booked. Please choose other dates.');
    }

    const description = `${b.booth_name} at ${b.shop_name}, ${formatRange(b.start_date, b.end_date)}`;
    if (b.total_cents > 0) ensureReady();
    const currency = b.total_cents > 0 ? await locationCurrency() : getSettings().currency;
    let payment: SquarePayment | null = null;
    if (b.total_cents > 0) {
      payment = await createPayment({
        sourceId,
        amountCents: b.total_cents,
        currency,
        idempotencyKey: idempotencyKey('booth', bookingId, clientKey),
        note: `Booth rental: ${description}`,
        referenceId: bookingId,
        buyerEmail: artist.email,
        ref: `booth:${bookingId}`,
      });
    }
    const record: PaymentRecord | null = payment && {
      kind: 'booth', refId: bookingId, userId: artist.id, payerEmail: artist.email, description,
      amountCents: b.total_cents, feeCents: b.fee_cents, payeeId: b.owner_id,
      payeeAmountCents: b.total_cents - b.fee_cents, currency, squarePaymentId: payment.id,
      receiptUrl: payment.receipt_url ?? null,
    };
    if (payment && record) await refundIfAmountChanged(payment, record);

    const now = nowIso();
    const ok = db.transaction(() => {
      const fresh = db.prepare('select status from booth_bookings where id = ?').get(bookingId) as any;
      if (fresh?.status !== 'unpaid' || boothClash(b.booth_id, b.start_date, b.end_date, b.id)) return false;
      db.prepare("update booth_bookings set status = 'paid', paid_at = ? where id = ?").run(now, bookingId);
      if (record) insertPayment(record);
      return true;
    })();
    if (!ok) {
      if (record) await recordAndRefund(record, 'This reservation changed while you were paying.');
      throw conflict('This reservation changed while you were paying. Please book again.');
    }

    notify(b.owner_id, `${artist.name} paid for ${b.booth_name} (${formatRange(b.start_date, b.end_date)}).`, {
      link: '/shop',
      email: { subject: 'Booth rental confirmed', actionLabel: 'Open shop dashboard' },
    });
    notify(artist.id, `Your guest spot at ${b.shop_name} is confirmed.`, {
      link: '/bookings',
      email: {
        subject: `Guest spot confirmed at ${b.shop_name}`,
        lines: [b.total_cents > 0 ? `Payment of ${formatMoney(b.total_cents, currency)} received for ${description}.` : `You're booked: ${description}.`],
      },
    });
    emit(b.owner_id, 'bookings');
    emit(artist.id, 'bookings');
    return { amountCents: b.total_cents, receiptUrl: payment?.receipt_url ?? null };
  });
}

// ---------- Pro subscription ----------

function addMonth(fromIso: string): string {
  const d = new Date(fromIso);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < day) d.setDate(0); // e.g. Jan 31 → Feb 28
  return d.toISOString();
}

async function saveCardOnFile(user: UserRow, sourceId: string, clientKey: string) {
  const db = getDb();
  let customerId = user.square_customer_id;
  if (!customerId) {
    customerId = await createCustomer(user.email, user.name, user.id);
    db.prepare('update users set square_customer_id = ? where id = ?').run(customerId, user.id);
  }
  const card = await createCard(sourceId, customerId, idempotencyKey('card', user.id, clientKey));
  if (user.square_card_id && user.square_card_id !== card.id) await disableCard(user.square_card_id);
  db.prepare('update users set square_card_id = ?, card_label = ?, renewal_failed_at = null, updated_at = ? where id = ?')
    .run(card.id, cardLabel(card), nowIso(), user.id);
  return { customerId, cardId: card.id };
}

/** Pro is always charged at the currently listed price — a price change applies from each subscriber's next renewal. */
export const currentProPriceCents = () => toCents(getSettings().proMonthlyPrice);

async function chargeSubscription(user: UserRow, customerId: string, cardId: string, key: string, amount: number) {
  const currency = await locationCurrency();
  const payment = await createPayment({
    sourceId: cardId,
    customerId,
    amountCents: amount,
    currency,
    idempotencyKey: key,
    note: `${getSettings().siteName} Pro — monthly`,
    referenceId: user.id,
    buyerEmail: user.email,
    ref: `pro:${user.id}`,
  });
  // A replayed earlier attempt may have been for the price listed at that time.
  amount = payment.amount_money?.amount ?? amount;
  insertPayment({
    kind: 'subscription', refId: user.id, userId: user.id, payerEmail: user.email,
    description: `Pro plan — 1 month`, amountCents: amount, feeCents: amount, payeeId: null, payeeAmountCents: 0,
    currency, squarePaymentId: payment.id, receiptUrl: payment.receipt_url ?? null,
  });
  return { amount, currency };
}

/** Starts Pro (charging the first month), or — if already Pro — saves the card and turns auto-renew back on. */
export async function subscribePro(user: UserRow, sourceId: string, clientKey: string) {
  ensureReady();
  return withLock(`sub:${user.id}`, async () => {
    const db = getDb();
    if (isPro(user)) {
      await saveCardOnFile(user, sourceId, clientKey);
      db.prepare('update users set pro_auto_renew = 1 where id = ?').run(user.id);
      return { charged: false };
    }
    if (!getSettings().features.proPlan) throw new HttpError(403, 'The Pro plan is not available right now.');
    const { customerId, cardId } = await saveCardOnFile(user, sourceId, clientKey);
    const price = currentProPriceCents();
    if (price <= 0) throw conflict('The Pro plan price is not set. Please contact the site owner.');
    const { amount, currency } = await chargeSubscription(user, customerId, cardId, idempotencyKey('sub', user.id, clientKey), price);
    const until = addMonth(nowIso());
    db.prepare(
      "update users set subscription_tier = 'pro', pro_until = ?, pro_auto_renew = 1, renewal_failed_at = null, updated_at = ? where id = ?",
    ).run(until, nowIso(), user.id);
    notify(user.id, `Welcome to Pro! Your plan renews on ${until.slice(0, 10)}.`, {
      link: '/settings',
      email: { subject: `You're on ${getSettings().siteName} Pro`, lines: [`Thanks! We charged ${formatMoney(amount, currency)}. Your plan renews automatically each month — cancel any time in Settings.`] },
    });
    return { charged: true };
  });
}

/** Replaces the saved card without changing whether the plan renews. */
export async function updateCard(user: UserRow, sourceId: string, clientKey: string) {
  ensureReady();
  return withLock(`sub:${user.id}`, () => saveCardOnFile(user, sourceId, clientKey));
}

const DAY = 86_400_000;

/**
 * Charges renewals that are due. A failed renewal is retried once a day for PRO_GRACE_DAYS before the plan
 * ends, so a temporary Square outage or an expired card doesn't cancel anyone instantly. Runs hourly.
 */
export async function processRenewals() {
  const db = getDb();
  const due = db
    .prepare("select * from users where subscription_tier = 'pro' and pro_until is not null and pro_until <= ?")
    .all(nowIso()) as UserRow[];
  for (const user of due) {
    const end = (message?: string) => {
      db.prepare("update users set subscription_tier = 'free', pro_auto_renew = 0, renewal_failed_at = null, updated_at = ? where id = ?").run(nowIso(), user.id);
      if (message) notify(user.id, message, { link: '/settings', email: { subject: 'Your Pro plan has ended', actionLabel: 'Resubscribe' } });
      emit(user.id, 'me');
    };
    const eligible = user.pro_auto_renew && user.square_card_id && user.square_customer_id && user.status === 'active' && isArtistRole(user.role);
    if (!eligible) {
      end(user.pro_auto_renew ? 'Your Pro plan has ended.' : undefined);
      continue;
    }
    if (!paymentsReady()) continue; // payments switched off temporarily — try again later
    if (user.renewal_failed_at && Date.now() - new Date(user.renewal_failed_at).getTime() < DAY) continue;

    const attempt = new Date().toISOString().slice(0, 10);
    try {
      const { amount, currency } = await chargeSubscription(
        user, user.square_customer_id!, user.square_card_id!, idempotencyKey('renew', user.id, user.pro_until!, attempt), currentProPriceCents(),
      );
      // A renewal on time (or during the grace period) keeps the same monthly date. After a longer gap (site
      // down, payments switched off) the new month starts now — the missed months are never charged.
      const overdue = Date.now() - new Date(user.pro_until!).getTime();
      const until = addMonth(overdue > PRO_GRACE_DAYS * DAY ? nowIso() : user.pro_until!);
      db.prepare('update users set pro_until = ?, renewal_failed_at = null, updated_at = ? where id = ?').run(until, nowIso(), user.id);
      notify(user.id, `Your Pro plan renewed for ${formatMoney(amount, currency)}. Next renewal: ${until.slice(0, 10)}.`, {
        link: '/settings',
        email: { subject: 'Your Pro plan renewed', actionLabel: 'Manage plan' },
      });
    } catch (err) {
      console.warn(`[billing] renewal failed for ${user.id}:`, (err as Error).message);
      const overdueDays = (Date.now() - new Date(user.pro_until!).getTime()) / DAY;
      if (overdueDays >= PRO_GRACE_DAYS) {
        end('We could not renew your Pro plan, so it has ended. Add a working card in Settings to resubscribe.');
      } else {
        if (!user.renewal_failed_at) {
          notify(user.id, `We couldn't renew your Pro plan (${(err as Error).message}). We'll try again tomorrow — update your card in Settings to keep Pro.`, {
            link: '/settings',
            email: { subject: 'Problem renewing your Pro plan', actionLabel: 'Update card' },
          });
        }
        db.prepare('update users set renewal_failed_at = ? where id = ?').run(nowIso(), user.id);
      }
    }
  }
}

// ---------- Refunds (admin) ----------

export async function refund(paymentId: string, reason: string) {
  const db = getDb();
  const p = db.prepare('select * from payments where id = ?').get(paymentId) as any;
  if (!p) throw notFound('Payment not found.');
  if (p.status === 'refunded') throw conflict('This payment was already refunded.');
  if (!p.square_payment_id) throw conflict('This payment has no Square record to refund.');
  return withLock(`refund:${paymentId}`, async () => {
    await refundPayment(p.square_payment_id, p.amount_cents, p.currency, reason || 'Refund');
    const now = nowIso();
    db.transaction(() => {
      db.prepare("update payments set status = 'refunded', refunded_at = ? where id = ?").run(now, paymentId);
      if (p.kind === 'deposit') {
        // A refunded deposit means the appointment is off (unless the session already happened).
        db.prepare(
          `update booking_requests set payment_status = 'refunded',
             status = case when status in ('pending','approved') then 'cancelled' else status end,
             cancelled_by = case when status in ('pending','approved') then 'admin' else cancelled_by end, updated_at = ?
           where id = ? and payment_status = 'paid'`,
        ).run(now, p.ref_id);
      } else if (p.kind === 'booth') {
        db.prepare("update booth_bookings set status = 'refunded' where id = ? and status in ('paid','cancelled')").run(p.ref_id);
      } else if (p.kind === 'subscription') {
        db.prepare("update users set subscription_tier = 'free', pro_until = null, pro_auto_renew = 0, updated_at = ? where id = ?").run(now, p.ref_id);
      }
    })();
    if (p.user_id) notify(p.user_id, `You've been refunded ${formatMoney(p.amount_cents, p.currency)} (${p.description}).`, { link: '/bookings' });
    if (p.payer_email) {
      sendEmail({
        to: p.payer_email,
        subject: 'Your refund is on its way',
        lines: [`We've refunded ${formatMoney(p.amount_cents, p.currency)} for: ${p.description}.`, 'Refunds usually appear on your statement within 5–10 business days.'],
      });
    }
    if (p.payee_id) notify(p.payee_id, `A payment was refunded: ${p.description}.`);
    emit(p.user_id, 'bookings');
    emit(p.payee_id, 'bookings');
    emit(p.user_id, 'me');
  });
}

// ---------- Ledger ----------

/**
 * SQL (for a payment aliased `p`): money from a paid rental the shop cancelled, or a paid appointment the artist or
 * admin cancelled. The payer is due a refund under the booking policy, so it isn't owed to the artist/shop.
 */
export const ON_HOLD_SQL = `(
  (p.kind = 'booth' and exists (select 1 from booth_bookings hb where hb.id = p.ref_id and hb.status = 'cancelled'))
  or (p.kind = 'deposit' and exists (select 1 from booking_requests hr where hr.id = p.ref_id and hr.status = 'cancelled' and hr.cancelled_by in ('artist', 'admin')))
)`;

export function earningsFor(userId: string): Earnings {
  const db = getDb();
  const env = currentEnvironment();
  const entries = db
    .prepare(
      `select p.id, p.kind, p.description, p.payee_amount_cents, p.status, p.currency, p.created_at, ${ON_HOLD_SQL} on_hold
       from payments p where p.payee_id = ? and p.environment = ? order by p.created_at desc`,
    )
    .all(userId, env) as any[];
  const payouts = db
    .prepare('select * from payouts where payee_id = ? and environment = ? order by created_at desc')
    .all(userId, env) as any[];
  const sum = (list: any[]) => list.reduce((s, e) => s + e.payee_amount_cents, 0);
  const completed = entries.filter(e => e.status === 'completed');
  const earned = sum(completed.filter(e => !e.on_hold));
  const paidOut = payouts.reduce((s, p) => s + p.amount_cents, 0);
  return {
    currency: entries[0]?.currency || payouts[0]?.currency || getSettings().currency,
    earnedCents: earned,
    paidOutCents: paidOut,
    balanceCents: earned - paidOut,
    onHoldCents: sum(completed.filter(e => e.on_hold)),
    entries: entries.map(e => ({
      id: e.id, kind: e.kind, description: e.description, amountCents: e.payee_amount_cents, status: e.status,
      onHold: e.status === 'completed' && !!e.on_hold, createdAt: e.created_at,
    })),
    payouts: payouts.map(p => ({ id: p.id, amountCents: p.amount_cents, method: p.method, note: p.note, createdAt: p.created_at })),
  };
}

/** Money still owed to a user, or upcoming paid appointments/rentals involving them — reasons not to delete them. */
export function deletionBlockers(userId: string): string[] {
  const db = getDb();
  const today = todayStr(-1);
  const reasons: string[] = [];
  const paidAppointments = (db
    .prepare("select count(*) c from booking_requests where (artist_id = @u or client_id = @u) and payment_status = 'paid' and status = 'approved' and date >= @t")
    .get({ u: userId, t: today }) as any).c;
  if (paidAppointments) reasons.push(`${paidAppointments} upcoming paid appointment${paidAppointments > 1 ? 's' : ''}`);
  const rentals = (db
    .prepare(
      `select count(*) c from booth_bookings bb join shops s on s.id = bb.shop_id
       where (bb.artist_id = @u or s.owner_id = @u) and bb.status = 'paid' and bb.end_date >= @t`,
    )
    .get({ u: userId, t: today }) as any).c;
  if (rentals) reasons.push(`${rentals} upcoming paid booth rental${rentals > 1 ? 's' : ''}`);
  const balance = earningsFor(userId).balanceCents;
  if (balance > 0) reasons.push(`${formatMoney(balance, getSettings().currency)} still owed to them`);
  return reasons;
}

/**
 * Tells every subscriber who will be renewed that the price is changing. Called when the admin changes the
 * Pro price; the new price applies from each subscriber's next renewal.
 */
export function announceProPriceChange(oldPrice: number, newPrice: number) {
  const subscribers = getDb()
    .prepare("select id, pro_until from users where subscription_tier = 'pro' and pro_auto_renew = 1 and pro_until is not null and status = 'active'")
    .all() as { id: string; pro_until: string }[];
  const currency = getSettings().currency;
  const from = formatMoney(toCents(oldPrice), currency);
  const to = formatMoney(toCents(newPrice), currency);
  for (const s of subscribers) {
    const message = `The ${getSettings().siteName} Pro price is changing from ${from} to ${to} a month. Your next renewal on ${s.pro_until.slice(0, 10)} will be charged ${to}. You can cancel any time in Settings.`;
    notify(s.id, message, { link: '/settings', email: { subject: 'Pro plan price change', lines: [message], actionLabel: 'Manage plan' } });
  }
  return subscribers.length;
}
