// Periodic housekeeping: Pro renewals, expiring unpaid booth holds, old sessions.
import { getDb, nowIso } from './db';
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

export function cleanup() {
  const db = getDb();
  db.prepare('delete from sessions where expires_at < ?').run(nowIso());
  db.prepare('delete from password_resets where expires_at < ?').run(nowIso());
}

export async function runJobs() {
  try {
    expireBoothHolds();
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
