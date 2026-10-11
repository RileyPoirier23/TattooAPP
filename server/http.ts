// Small HTTP helpers shared by all routes.
import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = 'Please log in to continue.') => new HttpError(401, msg);
export const forbidden = (msg = "You don't have permission to do that.") => new HttpError(403, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

const FIELD_LABELS: Record<string, string> = {
  instagram: 'Instagram link', tiktok: 'TikTok link', facebook: 'Facebook link', website: 'Website link',
  duration: 'hours', dailyRate: 'Daily rate', guestName: 'Name', guestEmail: 'Email', guestPhone: 'Phone',
  tattooWidth: 'Width', tattooHeight: 'Height', bodyPlacement: 'Placement', startDate: 'First day', endDate: 'Last day',
  depositAmount: 'Deposit', minSize: 'Minimum size', maxSize: 'Maximum size', aftercareMessage: 'Aftercare message',
};

/** "services.0.price" → "Service 1 price"; "socials.instagram" → "Instagram link". */
function fieldLabel(path: PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (typeof next === 'number' && typeof key === 'string') {
      parts.push(`${key.replace(/s$/, '').replace(/^\w/, c => c.toUpperCase())} ${next + 1}`);
      i++;
    } else if (typeof key === 'string' && !(key === 'socials' || key === 'settings' || key === 'secrets' || key === 'features')) {
      parts.push(FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
    }
  }
  const label = parts.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Plain-language wording for zod's built-in messages; messages written in the schemas are kept as they are. */
function friendlyIssue(issue: z.core.$ZodIssue): string {
  const i = issue as z.core.$ZodIssue & { minimum?: number | bigint; maximum?: number | bigint; origin?: string; format?: string; input?: unknown };
  const builtIn = /^(Too small|Too big|Invalid|Expected)/.test(issue.message);
  if (!builtIn) return issue.message;
  if (issue.code === 'too_small') {
    if (i.origin === 'string') return Number(i.minimum) <= 1 ? 'is required' : `must be at least ${i.minimum} characters`;
    if (i.origin === 'array') return `needs at least ${i.minimum}`;
    return Number(i.minimum) === 0 ? "can't be negative" : `must be at least ${i.minimum}`;
  }
  if (issue.code === 'too_big') return i.origin === 'string' ? `is too long (at most ${i.maximum} characters)` : `must be at most ${i.maximum}`;
  if (issue.code === 'invalid_format' && i.format === 'email') return 'must be a valid email address';
  if (issue.code === 'invalid_type') return i.input === undefined ? 'is required' : 'is not valid';
  return 'is not valid';
}

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = friendlyIssue(issue);
    // Full sentences ("Please enter your name.") stand alone; fragments ("must start with https://") get the field name.
    const sentence = /^[A-Z]/.test(message);
    const label = issue.path.length ? fieldLabel(issue.path) : '';
    throw badRequest(sentence || !label ? message : `${label} ${message}.`);
  }
  return result.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message || 'Invalid input.' });
    return;
  }
  const e = err as { code?: string; message?: string; status?: number; type?: string };
  if (e?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'That image is too large (the limit is 8 MB).' });
    return;
  }
  if (e?.code === 'LIMIT_FILE_COUNT' || e?.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ error: 'Too many images at once — please upload up to 6 at a time.' });
    return;
  }
  if (typeof e?.code === 'string' && e.code.startsWith('LIMIT_')) {
    res.status(400).json({ error: 'That upload is too large or has too many fields.' });
    return;
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request is too large.' });
    return;
  }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON.' });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
}

// Shared zod pieces
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)');
export const zMoney = z.coerce.number().min(0).max(1_000_000);
export const zText = (max: number) => z.string().trim().max(max);

export const toCents = (dollars: number) => Math.round(dollars * 100);

/** Today's date (YYYY-MM-DD) in the server's local time zone. */
export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateStr(d);
}

export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetweenInclusive(start: string, end: string): number {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** "Sat, Oct 10 – Mon, Oct 12, 2026" (or a single day). */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatWhen(start);
  const a = parseDate(start);
  const b = parseDate(end);
  const short = (d: Date, year: boolean) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
  return `${short(a, a.getFullYear() !== b.getFullYear())} – ${short(b, true)}`;
}

/** "Sun, Nov 15, 2026 at 1:00 PM" (time optional). */
export function formatWhen(date: string, time?: string | null): string {
  const d = parseDate(date);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (!time) return day;
  const [h, m] = time.split(':').map(Number);
  const t = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${t}`;
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
