// Minimal Square API client (payments, refunds, customers, cards on file).
// Docs: https://developer.squareup.com/reference/square
import crypto from 'node:crypto';
import { config } from './config';
import { getSecrets, getSettings, saveSettings } from './settings';
import { HttpError } from './http';
import { getDb } from './db';

const SQUARE_VERSION = '2025-01-23';

export class SquareError extends HttpError {
  /** `ambiguous`: we don't know whether Square carried the request out (no answer, or a Square server error). */
  constructor(message: string, public code?: string, public ambiguous = false) {
    super(402, message);
  }
}

const UNCONFIRMED_PAYMENT =
  "We couldn't confirm whether your payment went through. Please check your bookings or email for a receipt. If you try again, you won't be charged twice.";

export function paymentsReady(): boolean {
  const s = getSettings();
  return !!(getSecrets().squareAccessToken && s.squareApplicationId && s.squareLocationId);
}

function baseUrl() {
  if (config.squareApiBase) return config.squareApiBase.replace(/\/$/, '');
  return getSettings().squareEnvironment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

const FRIENDLY: Record<string, string> = {
  CARD_DECLINED: 'Your card was declined. Please try a different card.',
  GENERIC_DECLINE: 'Your card was declined. Please try a different card.',
  CVV_FAILURE: "The card's security code (CVV) was incorrect.",
  ADDRESS_VERIFICATION_FAILURE: "The postal code didn't match the card.",
  INVALID_EXPIRATION: 'The card expiration date is invalid.',
  INSUFFICIENT_FUNDS: 'The card has insufficient funds.',
  CARD_EXPIRED: 'This card has expired.',
  INVALID_CARD: 'The card number is invalid.',
  CARD_NOT_SUPPORTED: 'This card type is not supported.',
  TRANSACTION_LIMIT: 'This payment exceeds the card limit.',
  VERIFY_CVV_FAILURE: "The card's security code (CVV) was incorrect.",
  VERIFY_AVS_FAILURE: "The postal code didn't match the card.",
  CARD_TOKEN_USED: 'This card entry was already used. Please re-enter your card.',
  CARD_TOKEN_EXPIRED: 'Your card entry expired. Please re-enter your card.',
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getSecrets().squareAccessToken;
  if (!token) throw new SquareError('Online payments are not set up yet. Please contact the site owner.');
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Square-Version': SQUARE_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      // Don't keep a visitor (and their payment lock) waiting forever if Square doesn't answer.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error('[square] network error', err);
    throw new SquareError(
      method === 'POST' && path === '/v2/payments' ? UNCONFIRMED_PAYMENT : 'Could not reach the payment processor. Please try again.',
      undefined,
      true,
    );
  }
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || json.errors?.length) {
    const e = json.errors?.[0] || {};
    console.warn(`[square] ${method} ${path} failed (${res.status}):`, JSON.stringify(json.errors || json));
    const msg = FRIENDLY[e.code] || (e.category === 'PAYMENT_METHOD_ERROR' ? e.detail : null) ||
      (res.status === 401 ? 'Payment processor credentials are invalid. Please contact the site owner.'
        : res.status >= 500 && path === '/v2/payments' ? UNCONFIRMED_PAYMENT
        : 'The payment could not be processed. Please try again.');
    throw new SquareError(msg, e.code, res.status >= 500);
  }
  return json as T;
}

/** Square idempotency keys are limited to 45 characters. */
export function idempotencyKey(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 40);
}

export interface SquarePayment {
  id: string;
  status: string;
  receipt_url?: string;
  amount_money?: { amount: number; currency: string };
  card_details?: { card?: { card_brand?: string; last_4?: string } };
}

const PENDING_TTL_MS = 24 * 3_600_000; // card tokens can't be used after a day anyway

async function sendPayment(body: Record<string, unknown>): Promise<SquarePayment> {
  const { payment } = await request<{ payment: SquarePayment }>('POST', '/v2/payments', body);
  if (payment.status !== 'COMPLETED' && payment.status !== 'APPROVED') {
    throw new SquareError('The payment was not completed. Please try again.');
  }
  return payment;
}

/**
 * Charges a card. `ref` names what is being paid for (a booking, a rental…). If an earlier charge for the same
 * thing got no clear answer from Square, that exact request is sent again first: thanks to its idempotency key
 * Square returns the original payment if it went through — so nobody is charged twice — or carries it out now.
 * Only when it definitely failed is the new card charged.
 */
export async function createPayment(input: {
  sourceId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  note: string;
  referenceId?: string;
  customerId?: string;
  buyerEmail?: string;
  ref?: string;
}): Promise<SquarePayment> {
  const db = getDb();
  if (input.ref) {
    const pending = db.prepare('select body, created_at from pending_charges where ref = ?').get(input.ref) as { body: string; created_at: string } | undefined;
    if (pending && Date.now() - new Date(pending.created_at).getTime() < PENDING_TTL_MS) {
      try {
        const payment = await sendPayment(JSON.parse(pending.body));
        db.prepare('delete from pending_charges where ref = ?').run(input.ref);
        return payment; // the earlier attempt went through
      } catch (err) {
        if (err instanceof SquareError && err.ambiguous) throw err; // still no answer: don't risk a second charge
        // It definitely didn't go through, so charge the card entered now.
      }
    }
    db.prepare('delete from pending_charges where ref = ?').run(input.ref);
  }
  const body = {
    source_id: input.sourceId,
    idempotency_key: input.idempotencyKey,
    amount_money: { amount: input.amountCents, currency: input.currency },
    location_id: getSettings().squareLocationId,
    autocomplete: true,
    note: input.note.slice(0, 500),
    reference_id: input.referenceId?.slice(0, 40),
    customer_id: input.customerId,
    buyer_email_address: input.buyerEmail,
  };
  try {
    return await sendPayment(body);
  } catch (err) {
    if (input.ref && err instanceof SquareError && err.ambiguous) {
      db.prepare('insert or replace into pending_charges (ref, body, created_at) values (?, ?, ?)').run(input.ref, JSON.stringify(body), new Date().toISOString());
    }
    throw err;
  }
}

