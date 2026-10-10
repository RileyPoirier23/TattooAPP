// Money movement: deposits, booth rentals, Pro subscriptions, refunds and the payout ledger.
// All charges go to the site owner's Square account. The ledger tracks what each artist / shop is owed.
import { getDb, newId, nowIso } from './db';
import { getSettings } from './settings';
import { conflict, formatMoney, HttpError, notFound, todayStr, toCents } from './http';
import { getUser, isPro, type UserRow } from './auth';
import {
  cardLabel, createCard, createCustomer, createPayment, disableCard, idempotencyKey, locationCurrency, paymentsReady,
  refundPayment,
} from './square';
import { notify } from './notify';
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
         payee_amount_cents, currency, square_payment_id, receipt_url, status, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
    )
    .run(id, p.kind, p.refId, p.userId, p.payerEmail, p.description, p.amountCents, p.feeCents, p.payeeId,
      p.payeeAmountCents, p.currency, p.squarePaymentId, p.receiptUrl, nowIso());
  return id;
}

export function depositFeeCents(depositCents: number, artist: Pick<UserRow, 'subscription_tier' | 'pro_until'>): number {
  if (isPro(artist)) return 0;
  return Math.round((depositCents * getSettings().depositFeePercent) / 100);
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
    const artist = getUser(r.artist_id);
    if (!artist) throw notFound('Artist not found.');
    const client = r.client_id ? getUser(r.client_id) : null;
    const payerEmail = client?.email || r.guest_email;

    const fee = depositFeeCents(r.deposit_cents, artist);
    const total = r.deposit_cents + fee;
    const currency = await locationCurrency();
    const description = `Deposit for ${r.service_name} with ${artist.name} on ${r.date}`;

    const payment = await createPayment({
      sourceId,
      amountCents: total,
      currency,
      idempotencyKey: idempotencyKey('deposit', requestId, clientKey),
      note: description,
      referenceId: requestId,
      buyerEmail: payerEmail || undefined,
    });

    const now = nowIso();
    db.transaction(() => {
      db.prepare(
        "update booking_requests set payment_status = 'paid', fee_cents = ?, deposit_paid_at = ?, updated_at = ? where id = ?",
      ).run(fee, now, now, requestId);
      insertPayment({
        kind: 'deposit', refId: requestId, userId: r.client_id, payerEmail, description,
        amountCents: total, feeCents: fee, payeeId: artist.id, payeeAmountCents: r.deposit_cents,
        currency, squarePaymentId: payment.id, receiptUrl: payment.receipt_url ?? null,
      });
    })();

    const clientName = client?.name || r.guest_name;
    notify(artist.id, `${clientName} paid their ${formatMoney(r.deposit_cents, currency)} deposit for ${r.date}.`, {
      link: '/dashboard',
      email: { subject: 'Deposit received', actionLabel: 'Open dashboard' },
    });
    if (client) {
      notify(client.id, `Your deposit for ${artist.name} is paid. You're booked for ${r.date}!`, { link: '/bookings' });
    }
    emit(r.client_id, 'bookings');
    emit(artist.id, 'bookings');
    if (payerEmail) {
      sendEmail({
        to: payerEmail,
        subject: `Deposit received — you're booked with ${artist.name}`,
        lines: [
          `Hi ${clientName},`,
          `We've received your deposit of ${formatMoney(total, currency)} for ${r.service_name} with ${artist.name} on ${r.date}.`,
          ...(payment.receipt_url ? [`Receipt: ${payment.receipt_url}`] : []),
        ],
        action: { label: 'View your booking', url: `${config.appUrl}/booking/${r.id}?token=${r.access_token}` },
      });
    }
    return { amountCents: total, receiptUrl: payment.receipt_url ?? null };
  });
}

// ---------- Booth rentals ----------

export async function payBoothBooking(bookingId: string, artist: UserRow, sourceId: string, clientKey: string) {
  ensureReady();
  return withLock(`booth:${bookingId}`, async () => {
    const db = getDb();
    const b = db
      .prepare(
        `select bb.*, s.name shop_name, s.owner_id, bo.name booth_name from booth_bookings bb
         join shops s on s.id = bb.shop_id join booths bo on bo.id = bb.booth_id where bb.id = ?`,
      )
      .get(bookingId) as any;
    if (!b || b.artist_id !== artist.id) throw notFound('Booking not found.');
    if (b.status === 'paid') throw conflict('This booth rental has already been paid.');
    if (b.status !== 'unpaid') throw conflict('This booth rental was cancelled. Please book again.');
    if (b.start_date < todayStr(-1)) throw conflict('This rental has already started. Please book new dates.');

    const currency = await locationCurrency();
    const description = `${b.booth_name} at ${b.shop_name}, ${b.start_date} to ${b.end_date}`;
    const payment = await createPayment({
      sourceId,
      amountCents: b.total_cents,
      currency,
      idempotencyKey: idempotencyKey('booth', bookingId, clientKey),
      note: `Booth rental: ${description}`,
      referenceId: bookingId,
      buyerEmail: artist.email,
    });

    const now = nowIso();
    db.transaction(() => {
      db.prepare("update booth_bookings set status = 'paid', paid_at = ? where id = ?").run(now, bookingId);
      insertPayment({
        kind: 'booth', refId: bookingId, userId: artist.id, payerEmail: artist.email, description,
        amountCents: b.total_cents, feeCents: b.fee_cents, payeeId: b.owner_id,
        payeeAmountCents: b.total_cents - b.fee_cents, currency, squarePaymentId: payment.id,
        receiptUrl: payment.receipt_url ?? null,
      });
    })();

    notify(b.owner_id, `${artist.name} paid for ${b.booth_name} (${b.start_date} → ${b.end_date}).`, {
      link: '/shop',
      email: { subject: 'Booth rental confirmed', actionLabel: 'Open shop dashboard' },
    });
    notify(artist.id, `Your guest spot at ${b.shop_name} is confirmed.`, {
      link: '/bookings',
      email: {
        subject: `Guest spot confirmed at ${b.shop_name}`,
        lines: [`Payment of ${formatMoney(b.total_cents, currency)} received for ${description}.`],
      },
    });
    emit(b.owner_id, 'bookings');
    emit(artist.id, 'bookings');
    return { amountCents: b.total_cents, receiptUrl: payment.receipt_url ?? null };
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
  db.prepare('update users set square_card_id = ?, card_label = ?, updated_at = ? where id = ?')
    .run(card.id, cardLabel(card), nowIso(), user.id);
  return { customerId, cardId: card.id };
}

async function chargeSubscription(user: UserRow, customerId: string, cardId: string, key: string) {
  const amount = toCents(getSettings().proMonthlyPrice);
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
  });
  insertPayment({
    kind: 'subscription', refId: user.id, userId: user.id, payerEmail: user.email,
    description: `Pro plan — 1 month`, amountCents: amount, feeCents: amount, payeeId: null, payeeAmountCents: 0,
    currency, squarePaymentId: payment.id, receiptUrl: payment.receipt_url ?? null,
  });
  return { amount, currency };
}

