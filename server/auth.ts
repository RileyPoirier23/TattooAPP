// Password hashing, sessions (httpOnly cookie) and auth middleware.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { getDb, newId, nowIso } from './db';
import { config } from './config';
import { forbidden, unauthorized } from './http';
import type { Role } from '../shared/types';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'inkspace_session';
const SESSION_DAYS = 30;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  name: string;
  city: string;
  specialty: string;
  bio: string;
  avatar_url: string | null;
  portfolio: string;
  socials: string;
  services: string;
  hours: string;
  intake_settings: string;
  aftercare_message: string;
  payout_method: string;
  is_verified: number;
  status: 'active' | 'suspended';
  subscription_tier: 'free' | 'pro';
  pro_until: string | null;
  pro_auto_renew: number;
  square_customer_id: string | null;
  square_card_id: string | null;
  card_label: string | null;
  average_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function createSession(res: Response, userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  getDb()
    .prepare('insert into sessions (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)')
    .run(sha256(token), userId, expires.toISOString(), nowIso());
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    expires,
    path: '/',
  });
}

export function destroySession(req: Request, res: Response) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) getDb().prepare('delete from sessions where token_hash = ?').run(sha256(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function destroyAllSessions(userId: string) {
  getDb().prepare('delete from sessions where user_id = ?').run(userId);
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const row = getDb()
      .prepare(
        `select u.* from sessions s join users u on u.id = s.user_id
         where s.token_hash = ? and s.expires_at > ?`,
      )
      .get(sha256(token), nowIso()) as UserRow | undefined;
    if (row && row.status === 'active') req.user = row;
  }
  next();
}

/**
 * CSRF protection: state-changing API requests must carry a custom header, which browsers
 * will not send cross-site without a CORS preflight (and we never allow cross-origin CORS).
 */
export function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'inkspace') {
    res.status(403).json({ error: 'Missing request header.' });
    return;
  }
  next();
}

export function requireUser(req: Request): UserRow {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(req: Request, ...roles: Role[]): UserRow {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export const isArtistRole = (role: Role) => role === 'artist' || role === 'dual';
export const isClientRole = (role: Role) => role === 'client' || role === 'dual';

export function requireArtist(req: Request): UserRow {
  return requireRole(req, 'artist', 'dual');
}

export function requireAdmin(req: Request): UserRow {
  return requireRole(req, 'admin');
}

export function isPro(u: Pick<UserRow, 'subscription_tier' | 'pro_until'>): boolean {
  if (u.subscription_tier !== 'pro') return false;
  return !u.pro_until || u.pro_until > nowIso();
}

export async function createUser(input: {
  email: string;
  password: string;
  role: Role;
  name: string;
  city?: string;
}): Promise<UserRow> {
  const db = getDb();
  const id = newId();
  const now = nowIso();
  const intake = JSON.stringify({
    requireSize: true,
    requirePlacement: true,
    requireDescription: true,
    requireBudget: false,
    requireReferenceImages: false,
  });
  db.prepare(
    `insert into users (id, email, password_hash, role, name, city, intake_settings, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.email.trim().toLowerCase(), await hashPassword(input.password), input.role, input.name.trim(), input.city?.trim() || '', intake, now, now);
  return db.prepare('select * from users where id = ?').get(id) as UserRow;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare('select * from users where email = ?').get(email.trim().toLowerCase()) as UserRow | undefined;
}

export function getUser(id: string): UserRow | undefined {
  return getDb().prepare('select * from users where id = ?').get(id) as UserRow | undefined;
}

/** Create the admin from ADMIN_EMAIL / ADMIN_PASSWORD on boot if they don't exist yet. */
export async function ensureAdminFromEnv() {
  if (!config.adminEmail || !config.adminPassword) return;
  const existing = findUserByEmail(config.adminEmail);
  if (existing) {
    if (existing.role !== 'admin') {
      getDb().prepare("update users set role = 'admin', updated_at = ? where id = ?").run(nowIso(), existing.id);
      console.log(`[setup] Promoted ${config.adminEmail} to admin.`);
    }
    return;
  }
  await createUser({ email: config.adminEmail, password: config.adminPassword, role: 'admin', name: 'Admin' });
  console.log(`[setup] Created admin account ${config.adminEmail}.`);
}
