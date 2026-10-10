// Periodic housekeeping: Pro renewals, expiring unpaid booth holds, old sessions.
import { getDb, nowIso } from './db';
import { todayStr, formatWhen } from './http';
import { sendEmail } from './email';
import { config } from './config';
import { getSettings } from './settings';
import { processRenewals } from './billing';
import { notify } from './notify';

export function expireBoothHolds() {
  const db = getDb();
  const cutoff = new Date(Date.now() - getSettings().boothHoldHours * 3_600_000).toISOString();
  const expired = db
    .prepare(
      `select bb.id, bb.artist_id, s.name shop_name from booth_bookings bb join shops s on s.id = bb.shop_id
       where bb.status = 'unpaid' and bb.created_at <= ?`,
    )
    .all(cutoff) as any[];
  for (const b of expired) {
    db.prepare("update booth_bookings set status = 'cancelled' where id = ?").run(b.id);
    notify(b.artist_id, `Your unpaid reservation at ${b.shop_name} expired and was released.`, { link: '/bookings' });
  }
}

/** Requests nobody answered before their date has passed are closed, so nobody is asked to pay for a past date. */
export function expireStaleRequests() {
  const db = getDb();
  const stale = db
    .prepare(
      `select br.*, a.name artist_name from booking_requests br join users a on a.id = br.artist_id
       where br.status = 'pending' and br.date < ?`,
    )
    .all(todayStr(-1)) as any[];
  for (const r of stale) {
    db.prepare("update booking_requests set status = 'declined', artist_note = ?, updated_at = ? where id = ?")
      .run('This request expired because its date passed before it was answered.', nowIso(), r.id);
    const message = `Your request to ${r.artist_name} for ${formatWhen(r.date)} expired before it was answered. Feel free to request a new date.`;
    if (r.client_id) notify(r.client_id, message, { link: '/bookings' });
    else if (r.guest_email) sendEmail({ to: r.guest_email, subject: 'Your booking request expired', lines: [`Hi ${r.guest_name},`, message], action: { label: `Book ${r.artist_name} again`, url: `${config.appUrl}/artists/${r.artist_id}` } });
  }
}

export function cleanup() {
  const db = getDb();
  db.prepare('delete from sessions where expires_at < ?').run(nowIso());
  db.prepare('delete from password_resets where expires_at < ?').run(nowIso());
}

export async function runJobs() {
  try {
    expireBoothHolds();
    expireStaleRequests();
    cleanup();
    await processRenewals();
  } catch (err) {
    console.error('[jobs] failed', err);
  }
}

export function startJobs() {
  setTimeout(runJobs, 10_000);
  setInterval(runJobs, 60 * 60 * 1000).unref();
}