export async function subscribePro(user: UserRow, sourceId: string, clientKey: string) {
  ensureReady();
  if (!getSettings().features.proPlan) throw new HttpError(403, 'The Pro plan is not available right now.');
  return withLock(`sub:${user.id}`, async () => {
    const { customerId, cardId } = await saveCardOnFile(user, sourceId, clientKey);
    const db = getDb();
    if (isPro(user)) {
      // Already Pro: just update the card and switch auto-renew back on.
      db.prepare('update users set pro_auto_renew = 1 where id = ?').run(user.id);
      return { charged: false };
    }
    const { amount, currency } = await chargeSubscription(user, customerId, cardId, idempotencyKey('sub', user.id, clientKey));
    const until = addMonth(nowIso());
    db.prepare("update users set subscription_tier = 'pro', pro_until = ?, pro_auto_renew = 1, updated_at = ? where id = ?")
      .run(until, nowIso(), user.id);
    notify(user.id, `Welcome to Pro! Your plan renews on ${until.slice(0, 10)}.`, {
      link: '/settings',
      email: { subject: `You're on ${getSettings().siteName} Pro`, lines: [`Thanks! We charged ${formatMoney(amount, currency)}. Your plan renews automatically each month — cancel any time in Settings.`] },
    });
    return { charged: true };
  });
}

/** Charges renewals that are due and downgrades accounts whose plan has lapsed. Runs from the hourly job. */
export async function processRenewals() {
  const db = getDb();
  const due = db
    .prepare("select * from users where subscription_tier = 'pro' and pro_until is not null and pro_until <= ?")
    .all(nowIso()) as UserRow[];
  for (const user of due) {
    const canRenew = user.pro_auto_renew && user.square_card_id && user.square_customer_id && paymentsReady() && getSettings().features.proPlan;
    if (canRenew) {
      try {
        await chargeSubscription(user, user.square_customer_id!, user.square_card_id!, idempotencyKey('renew', user.id, user.pro_until!));
        const until = addMonth(user.pro_until!);
        db.prepare('update users set pro_until = ?, updated_at = ? where id = ?').run(until, nowIso(), user.id);
        notify(user.id, `Your Pro plan renewed. Next renewal: ${until.slice(0, 10)}.`, { link: '/settings' });
        continue;
      } catch (err) {
        console.warn(`[billing] renewal failed for ${user.id}:`, (err as Error).message);
        notify(user.id, 'We could not renew your Pro plan — your card was declined. Update your card in Settings to resubscribe.', {
          link: '/settings',
          email: { subject: 'Your Pro plan could not be renewed', actionLabel: 'Update card' },
        });
      }
    }
    db.prepare("update users set subscription_tier = 'free', pro_auto_renew = 0, updated_at = ? where id = ?").run(nowIso(), user.id);
    emit(user.id, 'me');
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
        db.prepare("update booking_requests set payment_status = 'refunded', updated_at = ? where id = ?").run(now, p.ref_id);
      } else if (p.kind === 'booth') {
        db.prepare("update booth_bookings set status = 'refunded' where id = ?").run(p.ref_id);
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
  });
}

// ---------- Ledger ----------

export function earningsFor(userId: string): Earnings {
  const db = getDb();
  const entries = db
    .prepare(
      `select id, kind, description, payee_amount_cents, status, currency, created_at from payments
       where payee_id = ? order by created_at desc`,
    )
    .all(userId) as any[];
  const payouts = db
    .prepare('select * from payouts where payee_id = ? order by created_at desc')
    .all(userId) as any[];
  const earned = entries.filter(e => e.status === 'completed').reduce((s, e) => s + e.payee_amount_cents, 0);
  const paidOut = payouts.reduce((s, p) => s + p.amount_cents, 0);
  return {
    currency: entries[0]?.currency || payouts[0]?.currency || getSettings().currency,
    earnedCents: earned,
    paidOutCents: paidOut,
    balanceCents: earned - paidOut,
    entries: entries.map(e => ({
      id: e.id, kind: e.kind, description: e.description, amountCents: e.payee_amount_cents, status: e.status, createdAt: e.created_at,
    })),
    payouts: payouts.map(p => ({ id: p.id, amountCents: p.amount_cents, method: p.method, note: p.note, createdAt: p.created_at })),
  };
}
