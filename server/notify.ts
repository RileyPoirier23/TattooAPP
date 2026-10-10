// In-app notifications (bell icon) with live push and optional email.
import { getDb, newId, nowIso } from './db';
import { emit } from './events';
import { sendEmail } from './email';
import { config } from './config';
import { getUser } from './auth';

export function notify(
  userId: string | null | undefined,
  message: string,
  opts: { link?: string; email?: { subject: string; lines?: string[]; actionLabel?: string } } = {},
) {
  if (!userId) return;
  const id = newId();
  const createdAt = nowIso();
  getDb()
    .prepare('insert into notifications (id, user_id, message, link, read, created_at) values (?, ?, ?, ?, 0, ?)')
    .run(id, userId, message, opts.link ?? null, createdAt);
  emit(userId, 'notification', { id, message, link: opts.link ?? null, read: false, createdAt });

  if (opts.email) {
    const user = getUser(userId);
    if (user) {
      sendEmail({
        to: user.email,
        subject: opts.email.subject,
        lines: [`Hi ${user.name},`, ...(opts.email.lines || [message])],
        action: opts.link ? { label: opts.email.actionLabel || 'View on site', url: `${config.appUrl}${opts.link}` } : undefined,
      });
    }
  }
}

export function notifyAdmins(message: string, link = '/admin') {
  const admins = getDb().prepare("select id from users where role = 'admin'").all() as { id: string }[];
  admins.forEach(a => notify(a.id, message, { link }));
}
