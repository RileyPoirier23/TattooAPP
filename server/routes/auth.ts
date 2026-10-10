// Registration, login, logout, password reset and password change.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  createSession, createUser, destroyAllSessions, destroySession, findUserByEmail, hashPassword, randomToken,
  requireUser, sha256, verifyPassword,
} from '../auth';
import { getDb, nowIso } from '../db';
import { HttpError, badRequest, conflict, forbidden, parse, unauthorized } from '../http';
import { toMe } from '../mappers';
import { sendEmail } from '../email';
import { config } from '../config';
import { getSettings } from '../settings';
import { notifyAdmins } from '../notify';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProduction ? 20 : 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const zEmail = z.string().trim().toLowerCase().email('Enter a valid email address').max(200);

// Per-account lockout on top of the per-IP limiter, so a password can't be guessed from many addresses.
const LOCK_AFTER = 8;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

function lockedOut(email: string) {
  const f = failures.get(email);
  if (!f) return false;
  if (Date.now() - f.first > LOCK_MS) {
    failures.delete(email);
    return false;
  }
  return f.count >= LOCK_AFTER;
}

function recordFailure(email: string) {
  const f = failures.get(email);
  if (!f || Date.now() - f.first > LOCK_MS) failures.set(email, { count: 1, first: Date.now() });
  else f.count++;
  if (failures.size > 10_000) failures.delete(failures.keys().next().value!);
}

// Checked against when the email doesn't exist, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;
const zPassword = z.string().min(8, 'Password must be at least 8 characters').max(200);

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? toMe(req.user) : null });
});

authRouter.post('/register', limiter, async (req, res) => {
  const body = parse(
    z.object({
      email: zEmail,
      password: zPassword,
      name: z.string().trim().min(1, 'Name is required').max(100),
      role: z.enum(['client', 'artist', 'dual', 'shop-owner']),
      city: z.string().trim().max(100).optional(),
      acceptTerms: z.literal(true, { message: 'Please accept the Terms of Service and Privacy Policy.' }),
    }),
    req.body,
  );
  if ((body.role === 'artist' || body.role === 'dual') && !body.city) throw badRequest('Please enter your city.');
  if (findUserByEmail(body.email)) throw conflict('An account with that email already exists. Try logging in.');
  const user = await createUser(body);
  getDb().prepare('update users set terms_accepted_at = ? where id = ?').run(nowIso(), user.id);
  createSession(res, user.id);
  if (body.role !== 'client') notifyAdmins(`New ${body.role.replace('-', ' ')} signed up: ${user.name}`, '/admin/users');
  res.status(201).json({ user: toMe(user) });
});

authRouter.post('/login', limiter, async (req, res) => {
  const body = parse(z.object({ email: zEmail, password: z.string().max(200) }), req.body);
  if (lockedOut(body.email)) {
    throw new HttpError(429, 'Too many wrong passwords for this account. Wait 15 minutes, or reset your password.');
  }
  const user = findUserByEmail(body.email);
  dummyHash ??= hashPassword(randomToken());
  const ok = await verifyPassword(body.password, user?.password_hash ?? (await dummyHash));
  if (!user || !ok) {
    recordFailure(body.email);
    throw unauthorized('Incorrect email or password.');
  }
  failures.delete(body.email);
  if (user.status !== 'active') throw forbidden('This account has been suspended. Please contact support.');
  createSession(res, user.id);
  res.json({ user: toMe(user) });
});

authRouter.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.post('/forgot', limiter, (req, res) => {
  const { email } = parse(z.object({ email: zEmail }), req.body);
  const user = findUserByEmail(email);
  if (user && user.status === 'active') {
    const link = createPasswordResetLink(user.id);
    sendEmail({
      to: user.email,
      subject: `Reset your ${getSettings().siteName} password`,
      lines: [`Hi ${user.name},`, 'We received a request to reset your password. This link expires in 1 hour.', "If you didn't ask for this, you can ignore this email."],
      action: { label: 'Reset password', url: link },
    });
  }
  // Always respond the same way so this can't be used to discover which emails have accounts.
  res.json({ ok: true });
});

export function createPasswordResetLink(userId: string, hours = 1): string {
  const token = randomToken();
  getDb()
    .prepare('insert into password_resets (token_hash, user_id, expires_at) values (?, ?, ?)')
    .run(sha256(token), userId, new Date(Date.now() + hours * 3_600_000).toISOString());
  return `${config.appUrl}/reset-password?token=${token}`;
}

authRouter.post('/reset', limiter, async (req, res) => {
  const body = parse(z.object({ token: z.string().min(10).max(200), password: zPassword }), req.body);
  const db = getDb();
  const row = db
    .prepare('select * from password_resets where token_hash = ? and used_at is null and expires_at > ?')
    .get(sha256(body.token), nowIso()) as { user_id: string } | undefined;
  if (!row) throw badRequest('This reset link is invalid or has expired. Please request a new one.');
  const hash = await hashPassword(body.password);
  db.transaction(() => {
    db.prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(hash, nowIso(), row.user_id);
    db.prepare('update password_resets set used_at = ? where user_id = ? and used_at is null').run(nowIso(), row.user_id);
    destroyAllSessions(row.user_id);
  })();
  createSession(res, row.user_id);
  const user = db.prepare('select * from users where id = ?').get(row.user_id) as any;
  res.json({ user: toMe(user) });
});

authRouter.post('/change-password', limiter, async (req, res) => {
  const user = requireUser(req);
  const body = parse(z.object({ currentPassword: z.string().max(200), newPassword: zPassword }), req.body);
  if (!(await verifyPassword(body.currentPassword, user.password_hash))) throw badRequest('Your current password is incorrect.');
  getDb().prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(await hashPassword(body.newPassword), nowIso(), user.id);
  destroyAllSessions(user.id);
  createSession(res, user.id);
  res.json({ ok: true });
});
