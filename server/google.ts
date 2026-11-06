// Google Calendar for pros who connect one: approved appointments are written to it (and kept up to date
// when they move or are cancelled), and its busy times are left out of the free slots clients can pick.
// The site owner creates an OAuth client in Google Cloud and enters its id and secret in Admin → Settings.
import crypto from 'node:crypto';
import { config } from './config';
import { getDb, nowIso, parseJson } from './db';
import { getSecrets } from './settings';
import { notify } from './notify';
import { durationFor, type Busy } from './availability';
import type { UserRow } from './auth';

const oauthBase = () => (config.googleOauthBase || 'https://oauth2.googleapis.com').replace(/\/$/, '');
const apiBase = () => (config.googleApiBase || 'https://www.googleapis.com').replace(/\/$/, '');
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'];
/** The time zone appointments are in: the server's (set TZ on the host, e.g. America/Halifax). */
export const timeZone = () => process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function googleReady(): boolean {
  const s = getSecrets();
  return !!(s.googleClientId && s.googleClientSecret);
}
export const redirectUri = () => `${config.appUrl}/api/me/google/callback`;

// ---------- OAuth ----------
// Pending consent flows: a random state → the pro who started it (10 minutes).
const pending = new Map<string, { userId: string; expires: number }>();

export function consentUrl(userId: string): string {
  const state = crypto.randomBytes(24).toString('base64url');
  for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
  pending.set(state, { userId, expires: Date.now() + 10 * 60_000 });
  const q = new URLSearchParams({
    client_id: getSecrets().googleClientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${config.googleAuthBase || 'https://accounts.google.com'}/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(params: Record<string, string>): Promise<any> {
  const s = getSecrets();
  const res = await fetch(`${oauthBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: s.googleClientId, client_secret: s.googleClientSecret, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error_description || body.error || `Google token request failed (${res.status})`);
  return body;
}

/** Finishes the consent flow: swaps the code for tokens and connects the calendar to the pro who started it. */
export async function finishConnect(state: string, code: string): Promise<string> {
  const p = pending.get(state);
  pending.delete(state);
  if (!p || p.expires < Date.now()) throw new Error('This connection link has expired. Please try again.');
  const tokens = await tokenRequest({ code, redirect_uri: redirectUri(), grant_type: 'authorization_code' });
  if (!tokens.refresh_token) throw new Error('Google did not give lasting access. Remove the site from your Google account permissions and try again.');
  getDb()
    .prepare("update users set google_refresh_token = ?, google_calendar_id = 'primary', updated_at = ? where id = ?")
    .run(tokens.refresh_token, nowIso(), p.userId);
  cache.delete(p.userId);
  return p.userId;
}

export async function disconnect(user: UserRow) {
  if (user.google_refresh_token) {
    fetch(`${oauthBase()}/revoke?token=${encodeURIComponent(user.google_refresh_token)}`, { method: 'POST', signal: AbortSignal.timeout(10_000) }).catch(() => {});
  }
  getDb().prepare('update users set google_refresh_token = null, google_calendar_id = null, updated_at = ? where id = ?').run(nowIso(), user.id);
  cache.delete(user.id);
}

// Access tokens last about an hour; one per connected pro is kept in memory.
const cache = new Map<string, { token: string; expires: number }>();

async function accessToken(user: UserRow): Promise<string | null> {
  if (!user.google_refresh_token || !googleReady()) return null;
  const hit = cache.get(user.id);
  if (hit && hit.expires > Date.now()) return hit.token;
  try {
    const t = await tokenRequest({ refresh_token: user.google_refresh_token, grant_type: 'refresh_token' });
    cache.set(user.id, { token: t.access_token, expires: Date.now() + Math.max(60, (t.expires_in || 3600) - 60) * 1000 });
    return t.access_token;
  } catch (err) {
    // Access was removed on Google's side: forget the connection and tell the pro.
    if (/invalid_grant/i.test(String(err))) {
      getDb().prepare('update users set google_refresh_token = null, google_calendar_id = null where id = ?').run(user.id);
      cache.delete(user.id);
      notify(user.id, 'Your Google Calendar was disconnected. Connect it again from Hours & days off to keep syncing bookings.', { link: '/dashboard?tab=hours' });
    } else {
      console.warn('[google] token refresh failed', (err as Error).message);
    }
    return null;
  }
}

async function call(user: UserRow, method: string, path: string, body?: unknown): Promise<any> {
  const token = await accessToken(user);
  if (!token) return null;
  const res = await fetch(`${apiBase()}/calendar/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 204) return {};
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `Google Calendar ${method} ${path} failed (${res.status})`);
  return json;
}

// ---------- Busy times ----------
const busyCache = new Map<string, { busy: Busy[]; expires: number }>();
const localDate = (date: string, time: string) => new Date(`${date}T${time}:00`); // server time zone
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** The pro's busy ranges on `date` from their Google Calendar, in minutes from midnight. Empty when not connected. */
export async function googleBusy(user: UserRow, date: string): Promise<Busy[]> {
  if (!user.google_refresh_token) return [];
  const key = `${user.id}:${date}`;
  const hit = busyCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.busy;
  let busy: Busy[] = [];
  try {
    const dayStart = localDate(date, '00:00');
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const r = await call(user, 'POST', '/freeBusy', { timeMin: dayStart.toISOString(), timeMax: dayEnd.toISOString(), items: [{ id: user.google_calendar_id || 'primary' }] });
    const ranges: { start: string; end: string }[] = r?.calendars?.[user.google_calendar_id || 'primary']?.busy ?? [];
    busy = ranges
      .map(b => ({ start: new Date(b.start), end: new Date(b.end) }))
      .filter(b => b.end > dayStart && b.start < dayEnd)
      .map(b => ({ start: b.start <= dayStart ? 0 : minutesOf(b.start), end: b.end >= dayEnd ? 24 * 60 : minutesOf(b.end) }));
  } catch (err) {
    console.warn('[google] free/busy failed', (err as Error).message);
  }
  busyCache.set(key, { busy, expires: Date.now() + 60_000 });
  if (busyCache.size > 5000) busyCache.delete(busyCache.keys().next().value!);
  return busy;
}

// ---------- Appointments → events ----------
/**
 * Writes an approved appointment to the pro's Google Calendar, moves it when it's rescheduled, and removes it
 * when it's cancelled or declined. Never throws; failures are logged and retried on the next change.
 */
export async function syncBookingEvent(bookingId: string): Promise<void> {
  const db = getDb();
  const row = db
    .prepare(
      `select br.*, c.name client_name, c.email client_email from booking_requests br left join users c on c.id = br.client_id where br.id = ?`,
    )
    .get(bookingId) as any;
  if (!row) return;
  const artist = db.prepare('select * from users where id = ?').get(row.artist_id) as UserRow | undefined;
  if (!artist?.google_refresh_token) return;
  busyCache.delete(`${artist.id}:${row.date}`);
  const calendar = encodeURIComponent(artist.google_calendar_id || 'primary');
  try {
    const live = ['approved', 'completed'].includes(row.status) && row.appointment_time;
    if (!live) {
      if (row.google_event_id) {
        await call(artist, 'DELETE', `/calendars/${calendar}/events/${encodeURIComponent(row.google_event_id)}`).catch(err => {
          if (!/404|410|deleted/i.test(String(err))) throw err;
        });
        db.prepare('update booking_requests set google_event_id = null where id = ?').run(row.id);
      }
      return;
    }
    const start = localDate(row.date, row.appointment_time);
    const end = new Date(start.getTime() + durationFor(artist, row.service_id) * 60_000);
    const who = row.client_name || row.guest_name || 'Client';
    const event = {
      summary: `${row.service_name} with ${who}`,
      description: [row.message, row.client_email || row.guest_email ? `Contact: ${row.client_email || row.guest_email}${row.guest_phone ? `, ${row.guest_phone}` : ''}` : '', `Booked through ${config.appUrl}/bookings`]
        .filter(Boolean)
        .join('\n\n'),
      start: { dateTime: toLocalIso(start), timeZone: timeZone() },
      end: { dateTime: toLocalIso(end), timeZone: timeZone() },
      extendedProperties: { private: { inkspaceBooking: row.id } },
    };
    let eventId = row.google_event_id as string | null;
    if (eventId) {
      const r = await call(artist, 'PATCH', `/calendars/${calendar}/events/${encodeURIComponent(eventId)}`, event).catch(err => {
        if (/404|410/.test(String(err))) return null; // the pro deleted it in Google: create it again
        throw err;
      });
      if (!r) eventId = null;
    }
    if (!eventId) {
      const r = await call(artist, 'POST', `/calendars/${calendar}/events`, event);
      if (r?.id) db.prepare('update booking_requests set google_event_id = ? where id = ?').run(r.id, row.id);
    }
  } catch (err) {
    console.warn('[google] calendar sync failed for booking', row.id, (err as Error).message);
  }
}

/** "2026-11-13T13:00:00" in the server's time zone (Google gets the zone separately). */
function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/** For tests and the admin status: whether a user has a connected calendar. */
export const isConnected = (u: UserRow) => !!u.google_refresh_token;

// Keep parseJson imported for callers that pass raw rows (avoids an unused-import lint when tree-shaken).
void parseJson;
