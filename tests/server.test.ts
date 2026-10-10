// End-to-end API tests: real server + temporary database + a fake Square API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

// ---------- Fake Square ----------
const squareCalls: { path: string; body: any }[] = [];
const seenKeys = new Map<string, any>();
const square = http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => (raw += c));
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {};
    squareCalls.push({ path: req.url!, body });
    const send = (status: number, json: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
    };
    if (req.headers.authorization !== 'Bearer test-token') return send(401, { errors: [{ code: 'UNAUTHORIZED' }] });
    if (req.url?.startsWith('/v2/locations/')) return send(200, { location: { id: 'L1', currency: 'CAD' } });
    if (req.url === '/v2/payments') {
      if (seenKeys.has(body.idempotency_key)) return send(200, { payment: seenKeys.get(body.idempotency_key) });
      if (body.source_id === 'cnon:card-nonce-declined') {
        return send(402, { errors: [{ code: 'CARD_DECLINED', category: 'PAYMENT_METHOD_ERROR', detail: 'Declined' }] });
      }
      const payment = { id: `pay_${squareCalls.length}`, status: 'COMPLETED', receipt_url: 'https://squareup.com/receipt/x' };
      seenKeys.set(body.idempotency_key, payment);
      return send(200, { payment });
    }
    if (req.url === '/v2/refunds') return send(200, { refund: { id: 'ref_1', status: 'PENDING' } });
    if (req.url === '/v2/customers') return send(200, { customer: { id: 'cust_1' } });
    if (req.url === '/v2/cards') return send(200, { card: { id: `card_${squareCalls.length}`, card_brand: 'VISA', last_4: '1111' } });
    if (req.url?.match(/^\/v2\/cards\/.+\/disable$/)) return send(200, { card: { enabled: false } });
    send(404, { errors: [{ code: 'NOT_FOUND' }] });
  });
});

let base = '';
let server: http.Server;
let tmp: string;

