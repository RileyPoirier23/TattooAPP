// Formatting helpers for money and dates. Dates are YYYY-MM-DD strings interpreted in local time.
import { useStore } from '../store';

export function money(cents: number, currency?: string) {
  const cur = currency || useStore.getState().config?.settings.currency || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export const dollars = (amount: number, currency?: string) => money(Math.round(amount * 100), currency);

export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toDateStr(new Date());

export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function formatDate(s: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!s) return '';
  const d = s.length === 10 ? parseDate(s) : new Date(s);
  return d.toLocaleDateString(undefined, opts);
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso, { month: 'short', day: 'numeric' });
}

export function daysInclusive(start: string, end: string) {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000) + 1;
}

export const PREFERRED_TIMES: Record<string, string> = {
  anytime: 'Any time',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export const ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  artist: 'Artist',
  dual: 'Artist & Client',
  'shop-owner': 'Shop Owner',
  admin: 'Admin',
};

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
