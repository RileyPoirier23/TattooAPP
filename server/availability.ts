// Free start times for a pro on a given day: inside their working hours, not on a day off, not
// overlapping another appointment (or a busy time from their connected Google Calendar).
import { getDb, parseJson } from './db';
import { intakeOf } from './mappers';
import type { UserRow } from './auth';
import type { ArtistService, Availability, WeeklyHours } from '../shared/types';

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const DEFAULT_DURATION_MINUTES = 60;

/** Minutes a booking takes: its service's duration, or the default when no service was chosen. */
export function durationFor(artist: UserRow, serviceId: string | null | undefined): number {
  const services = parseJson<ArtistService[]>(artist.services, []);
  const s = serviceId ? services.find(x => x.id === serviceId) : undefined;
  return s?.duration ? Math.max(15, Math.round(s.duration * 60)) : DEFAULT_DURATION_MINUTES;
}

export type Busy = { start: number; end: number }; // minutes from midnight, local time

/** Appointments already in the pro's day (pending and approved, with a time), as busy ranges. */
export function bookedRanges(artist: UserRow, date: string, exceptId?: string): Busy[] {
  const rows = getDb()
    .prepare(
      `select id, service_id, appointment_time, requested_time from booking_requests
       where artist_id = ? and date = ? and status in ('pending', 'approved') and coalesce(appointment_time, requested_time) is not null`,
    )
    .all(artist.id, date) as { id: string; service_id: string | null; appointment_time: string | null; requested_time: string | null }[];
  return rows
    .filter(r => r.id !== exceptId)
    .map(r => {
      const start = toMin((r.appointment_time || r.requested_time)!);
      return { start, end: start + durationFor(artist, r.service_id) };
    });
}

export function availabilityFor(artist: UserRow, date: string, serviceId: string | null | undefined, extraBusy: Busy[] = [], exceptId?: string): Availability {
  const hours = parseJson<WeeklyHours>(artist.hours, {});
  const hasHours = Object.values(hours).some(s => s?.length);
  const weekday = String(new Date(`${date}T12:00:00`).getDay());
  const durationMinutes = durationFor(artist, serviceId);
  const base = { date, durationMinutes };
  if (getDb().prepare('select 1 from days_off where artist_id = ? and date = ?').get(artist.id, date)) return { ...base, slots: [], reason: `${artist.name} is not available on that date.` };
  // No working hours set: the client picks a time of day instead, and the pro confirms a time.
  if (!hasHours) return { ...base, slots: [], reason: null };
  const windows = hours[weekday] ?? [];
  if (!windows.length) return { ...base, slots: [], reason: `${artist.name} doesn't work on that day of the week.` };

  const step = intakeOf(artist).slotMinutes;
  const busy = [...bookedRanges(artist, date, exceptId), ...extraBusy];
  // Today: nothing that starts within the next hour.
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const earliest = date === todayStr ? now.getHours() * 60 + now.getMinutes() + 60 : 0;
  const slots: string[] = [];
  for (const w of windows) {
    const open = toMin(w.start);
    const close = toMin(w.end);
    for (let start = open; start + durationMinutes <= close; start += step) {
      if (start < earliest) continue;
      const end = start + durationMinutes;
      if (busy.some(b => start < b.end && end > b.start)) continue;
      slots.push(toTime(start));
    }
  }
  return { ...base, slots, reason: null };
}