before(async () => {
  await new Promise<void>(r => square.listen(0, r));
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inkspace-test-'));
  process.env.DATA_DIR = tmp;
  process.env.SQUARE_API_BASE = `http://127.0.0.1:${(square.address() as AddressInfo).port}`;
  process.env.SQUARE_ACCESS_TOKEN = 'test-token';
  process.env.SQUARE_APPLICATION_ID = 'sandbox-app';
  process.env.SQUARE_LOCATION_ID = 'L1';
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_PASSWORD = 'admin-password';
  process.env.DISABLE_JOBS = 'true';
  const { seedDefaults } = await import('../server/settings');
  const { ensureAdminFromEnv } = await import('../server/auth');
  const { createApp } = await import('../server/app');
  seedDefaults();
  await ensureAdminFromEnv();
  server = createApp().listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
  square.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------- Tiny HTTP client with a cookie jar ----------
class Client {
  cookie = '';
  async req(method: string, url: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    const headers: Record<string, string> = {};
    if (opts.csrf !== false) headers['X-Requested-With'] = 'inkspace';
    if (this.cookie) headers.cookie = this.cookie;
    let payload: any;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }
  get = (u: string) => this.req('GET', u);
  post = (u: string, b?: unknown) => this.req('POST', u, b ?? {});
  patch = (u: string, b: unknown) => this.req('PATCH', u, b);
  put = (u: string, b?: unknown) => this.req('PUT', u, b ?? {});
}

function futureDate(days: number, weekday?: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  if (weekday !== undefined) while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1f3d6a00000000049454e44ae426082', 'hex');

async function register(role: string, email: string, extra: Record<string, unknown> = {}) {
  const c = new Client();
  const r = await c.post('/api/auth/register', { email, password: 'password123', name: email.split('@')[0], role, city: 'Moncton', acceptTerms: true, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { c, me: r.body.user };
}

// ---------- Shared state across tests ----------
let artist: Client, artistId: string, client: Client, admin: Client;
let serviceId: string;
const workday = futureDate(3, 2); // a Tuesday at least 3 days out

test('security basics', async () => {
  const c = new Client();
  // Missing CSRF header is rejected.
  const noCsrf = await c.req('POST', '/api/auth/login', { email: 'a@b.co', password: 'x' }, { csrf: false });
  assert.equal(noCsrf.status, 403);
  // Can't register as admin.
  const r = await c.post('/api/auth/register', { email: 'evil@example.com', password: 'password123', name: 'Evil', role: 'admin' });
  assert.equal(r.status, 400);
  // Admin API requires an admin.
  assert.equal((await c.get('/api/admin/stats')).status, 401);
  // Old hard-coded backdoor is gone.
  assert.equal((await c.post('/api/auth/login', { email: '__admin__', password: 'root' })).status, 400);
});

test('artist sets up profile, services and hours', async () => {
  ({ c: artist, me: { id: artistId } } = await register('artist', 'artist@example.com'));
  const r = await artist.patch('/api/me', {
    specialty: 'Fine Line',
    bio: 'Hello',
    services: [{ name: 'Small piece', duration: 2, price: 200, deposit: 60 }],
    hours: { '2': [{ start: '10:00', end: '18:00' }] },
    // Unknown/privileged fields are ignored.
    role: 'admin',
    isVerified: true,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.role, 'artist');
  assert.equal(r.body.user.isVerified, false);
  serviceId = r.body.user.services[0].id;
  assert.ok(serviceId);

  const form = new FormData();
  form.append('images', new Blob([PNG], { type: 'image/png' }), 'a.png');
  const up = await artist.req('POST', '/api/me/portfolio', form);
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.user.portfolio.length, 1);

  const bad = new FormData();
  bad.append('images', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
  assert.equal((await artist.req('POST', '/api/me/portfolio', bad)).status, 400);

  const list = await new Client().get('/api/artists');
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].email, undefined, 'emails must not be public');
});

function bookingForm(data: Record<string, unknown>) {
  const f = new FormData();
  f.append('data', JSON.stringify({ acceptTerms: true, ...data }));
  return f;
}

test('client booking → approve → pay deposit', async () => {
  ({ c: client } = await register('client', 'client@example.com'));
  // Closed day is rejected.
  const closed = await client.req('POST', '/api/booking-requests', bookingForm({ artistId, serviceId, date: futureDate(3, 3), message: 'A small rose on my wrist please', tattooWidth: 2, tattooHeight: 2, bodyPlacement: 'Forearm' }));
  assert.equal(closed.status, 400);
  // Missing required size is rejected.
  const noSize = await client.req('POST', '/api/booking-requests', bookingForm({ artistId, serviceId, date: workday, message: 'A small rose on my wrist please', bodyPlacement: 'Forearm' }));
  assert.equal(noSize.status, 400);

  const form = bookingForm({ artistId, serviceId, date: workday, message: 'A small rose on my wrist please', tattooWidth: 2, tattooHeight: 2, bodyPlacement: 'Forearm' });
  form.append('images', new Blob([PNG], { type: 'image/png' }), 'ref.png');
  const created = await client.req('POST', '/api/booking-requests', form);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const req = created.body.request;
  assert.equal(req.depositCents, 6000);
  assert.equal(req.referenceImages.length, 1);

  // Can't pay before approval.
  assert.equal((await client.post(`/api/booking-requests/${req.id}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'key-00000001' })).status, 409);
  // Client can't approve their own request.
  assert.equal((await client.post(`/api/booking-requests/${req.id}/action`, { action: 'approve' })).status, 403);
  // Someone unrelated can't even see it.
  const stranger = (await register('client', 'stranger@example.com')).c;
  assert.equal((await stranger.get(`/api/booking-requests/${req.id}`)).status, 404);

  const approved = await artist.post(`/api/booking-requests/${req.id}/action`, { action: 'approve' });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.status, 'approved');

  const declined = await client.post(`/api/booking-requests/${req.id}/pay`, { sourceId: 'cnon:card-nonce-declined', idempotencyKey: 'key-00000002' });
  assert.equal(declined.status, 402);
  assert.match(declined.body.error, /declined/i);

  const paid = await client.post(`/api/booking-requests/${req.id}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'key-00000003' });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  // 60.00 deposit + 2.9% fee = 61.74
  assert.equal(paid.body.amountCents, 6174);
  const charge = squareCalls.filter(c => c.path === '/v2/payments').at(-1)!;
  assert.equal(charge.body.amount_money.amount, 6174);
  assert.equal(charge.body.amount_money.currency, 'CAD');

  // Paying twice is rejected.
  assert.equal((await client.post(`/api/booking-requests/${req.id}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'key-00000004' })).status, 409);

  const mine = await client.get('/api/bookings');
  assert.equal(mine.body.asClient[0].paymentStatus, 'paid');

  const earnings = await artist.get('/api/me/earnings');
  assert.equal(earnings.body.balanceCents, 6000);
});

test('guest booking with private link', async () => {
  const guest = new Client();
  const created = await guest.req(
    'POST',
    '/api/booking-requests',
    bookingForm({ artistId, date: workday, message: 'Guest idea for a tattoo', tattooWidth: 3, tattooHeight: 3, bodyPlacement: 'Calf', guestName: 'Gina Guest', guestEmail: 'gina@example.com' }),
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { id, accessToken } = created.body.request;
  assert.ok(accessToken);
  assert.equal(created.body.request.depositCents, 5000); // default deposit when no service chosen

  assert.equal((await guest.get(`/api/booking-requests/${id}`)).status, 404);
  assert.equal((await guest.get(`/api/booking-requests/${id}?token=wrong`)).status, 404);
  const view = await guest.get(`/api/booking-requests/${id}?token=${accessToken}`);
  assert.equal(view.status, 200);
  assert.equal(view.body.request.clientName, 'Gina Guest');

  await artist.post(`/api/booking-requests/${id}/action`, { action: 'approve' });
  const paid = await guest.post(`/api/booking-requests/${id}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'guest-key-0001', token: accessToken });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
});

let shopOwner: Client, boothBookingId: string;

test('shop owner lists a booth; artist rents it', async () => {
  ({ c: shopOwner } = await register('shop-owner', 'owner@example.com'));
  const shop = await shopOwner.post('/api/shops', { name: 'Ink & Dagger', city: 'Halifax', address: '1 Main St', amenities: ['WiFi'] });
  assert.equal(shop.status, 201, JSON.stringify(shop.body));
  const withBooth = await shopOwner.post(`/api/shops/${shop.body.id}/booths`, { name: 'Front booth', dailyRate: 80 });
  assert.equal(withBooth.status, 201);
  const boothId = withBooth.body.booths[0].id;

  // Other users can't edit the shop.
  assert.equal((await artist.patch(`/api/shops/${shop.body.id}`, { name: 'Hacked' })).status, 403);

  const start = futureDate(10);
  const end = futureDate(12);
  const bad = await artist.post('/api/booth-bookings', { boothId, startDate: end, endDate: start });
  assert.equal(bad.status, 400);

  const booked = await artist.post('/api/booth-bookings', { boothId, startDate: start, endDate: end });
  assert.equal(booked.status, 201, JSON.stringify(booked.body));
  assert.equal(booked.body.totalCents, 24000);
  assert.equal(booked.body.feeCents, 2400);
  boothBookingId = booked.body.id;

  const other = (await register('artist', 'artist2@example.com')).c;
  const overlap = await other.post('/api/booth-bookings', { boothId, startDate: futureDate(11), endDate: futureDate(14) });
  assert.equal(overlap.status, 409);

  const paid = await artist.post(`/api/booth-bookings/${boothBookingId}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'booth-key-0001' });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  const ownerEarnings = await shopOwner.get('/api/me/earnings');
  assert.equal(ownerEarnings.body.balanceCents, 21600);

  const detail = await new Client().get(`/api/shops/${shop.body.id}`);
  assert.equal(detail.body.bookedRanges.length, 1);
});

test('pro plan subscription removes the deposit fee', async () => {
  // The Pro plan ships switched off; subscribing is refused until the owner turns it on.
  assert.equal((await artist.post('/api/me/subscription', { sourceId: 'cnon:ok', idempotencyKey: 'sub-key-off1' })).status, 403);
  const { saveSettings } = await import('../server/settings');
  saveSettings({ features: { proPlan: true } } as any);
  const sub = await artist.post('/api/me/subscription', { sourceId: 'cnon:ok', idempotencyKey: 'sub-key-0001' });
  assert.equal(sub.status, 200, JSON.stringify(sub.body));
  assert.equal(sub.body.user.subscription.isPro, true);
  assert.equal(sub.body.user.subscription.cardLabel, 'Visa •••• 1111');

  const created = await client.req('POST', '/api/booking-requests', bookingForm({ artistId, serviceId, date: workday, message: 'Another tattoo idea here', tattooWidth: 1, tattooHeight: 1, bodyPlacement: 'Hand' }));
  await artist.post(`/api/booking-requests/${created.body.request.id}/action`, { action: 'approve' });
  const paid = await client.post(`/api/booking-requests/${created.body.request.id}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'key-pro-0001' });
  assert.equal(paid.body.amountCents, 6000);

  // Renewal job charges the saved card and extends the plan.
  const { getDb } = await import('../server/db');
  const { processRenewals } = await import('../server/billing');
  getDb().prepare('update users set pro_until = ? where id = ?').run(new Date(Date.now() - 1000).toISOString(), artistId);
  const before = squareCalls.length;
  await processRenewals();
  const renewal = squareCalls.slice(before).find(c => c.path === '/v2/payments');
  assert.ok(renewal, 'renewal charge was made');
  assert.equal(renewal!.body.source_id.startsWith('card_'), true);
  const me = await artist.get('/api/auth/me');
  assert.equal(me.body.user.subscription.isPro, true);

  const cancel = await artist.post('/api/me/subscription/cancel');
  assert.equal(cancel.body.user.subscription.autoRenew, false);
});

test('admin manages settings, refunds and payouts', async () => {
  admin = new Client();
  const login = await admin.post('/api/auth/login', { email: 'admin@example.com', password: 'admin-password' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'admin');
  assert.equal((await artist.get('/api/admin/stats')).status, 403);

  const stats = await admin.get('/api/admin/stats');
  assert.equal(stats.status, 200);
  assert.ok(stats.body.grossCents > 0);

  const saved = await admin.put('/api/admin/settings', {
    settings: { siteName: 'Moncton Ink', primaryColor: '#112233', features: { proPlan: false } },
    secrets: { smtpHost: 'smtp.example.com', smtpPass: 'secret' },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.secrets.smtpPassSet, true);
  assert.equal(saved.body.secrets.smtpPass, undefined, 'secrets are never returned');
  const cfg = await new Client().get('/api/config');
  assert.equal(cfg.body.settings.siteName, 'Moncton Ink');
  assert.equal(cfg.body.settings.features.proPlan, false);
  assert.equal(cfg.body.settings.features.boothRental, true);
  assert.equal(JSON.stringify(cfg.body).includes('secret'), false);

  const page = await new Client().get('/api/pages/faq');
  assert.equal(page.status, 200);

  const payments = await admin.get('/api/admin/payments');
  assert.equal(payments.body.total, payments.body.items.length);
  assert.ok(payments.body.totals.grossCents > 0);
  const booth = payments.body.items.find((p: any) => p.kind === 'booth');
  const refunded = await admin.post(`/api/admin/payments/${booth.id}/refund`, { reason: 'Shop closed' });
  assert.equal(refunded.status, 200, JSON.stringify(refunded.body));
  const ownerEarnings = await shopOwner.get('/api/me/earnings');
  assert.equal(ownerEarnings.body.balanceCents, 0);

  const balances = await admin.get('/api/admin/payouts');
  const artistBal = balances.body.find((b: any) => b.payee.id === artistId);
  assert.equal(artistBal.balanceCents, 17000);
  const payout = await admin.post('/api/admin/payouts', { payeeId: artistId, amount: 100, method: 'e-Transfer' });
  assert.equal(payout.status, 201);
  assert.equal((await artist.get('/api/me/earnings')).body.balanceCents, 7000);

  // Suspending a user logs them out.
  const users = await admin.get('/api/admin/users?q=stranger');
  await admin.patch(`/api/admin/users/${users.body.items[0].id}`, { status: 'suspended' });
  const backup = await admin.get('/api/admin/backup');
  assert.equal(backup.status, 200);
});

test('password reset flow', async () => {
  const { getDb } = await import('../server/db');
  const before = (getDb().prepare('select count(*) c from password_resets').get() as any).c;
  await new Client().post('/api/auth/forgot', { email: 'client@example.com' });
  assert.equal((getDb().prepare('select count(*) c from password_resets').get() as any).c, before + 1);
  const r = await admin.post(`/api/admin/users/${(await admin.get('/api/admin/users?q=client@')).body.items[0].id}/reset-link`);
  const token = new URL(r.body.link).searchParams.get('token');
  const reset = await new Client().post('/api/auth/reset', { token, password: 'newpassword1' });
  assert.equal(reset.status, 200);
  assert.equal((await new Client().post('/api/auth/reset', { token, password: 'again12345' })).status, 400);
  assert.equal((await new Client().post('/api/auth/login', { email: 'client@example.com', password: 'newpassword1' })).status, 200);
});

test('messaging between client and artist', async () => {
  const c = new Client();
  await c.post('/api/auth/login', { email: 'client@example.com', password: 'newpassword1' });
  const convo = await c.post('/api/conversations', { userId: artistId });
  assert.equal(convo.status, 200);
  const sent = await c.post(`/api/conversations/${convo.body.id}/messages`, { content: 'Hi there!' });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const list = await artist.get('/api/conversations');
  assert.equal(list.body[0].unreadCount, 1);
  const msgs = await artist.get(`/api/conversations/${convo.body.id}/messages`);
  assert.equal(msgs.body[0].content, 'Hi there!');
  assert.equal((await artist.get('/api/conversations')).body[0].unreadCount, 0);
  const outsider = (await register('client', 'outsider@example.com')).c;
  assert.equal((await outsider.get(`/api/conversations/${convo.body.id}/messages`)).status, 404);
});

test('completed booking can be reviewed and shows on the public profile', async () => {
  const c = new Client();
  await c.post('/api/auth/login', { email: 'client@example.com', password: 'newpassword1' });
  const created = await c.req('POST', '/api/booking-requests', bookingForm({ artistId, serviceId, date: workday, message: 'One more tattoo idea please', tattooWidth: 1, tattooHeight: 1, bodyPlacement: 'Hand' }));
  const id = created.body.request.id;
  await artist.post(`/api/booking-requests/${id}/action`, { action: 'approve', depositAmount: 0 });
  // Can't complete a future appointment…
  assert.equal((await artist.post(`/api/booking-requests/${id}/action`, { action: 'complete' })).status, 409);
  // …but can once the day arrives.
  const { getDb } = await import('../server/db');
  getDb().prepare('update booking_requests set date = ? where id = ?').run(futureDate(0), id);
  assert.equal((await artist.post(`/api/booking-requests/${id}/action`, { action: 'complete' })).status, 200);
  // Only the client can review, once.
  assert.equal((await artist.post(`/api/booking-requests/${id}/review`, { rating: 5 })).status, 403);
  assert.equal((await c.post(`/api/booking-requests/${id}/review`, { rating: 4, text: 'Great work' })).status, 200);
  assert.equal((await c.post(`/api/booking-requests/${id}/review`, { rating: 1 })).status, 409);
  const pub = await new Client().get(`/api/artists/${artistId}`);
  assert.equal(pub.body.reviewCount, 1);
  assert.equal(pub.body.averageRating, 4);
  assert.equal(pub.body.reviews[0].text, 'Great work');
  // Admin can hide it.
  await admin.patch(`/api/admin/reviews/artist/${id}`, { hidden: true });
  assert.equal((await new Client().get(`/api/artists/${artistId}`)).body.reviewCount, 0);
});

test('money safety: expired holds, renewals, card updates, deletion guards', async () => {
  const { getDb } = await import('../server/db');
  const { processRenewals } = await import('../server/billing');
  const db = getDb();
  await admin.put('/api/admin/settings', { settings: { features: { proPlan: true } } });

  // An expired booth hold can't be paid once someone else has taken the dates.
  const owner = (await register('shop-owner', 'owner2@example.com')).c;
  const shop = await owner.post('/api/shops', { name: 'Second Shop', city: 'Moncton', address: '2 Main St' });
  const withBooth = await owner.post(`/api/shops/${shop.body.id}/booths`, { name: 'Corner', dailyRate: 50 });
  const boothId = withBooth.body.booths[0].id;
  const a1 = (await register('artist', 'hold1@example.com')).c;
  const a2 = (await register('artist', 'hold2@example.com')).c;
  const first = await a1.post('/api/booth-bookings', { boothId, startDate: futureDate(30), endDate: futureDate(31) });
  db.prepare("update booth_bookings set created_at = '2000-01-01T00:00:00.000Z' where id = ?").run(first.body.id);
  const second = await a2.post('/api/booth-bookings', { boothId, startDate: futureDate(31), endDate: futureDate(32) });
  assert.equal(second.status, 201, 'expired hold no longer blocks the dates');
  assert.equal((await a2.post(`/api/booth-bookings/${second.body.id}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'hold-key-0002' })).status, 200);
  const late = await a1.post(`/api/booth-bookings/${first.body.id}/pay`, { sourceId: 'cnon:ok', idempotencyKey: 'hold-key-0001' });
  assert.equal(late.status, 409, 'the expired hold cannot be paid any more');

  // Owners can block dates; blocked dates can't be reserved.
  assert.equal((await owner.post(`/api/booths/${boothId}/blocks`, { startDate: futureDate(40), endDate: futureDate(42) })).status, 201);
  assert.equal((await a1.post('/api/booth-bookings', { boothId, startDate: futureDate(41), endDate: futureDate(41) })).status, 409);

  // Unpaid hold limit.
  for (let i = 0; i < 3; i++) await a1.post('/api/booth-bookings', { boothId, startDate: futureDate(50 + i * 2), endDate: futureDate(50 + i * 2) });
  assert.equal((await a1.post('/api/booth-bookings', { boothId, startDate: futureDate(60), endDate: futureDate(60) })).status, 409);

  // A failed renewal keeps Pro during a grace period instead of cancelling straight away.
  const pro = await register('artist', 'renew@example.com');
  await pro.c.post('/api/me/subscription', { sourceId: 'cnon:ok', idempotencyKey: 'renew-sub-0001' });
  db.prepare("update users set square_card_id = 'card_declines', pro_until = ? where id = ?").run(new Date(Date.now() - 1000).toISOString(), pro.me.id);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => {
    if (String(url).endsWith('/v2/payments') && JSON.parse(init.body).source_id === 'card_declines') {
      return new Response(JSON.stringify({ errors: [{ code: 'CARD_DECLINED', category: 'PAYMENT_METHOD_ERROR' }] }), { status: 402 });
    }
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    await processRenewals();
  } finally {
    globalThis.fetch = realFetch;
  }
  let row = db.prepare('select subscription_tier, renewal_failed_at from users where id = ?').get(pro.me.id) as any;
  assert.equal(row.subscription_tier, 'pro', 'still Pro during the grace period');
  assert.ok(row.renewal_failed_at);
  // After the grace period it ends.
  db.prepare("update users set pro_until = ?, renewal_failed_at = '2000-01-01T00:00:00.000Z' where id = ?").run(new Date(Date.now() - 4 * 86_400_000).toISOString(), pro.me.id);
  globalThis.fetch = (async (url: any, init: any) => {
    if (String(url).endsWith('/v2/payments')) return new Response(JSON.stringify({ errors: [{ code: 'CARD_DECLINED' }] }), { status: 402 });
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    await processRenewals();
  } finally {
    globalThis.fetch = realFetch;
  }
  row = db.prepare('select subscription_tier from users where id = ?').get(pro.me.id) as any;
  assert.equal(row.subscription_tier, 'free');

  // Updating the card on a cancelled plan does not turn renewals back on.
  const p2 = await register('artist', 'card@example.com');
  await p2.c.post('/api/me/subscription', { sourceId: 'cnon:ok', idempotencyKey: 'card-sub-0001' });
  await p2.c.post('/api/me/subscription/cancel');
  const updated = await p2.c.post('/api/me/card', { sourceId: 'cnon:ok', idempotencyKey: 'card-upd-0001' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.subscription.autoRenew, false);

  // Suspended subscribers are not charged.
  await admin.patch(`/api/admin/users/${p2.me.id}`, { status: 'suspended' });
  db.prepare('update users set pro_auto_renew = 1, pro_until = ? where id = ?').run(new Date(Date.now() - 1000).toISOString(), p2.me.id);
  const before = squareCalls.length;
  await processRenewals();
  assert.equal(squareCalls.slice(before).filter(c => c.path === '/v2/payments').length, 0);

  // Subscribers pay the listed price: a price rise is announced and charged at their next renewal.
  const p3 = await register('artist', 'price@example.com');
  await p3.c.post('/api/me/subscription', { sourceId: 'cnon:ok', idempotencyKey: 'price-sub-0001' });
  const firstCharge = squareCalls.filter(c => c.path === '/v2/payments').at(-1)!;
  assert.equal(firstCharge.body.amount_money.amount, 1900);
  await admin.put('/api/admin/settings', { settings: { proMonthlyPrice: 25 } });
  const notice = db.prepare('select message from notifications where user_id = ? order by created_at desc limit 1').get(p3.me.id) as any;
  assert.match(notice.message, /next renewal/i);
  db.prepare('update users set pro_until = ? where id = ?').run(new Date(Date.now() - 1000).toISOString(), p3.me.id);
  const mark = squareCalls.length;
  await processRenewals();
  const renewed = squareCalls.slice(mark).filter(c => c.path === '/v2/payments');
  assert.equal(renewed.length, 1);
  assert.equal(renewed[0].body.amount_money.amount, 2500);
  await admin.put('/api/admin/settings', { settings: { proMonthlyPrice: 19 } });

  // Admin can't delete someone who is still owed money.
  const owed = (await admin.get('/api/admin/payouts')).body.find((b: any) => b.balanceCents > 0);
  assert.equal((await admin.req('DELETE', `/api/admin/users/${owed.payee.id}`)).status, 409);
});

test('guest can claim a booking into an account; terms are required', async () => {
  const guest = new Client();
  const noTerms = new FormData();
  noTerms.append('data', JSON.stringify({ artistId, date: workday, message: 'Terms test idea here', tattooWidth: 1, tattooHeight: 1, bodyPlacement: 'Hand', guestName: 'T', guestEmail: 't@example.com' }));
  assert.equal((await guest.req('POST', '/api/booking-requests', noTerms)).status, 400);
  const made = await guest.req('POST', '/api/booking-requests', bookingForm({ artistId, date: workday, message: 'Claim test idea here', tattooWidth: 1, tattooHeight: 1, bodyPlacement: 'Hand', guestName: 'Clara', guestEmail: 'clara@example.com' }));
  const { id, accessToken } = made.body.request;
  const clara = (await register('client', 'clara@example.com')).c;
  assert.equal((await clara.post(`/api/booking-requests/${id}/claim`, { token: 'wrong' })).status, 404);
  assert.equal((await clara.post(`/api/booking-requests/${id}/claim`, { token: accessToken })).status, 200);
  const mine = await clara.get('/api/bookings');
  assert.equal(mine.body.asClient.some((r: any) => r.id === id), true);
  // Approving sets an exact appointment time.
  const ok = await artist.post(`/api/booking-requests/${id}/action`, { action: 'approve', time: '13:30' });
  assert.equal(ok.body.appointmentTime, '13:30');
});

test('square connection check reports bad keys', async () => {
  const { saveSecrets } = await import('../server/settings');
  saveSecrets({ squareAccessToken: '' });
  const prev = process.env.SQUARE_ACCESS_TOKEN;
  const { config } = await import('../server/config');
  (config as any).squareAccessToken = 'wrong-token';
  try {
    const r = await admin.post('/api/admin/square-check');
    assert.equal(r.status, 400);
    assert.match(r.body.error, /access token/i);
  } finally {
    (config as any).squareAccessToken = prev;
  }
});

test('contact form, admin inbox and paged admin lists', async () => {
  const visitor = new Client();
  assert.equal((await visitor.post('/api/contact', { name: 'Vera', email: 'vera@example.com', message: 'Short' })).status, 400);
  const bot = await visitor.post('/api/contact', { name: 'Bot', email: 'bot@example.com', message: 'Cheap followers for sale today', website: 'http://spam.example' });
  assert.equal(bot.status, 400, 'the hidden honeypot field catches bots');
  const sent = await visitor.post('/api/contact', { name: 'Vera', email: 'vera@example.com', message: 'Do you have artists in Halifax?' });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal((await artist.get('/api/admin/contact-messages')).status, 403);
  const inbox = await admin.get('/api/admin/contact-messages');
  assert.equal(inbox.body.total, 1);
  assert.equal(inbox.body.items[0].email, 'vera@example.com');
  assert.equal((await admin.get('/api/admin/stats')).body.newContactMessages, 1);
  await admin.patch(`/api/admin/contact-messages/${inbox.body.items[0].id}`, { status: 'replied' });
  assert.equal((await admin.get('/api/admin/stats')).body.newContactMessages, 0);

  // Lists are paged and searchable; LIKE wildcards are matched literally.
  const page1 = await admin.get('/api/admin/users?pageSize=2&page=1');
  const page2 = await admin.get('/api/admin/users?pageSize=2&page=2');
  assert.equal(page1.body.items.length, 2);
  assert.ok(page1.body.total > 4);
  assert.notEqual(page1.body.items[0].id, page2.body.items[0].id);
  assert.equal((await admin.get('/api/admin/users?q=%25')).body.total, 0);
  const gina = await admin.get('/api/admin/booking-requests?q=gina');
  assert.ok(gina.body.total >= 1);
  assert.ok(gina.body.items.every((r: any) => /gina/i.test(r.clientName)));
  const rentals = await admin.get('/api/admin/booth-bookings?status=refunded');
  assert.ok(rentals.body.items.length >= 1);
  assert.ok(rentals.body.items.every((b: any) => b.status === 'refunded'));
});

test('privacy: data export, terms records and photo metadata', async () => {
  const c = new Client();
  assert.equal((await c.post('/api/auth/login', { email: 'client@example.com', password: 'newpassword1' })).status, 200);
  const exp = await c.get('/api/me/export');
  assert.equal(exp.status, 200);
  assert.equal(exp.body.account.email, 'client@example.com');
  assert.ok(exp.body.account.termsAcceptedAt, 'sign-up records when the terms were accepted');
  assert.ok(exp.body.bookingsYouMade.length >= 1);
  assert.ok(exp.body.messages[0].messages.length >= 1);
  assert.equal(JSON.stringify(exp.body).includes('scrypt$'), false, 'no password hashes');
  assert.equal(JSON.stringify(exp.body).includes('accessToken'), false);
  const { getDb } = await import('../server/db');
  const terms = getDb().prepare('select count(*) c from booking_requests where terms_accepted_at is null').get() as any;
  assert.equal(terms.c, 0, 'every booking records the 18+/policy confirmation');

  // Hidden camera data (e.g. GPS location) is removed from uploaded JPEGs; the orientation is kept.
  const tiff = Buffer.alloc(48);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(2, 8);
  tiff.writeUInt16BE(0x010f, 10); // Make
  tiff.writeUInt16BE(2, 12);
  tiff.writeUInt32BE(10, 14);
  tiff.writeUInt32BE(38, 18);
  tiff.writeUInt16BE(0x0112, 22); // Orientation = 6
  tiff.writeUInt16BE(3, 24);
  tiff.writeUInt32BE(1, 26);
  tiff.writeUInt16BE(6, 30);
  tiff.write('SECRETCAM\0', 38, 'latin1');
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const seg = (marker: number, payload: Buffer) => {
    const head = Buffer.from([0xff, marker, 0, 0]);
    head.writeUInt16BE(payload.length + 2, 2);
    return Buffer.concat([head, payload]);
  };
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    seg(0xe1, exif),
    seg(0xfe, Buffer.from('SECRETNOTE')),
    seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from('imagedata'),
    Buffer.from([0xff, 0xd9]),
  ]);
  const form = new FormData();
  form.append('images', new Blob([jpeg], { type: 'image/jpeg' }), 'photo.jpg');
  const up = await artist.req('POST', '/api/me/portfolio', form);
  assert.equal(up.status, 200, JSON.stringify(up.body));
  const url: string = up.body.user.portfolio[0].url; // newest first
  const saved = fs.readFileSync(path.join(tmp, 'uploads', url.slice('/uploads/'.length)));
  assert.equal(saved.includes('SECRETCAM'), false);
  assert.equal(saved.includes('SECRETNOTE'), false);
  assert.equal(saved.includes(Buffer.from([0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06])), true, 'orientation kept');
  assert.equal(saved.includes('imagedata'), true);
});

test('abuse protection: login lockout and booking spam limits', async () => {
  await register('client', 'locked@example.com');
  for (let i = 0; i < 8; i++) {
    assert.equal((await new Client().post('/api/auth/login', { email: 'locked@example.com', password: 'wrong-password' })).status, 401);
  }
  const locked = await new Client().post('/api/auth/login', { email: 'locked@example.com', password: 'password123' });
  assert.equal(locked.status, 429, 'even the right password waits once the account is locked');

  const g = new Client();
  const guestForm = (extra: Record<string, unknown> = {}) =>
    bookingForm({ artistId, date: workday, message: 'Spam check idea here', tattooWidth: 1, tattooHeight: 1, bodyPlacement: 'Hand', guestName: 'Sam', guestEmail: 'sam@example.com', ...extra });
  assert.equal((await g.req('POST', '/api/booking-requests', guestForm({ website: 'http://spam.example' }))).status, 400);
  assert.equal((await g.req('POST', '/api/booking-requests', guestForm({ guestName: 'Visit www.spam.example' }))).status, 400);
  for (let i = 0; i < 3; i++) assert.equal((await g.req('POST', '/api/booking-requests', guestForm())).status, 201);
  assert.equal((await g.req('POST', '/api/booking-requests', guestForm())).status, 429, 'at most 3 guest requests per email per day');

  const eager = (await register('client', 'eager@example.com')).c;
  const form = () => bookingForm({ artistId, date: workday, message: 'Pending cap idea', tattooWidth: 1, tattooHeight: 1, bodyPlacement: 'Hand' });
  for (let i = 0; i < 3; i++) assert.equal((await eager.req('POST', '/api/booking-requests', form())).status, 201);
  assert.equal((await eager.req('POST', '/api/booking-requests', form())).status, 409, 'at most 3 unanswered requests per artist');
});

test('reminders, backups, search engines and settings validation', async () => {
  const { getDb } = await import('../server/db');
  const { sendReminders } = await import('../server/jobs');
  const { todayStr } = await import('../server/http');
  const db = getDb();

  // Appointment reminder: once, for confirmed bookings coming up.
  const booking = db.prepare("select id, client_id from booking_requests where status = 'approved' and payment_status = 'paid' and client_id is not null limit 1").get() as any;
  db.prepare('update booking_requests set date = ?, reminder_sent_at = null where id = ?').run(todayStr(1), booking.id);
  const count = () => (db.prepare("select count(*) c from notifications where user_id = ? and message like 'Reminder:%'").get(booking.client_id) as any).c;
  const before = count();
  sendReminders();
  assert.equal(count(), before + 1);
  sendReminders();
  assert.equal(count(), before + 1, 'sent only once');

  // Deposit reminder for an approved booking left unpaid for a day.
  const unpaid = db.prepare("select id from booking_requests where status = 'pending' and guest_email = 'sam@example.com' limit 1").get() as any;
  await artist.post(`/api/booking-requests/${unpaid.id}/action`, { action: 'approve' });
  db.prepare('update booking_requests set updated_at = ? where id = ?').run(new Date(Date.now() - 2 * 86_400_000).toISOString(), unpaid.id);
  sendReminders();
  assert.ok((db.prepare('select deposit_reminder_sent_at d from booking_requests where id = ?').get(unpaid.id) as any).d);

  // Automatic backups can be listed and downloaded by admins only.
  const made = await admin.post('/api/admin/backups');
  assert.equal(made.status, 201);
  assert.equal(made.body.length, 1);
  assert.equal((await admin.get(`/api/admin/backups/${made.body[0].name}`)).status, 200);
  assert.equal((await admin.get('/api/admin/backups/..%2Finkspace.db')).status, 404);
  assert.equal((await artist.get('/api/admin/backups')).status, 403);

  // Artists without a portfolio photo stay out of search, but their profile link works.
  const bare = await register('artist', 'bare@example.com');
  assert.equal((await new Client().get('/api/artists')).body.some((a: any) => a.id === bare.me.id), false);
  assert.equal((await new Client().get(`/api/artists/${bare.me.id}`)).status, 200);

  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  assert.match(sitemap, new RegExp(`/artists/${artistId}<`));
  assert.equal(sitemap.includes(bare.me.id), false);
  assert.match(sitemap, /\/p\/privacy/);
  assert.match(await (await fetch(`${base}/robots.txt`)).text(), /Sitemap: http.*\/sitemap\.xml/);
  const home = await fetch(`${base}/`);
  assert.match(home.headers.get('content-security-policy') || '', /frame-ancestors 'self'/);

  // Links set in the admin panel must be web links; policy pages fill in the site's details.
  assert.equal((await admin.put('/api/admin/settings', { settings: { instagramUrl: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await admin.put('/api/admin/settings', { settings: { logoUrl: 'data:image/svg+xml,<svg onload=alert(1)>' } })).status, 400);
  const ok = await admin.put('/api/admin/settings', { settings: { instagramUrl: 'https://instagram.com/inkspace', contactEmail: 'hello@example.com' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const privacy = await new Client().get('/api/pages/privacy');
  assert.match(privacy.body.body, /hello@example\.com/);
  assert.match(privacy.body.body, /Moncton Ink/);
  assert.equal(privacy.body.body.includes('{{'), false);
});
