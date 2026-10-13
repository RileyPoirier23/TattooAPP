// Periodic housekeeping: Pro renewals, expiring unpaid booth holds, reminders, daily backups, old sessions.
import fs from 'node:fs';
import path from 'node:path';
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
    notify(b.artist_id, `Your unpaid reservation at ${b.shop_name} expired and was released.`, {
      link: '/bookings',
      email: { subject: 'Your booth reservation expired', actionLabel: 'View my bookings' },
    });
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

const bookingLink = (r: { id: string; access_token: string }) => `${config.appUrl}/booking/${r.id}?token=${r.access_token}`;

/** Sends a client a reminder by notification (account holders) or email (guests). */
function remindClient(r: any, message: string, subject: string, actionLabel: string) {
  if (r.client_id) notify(r.client_id, message, { link: '/bookings', email: { subject, actionLabel } });
  else if (r.guest_email) {
    sendEmail({ to: r.guest_email, subject, lines: [`Hi ${r.guest_name},`, message], action: { label: actionLabel, url: bookingLink(r) } });
  }
}

/** Reminds clients about confirmed appointments a day or so ahead, and about deposits still unpaid after a day. Each is sent once. */
export function sendReminders() {
  const db = getDb();
  const select = `select br.*, a.name artist_name from booking_requests br join users a on a.id = br.artist_id`;

  const upcoming = db
    .prepare(`${select} where br.status = 'approved' and br.reminder_sent_at is null and br.date between ? and ?
      and (br.payment_status = 'paid' or br.deposit_cents = 0)`)
    .all(todayStr(), todayStr(1)) as any[];
  for (const r of upcoming) {
    db.prepare('update booking_requests set reminder_sent_at = ? where id = ?').run(nowIso(), r.id);
    remindClient(
      r,
      `Reminder: your tattoo appointment with ${r.artist_name} is on ${formatWhen(r.date, r.appointment_time)}.${r.artist_note ? ` Note from the artist: ${r.artist_note}` : ''}`,
      `Reminder: your appointment with ${r.artist_name}`,
      'View booking',
    );
  }

  const unpaid = db
    .prepare(`${select} where br.status = 'approved' and br.payment_status = 'unpaid' and br.deposit_cents > 0
      and br.deposit_reminder_sent_at is null and br.updated_at <= ? and br.date >= ?`)
    .all(new Date(Date.now() - 86_400_000).toISOString(), todayStr(1)) as any[];
  for (const r of unpaid) {
    db.prepare('update booking_requests set deposit_reminder_sent_at = ? where id = ?').run(nowIso(), r.id);
    remindClient(
      r,
      `${r.artist_name} approved your appointment on ${formatWhen(r.date, r.appointment_time)}, but the deposit hasn't been paid yet. Pay it to confirm your spot.`,
      'Your deposit is still due',
      'Pay deposit',
    );
  }
}

// ---------- Daily database backups ----------

const BACKUPS_KEPT = 7;
const backupsDir = () => path.join(config.dataDir, 'backups');

export function listBackups(): { name: string; size: number; createdAt: string }[] {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => /^backup-[\d-]+\.db$/.test(f))
    .map(name => {
      const st = fs.statSync(path.join(dir, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Full path of a backup by name, or null if there is no such backup (never escapes the backups folder). */
export function backupPath(name: string): string | null {
  if (!/^backup-[\d-]+\.db$/.test(name)) return null;
  const file = path.join(backupsDir(), name);
  return fs.existsSync(file) ? file : null;
}

/** Saves a copy of the database once a day (or now, when `force`) and keeps the newest seven. */
export async function backupDatabase(force = false): Promise<string | null> {
  const newest = listBackups()[0];
  if (!force && newest && Date.now() - new Date(newest.createdAt).getTime() < 20 * 3_600_000) return null;
  const dir = backupsDir();
  fs.mkdirSync(dir, { recursive: true });
  const name = `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.db`;
  const tmp = path.join(dir, `${name}.partial`);
  await getDb().backup(tmp);
  fs.renameSync(tmp, path.join(dir, name));
  for (const old of listBackups().slice(BACKUPS_KEPT)) fs.rmSync(path.join(dir, old.name), { force: true });
  return name;
}

export function cleanup() {
  const db = getDb();
  db.prepare('delete from sessions where expires_at < ?').run(nowIso());
  db.prepare('delete from password_resets where expires_at < ?').run(nowIso());
  // Read notifications older than six months aren't shown anywhere any more.
  db.prepare('delete from notifications where read = 1 and created_at < ?').run(new Date(Date.now() - 182 * 86_400_000).toISOString());
}

export async function runJobs() {
  // Each job runs even if another one fails.
  const jobs: [string, () => unknown][] = [
    ['booth holds', expireBoothHolds],
    ['stale requests', expireStaleRequests],
    ['reminders', sendReminders],
    ['cleanup', cleanup],
    ['renewals', processRenewals],
    ['backup', () => backupDatabase()],
  ];
  for (const [name, job] of jobs) {
    try {
      await job();
    } catch (err) {
      console.error(`[jobs] ${name} failed`, err);
    }
  }
}

let running: Promise<void> | null = null;
const timers: ReturnType<typeof setTimeout>[] = [];

function tick() {
  if (!running) running = runJobs().finally(() => (running = null));
}

export function startJobs() {
  timers.push(setTimeout(tick, 10_000), setInterval(tick, 60 * 60 * 1000));
  timers.forEach(t => t.unref());
}

/** Stops scheduling jobs and waits for a run in progress (e.g. a renewal being charged) to finish. */
export async function stopJobs() {
  timers.forEach(t => clearTimeout(t));
  await running;
}