export async function refundPayment(paymentId: string, amountCents: number, currency: string, reason: string) {
  const { refund } = await request<{ refund: { id: string; status: string } }>('POST', '/v2/refunds', {
    idempotency_key: idempotencyKey('refund', paymentId),
    payment_id: paymentId,
    amount_money: { amount: amountCents, currency },
    reason: reason.slice(0, 192),
  });
  return refund;
}

export async function createCustomer(email: string, name: string, userId: string): Promise<string> {
  const { customer } = await request<{ customer: { id: string } }>('POST', '/v2/customers', {
    idempotency_key: idempotencyKey('customer', userId),
    email_address: email,
    given_name: name.slice(0, 100),
    reference_id: userId,
  });
  return customer.id;
}

export async function createCard(sourceId: string, customerId: string, key: string) {
  const { card } = await request<{ card: { id: string; card_brand?: string; last_4?: string } }>('POST', '/v2/cards', {
    idempotency_key: key,
    source_id: sourceId,
    card: { customer_id: customerId },
  });
  return card;
}

export async function disableCard(cardId: string) {
  try {
    await request('POST', `/v2/cards/${encodeURIComponent(cardId)}/disable`);
  } catch (err) {
    console.warn('[square] could not disable card', cardId, (err as Error).message);
  }
}

/** Looks up the configured location; throws a clear error when the keys are wrong. Used by "Test connection". */
export async function checkConnection(): Promise<{ currency: string; name: string }> {
  const s = getSettings();
  // Sandbox Application IDs start with "sandbox-"; Production ones don't. A mix-up only shows when someone tries to pay.
  const sandboxId = s.squareApplicationId.startsWith('sandbox-');
  if (s.squareEnvironment === 'production' && sandboxId) {
    throw new HttpError(400, 'That Application ID is a Sandbox (test) one, but the environment is set to Production. Paste the Production Application ID, access token and Location ID.');
  }
  if (s.squareEnvironment === 'sandbox' && !sandboxId) {
    throw new HttpError(400, 'That Application ID is a Production one, but the environment is set to Sandbox. Either switch the environment to Production or paste the Sandbox Application ID (it starts with "sandbox-").');
  }
  try {
    const { location } = await request<{ location: { currency?: string; name?: string; status?: string } }>(
      'GET',
      `/v2/locations/${encodeURIComponent(s.squareLocationId)}`,
    );
    const currency = location?.currency || s.currency;
    currencyCache = { key: `${s.squareEnvironment}:${s.squareLocationId}`, currency };
    if (s.currency !== currency) saveSettings({ currency });
    return { currency, name: location?.name || s.squareLocationId };
  } catch (err) {
    const code = (err as SquareError).code;
    throw new HttpError(
      400,
      code === 'UNAUTHORIZED' || /credentials are invalid/.test((err as Error).message)
        ? `Square rejected the access token. Check that it's the ${s.squareEnvironment} token for the same app as the Application ID.`
        : code === 'NOT_FOUND'
          ? `Square couldn't find location "${s.squareLocationId}" in ${s.squareEnvironment}. Copy the Location ID from the Locations page of the same environment.`
          : `Square connection failed: ${(err as Error).message}`,
    );
  }
}

let currencyCache: { key: string; currency: string } | null = null;

/** Square charges must be in the currency of the location; look it up once and cache it. */
export async function locationCurrency(): Promise<string> {
  const s = getSettings();
  const key = `${s.squareEnvironment}:${s.squareLocationId}`;
  if (currencyCache?.key === key) {
    // Someone may have changed the displayed currency since; prices must show what Square will charge.
    if (s.currency !== currencyCache.currency) saveSettings({ currency: currencyCache.currency });
    return currencyCache.currency;
  }
  try {
    const { location } = await request<{ location: { currency?: string } }>(
      'GET',
      `/v2/locations/${encodeURIComponent(s.squareLocationId)}`,
    );
    if (location?.currency) {
      currencyCache = { key, currency: location.currency };
      // Keep the displayed currency in sync with what Square actually charges.
      if (s.currency !== location.currency) saveSettings({ currency: location.currency });
      return location.currency;
    }
  } catch (err) {
    console.warn('[square] could not read location currency; using settings currency', (err as Error).message);
  }
  return s.currency;
}

export function cardLabel(card?: { card_brand?: string; last_4?: string }): string | null {
  if (!card?.last_4) return null;
  const brand = (card.card_brand || 'Card').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return `${brand} •••• ${card.last_4}`;
}
