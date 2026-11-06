// iCalendar (.ics) output: a private feed each member can subscribe to from Google Calendar, Apple
// Calendar or Outlook, and single-event files for "Add to calendar" buttons. Times are "floating"
// local times (no zone), which calendar apps show in the viewer's own zone; the site runs in one zone.
import { getDb } from './db';
import { durationFor, DEFAULT_DURATION_MINUTES } from './availability';
import { getSettings } from './settings';
import { config } from './config';
import type { UserRow } from './auth';

export interface IcsEvent {
  uid: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:MM, or an all-day event
  endDate?: string; // for multi-day all-day events (exclusive end handled here)
  minutes?: number;
  description?: string;
  location?: string;
  url?: string;
  stamp?: string; // ISO
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (d: string) => d.replace(/-/g, '');
const stampOf = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
/** Lines over 75 bytes are folded with a leading space, as the standard requires. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 73) {
    let cut = 73;
    while (cut > 0 && Buffer.byteLength(rest.slice(0, cut)) > 73) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
};

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function renderIcs(name: string, events: IcsEvent[]): string {
  const now = stampOf(new Date().toISOString());
  const host = config.appUrl.replace(/^https?:\/\//, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${esc(getSettings().siteName)}//Bookings//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@${host}`, `DTSTAMP:${e.stamp ? stampOf(e.stamp) : now}`, `SUMMARY:${esc(e.title)}`);
    if (e.time) {
      const [h, m] = e.time.split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + (e.minutes ?? DEFAULT_DURATION_MINUTES);
      const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`;
      lines.push(`DTSTART:${compact(e.date)}T${hhmm(startMin)}`);
      lines.push(`DTEND:${compact(endMin >= 24 * 60 ? addDays(e.date, 1) : e.date)}T${hhmm(endMin)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.endDate ?? e.date, 1))}`);
    }
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

const niceStatus = (s: string) => (s === 'approved' ? '' : ` (${s})`);

/** One booking as a calendar event, from the client's or the pro's side. */
export function bookingEvent(r: any, artist: UserRow, side: 'client' | 'pro'): IcsEvent {
  const other = side === 'client' ? artist.name : r.client_name || r.guest_name || 'Client';
  const time = r.appointment_time || r.requested_time || null;
  return {
    uid: `booking-${r.id}`,
    title: `${r.service_name} with ${other}${niceStatus(r.status)}`,
    date: r.date,
    time,
    minutes: durationFor(artist, r.service_id),
    description: [time ? '' : `Time of day: ${r.preferred_time}`, r.message, `Booked through ${getSettings().siteName}`].filter(Boolean).join('\n'),
    location: artist.address || artist.city || undefined,
    url: side === 'client' ? `${config.appUrl}/booking/${r.id}` : `${config.appUrl}/dashboard`,
    stamp: r.updated_at,
  };
}

/** Everything on a member's calendar: appointments (as client and as pro), booth rentals, shop rentals. */
export function feedFor(user: UserRow): IcsEvent[] {
  const db = getDb();
  const events: IcsEvent[] = [];
  const bookings = db
    .prepare(
      `select br.*, c.name client_name from booking_requests br left join users c on c.id = br.client_id
       where (br.client_id = @me or br.artist_id = @me) and br.status in ('approved', 'completed', 'pending') and br.date >= date('now', '-90 days')
       order by br.date`,
    )
    .all({ me: user.id }) as any[];
  for (const r of bookings) {
    const artist = r.artist_id === user.id ? user : (db.prepare('select * from users where id = ?').get(r.artist_id) as UserRow | undefined);
    if (!artist) continue;
    events.push(bookingEvent(r, artist, r.artist_id === user.id ? 'pro' : 'client'));
  }
  const rentals = db
    .prepare(
      `select b.*, s.name shop_name, s.address, s.city, s.owner_id, u.name renter_name, bo.name booth_name from booth_bookings b
       join shops s on s.id = b.shop_id join users u on u.id = b.artist_id join booths bo on bo.id = b.booth_id
       where (b.artist_id = @me or s.owner_id = @me) and b.status = 'paid' and b.end_date >= date('now', '-90 days') order by b.start_date`,
    )
    .all({ me: user.id }) as any[];
  for (const b of rentals) {
    events.push({
      uid: `rental-${b.id}`,
      title: b.artist_id === user.id ? `${b.booth_name} at ${b.shop_name}` : `${b.renter_name}: ${b.booth_name}`,
      date: b.start_date,
      endDate: b.end_date,
      location: `${b.address}, ${b.city}`,
      url: `${config.appUrl}/bookings`,
      stamp: b.updated_at,
    });
  }
  return events;
}
