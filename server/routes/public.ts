// Public, read-only endpoints: site config, artists, shops, content pages.
import { Router } from 'express';
import { availabilityFor } from '../availability';
import { googleBusy, googleReady } from '../google';
import { feedFor, renderIcs } from '../ics';
import { getDb, parseJson } from '../db';
import { getSettings } from '../settings';
import { config } from '../config';
import { fillPageTokens } from '../defaultPages';
import { paymentsReady } from '../square';
import { emailReady } from '../email';
import { badRequest, notFound, todayStr } from '../http';
import { daysOffFor, guestSpotsByArtist, intakeOf, toPublicArtist, toShop } from '../mappers';
import type { UserRow } from '../auth';
import type { ArtistDetail, Page, PublicConfig, Review, ShopDetail } from '../../shared/types';

export const publicRouter = Router();

publicRouter.get('/config', (_req, res) => {
  const pages = getDb()
    .prepare('select slug, title, show_in_footer from pages where published = 1 order by sort_order, title')
    .all() as any[];
  const body: PublicConfig = {
    settings: getSettings(),
    pages: pages.map(p => ({ slug: p.slug, title: p.title, showInFooter: !!p.show_in_footer })),
    paymentsReady: paymentsReady(),
    emailReady: emailReady(),
    googleCalendarReady: googleReady(),
  };
  res.json(body);
});

publicRouter.get('/pages/:slug', (req, res) => {
  const p = getDb().prepare('select * from pages where slug = ? and published = 1').get(req.params.slug) as any;
  if (!p) throw notFound('Page not found.');
  const page: Page = {
    id: p.id,
    slug: p.slug,
    title: p.title,
    body: fillPageTokens(p.body, getSettings(), config.appUrl),
    published: !!p.published,
    showInFooter: !!p.show_in_footer,
    sortOrder: p.sort_order,
    updatedAt: p.updated_at,
  };
  res.json(page);
});

publicRouter.get('/artists', (req, res) => {
  const rows = getDb()
    .prepare(
      // Artists appear in search once they've added at least one portfolio photo (their profile link works before that).
      // Pro artists are listed first, then verified ones.
      `select * from users where role in ('artist','dual') and status = 'active' and json_array_length(portfolio) > 0
       order by (subscription_tier = 'pro' and (pro_until is null or pro_until > @now)) desc,
         is_verified desc, average_rating desc, review_count desc, created_at desc`,
    )
    .all({ now: new Date().toISOString() }) as UserRow[];
  const spots = guestSpotsByArtist();
  // ?date=YYYY-MM-DD keeps only pros working that day: open on that weekday (or no hours set, like the
  // booking calendar) and not on a day off.
  const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : null;
  let list = rows;
  if (date) {
    const weekday = String(new Date(`${date}T12:00:00`).getDay());
    const off = new Set(
      (getDb().prepare('select artist_id from days_off where date = ?').all(date) as { artist_id: string }[]).map(r => r.artist_id),
    );
    list = rows.filter(u => {
      const hours = parseJson<Record<string, unknown[]>>(u.hours, {});
      const hasHours = Object.values(hours).some(slots => Array.isArray(slots) && slots.length > 0);
      return !off.has(u.id) && (!hasHours || !!hours[weekday]?.length);
    });
  }
  res.json(list.map(u => toPublicArtist(u, spots)));
});

// A member's private calendar feed; the long random token in the link is the only credential.
publicRouter.get('/calendar/:token.ics', (req, res) => {
  const token = String(req.params.token || '');
  const user = token.length >= 20 ? (getDb().prepare('select * from users where calendar_token = ? and status = ?').get(token, 'active') as UserRow | undefined) : undefined;
  if (!user) throw notFound('Calendar not found.');
  res.type('text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'inline; filename="bookings.ics"');
  res.send(renderIcs(`${getSettings().siteName}: ${user.name}`, feedFor(user)));
});

// Free start times for one day, for the booking form's slot picker.
publicRouter.get('/artists/:id/availability', async (req, res) => {
  const u = getDb()
    .prepare("select * from users where id = ? and role in ('artist','dual') and status = 'active'")
    .get(req.params.id) as UserRow | undefined;
  if (!u) throw notFound('Pro not found.');
  const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : null;
  if (!date) throw badRequest('Choose a date.');
  const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId.slice(0, 60) : null;
  if (!intakeOf(u).timeSlots) return res.json({ date, durationMinutes: 0, slots: [], reason: null });
  res.json(availabilityFor(u, date, serviceId, await googleBusy(u, date)));
});

publicRouter.get('/artists/:id', (req, res) => {
  const db = getDb();
  const u = db
    .prepare("select * from users where id = ? and role in ('artist','dual') and status = 'active'")
    .get(req.params.id) as UserRow | undefined;
  if (!u) throw notFound('Pro not found.');
  const reviews = (
    db
      .prepare(
        `select br.id, br.review_rating, br.review_text, br.review_at, br.guest_name, c.name client_name
         from booking_requests br left join users c on c.id = br.client_id
         where br.artist_id = ? and br.review_rating is not null and br.review_hidden = 0
         order by br.review_at desc limit 50`,
      )
      .all(u.id) as any[]
  ).map(
    (r): Review => ({
      id: r.id,
      authorName: firstName(r.client_name || r.guest_name || 'Client'),
      rating: r.review_rating,
      text: r.review_text || '',
      createdAt: r.review_at,
    }),
  );
  const detail: ArtistDetail = { ...toPublicArtist(u), reviews, daysOff: daysOffFor(u.id) };
  res.json(detail);
});

publicRouter.get('/shops', (_req, res) => {
  const rows = getDb()
    .prepare(
      `select s.* from shops s join users u on u.id = s.owner_id where u.status = 'active'
       order by s.is_verified desc, s.average_rating desc, s.created_at desc`,
    )
    .all();
  res.json(rows.map(r => toShop(r)));
});

publicRouter.get('/shops/:id', (req, res) => {
  const db = getDb();
  const s = db
    .prepare("select s.* from shops s join users u on u.id = s.owner_id where s.id = ? and u.status = 'active'")
    .get(req.params.id);
  if (!s) throw notFound('Shop not found.');
  const holdCutoff = new Date(Date.now() - getSettings().boothHoldHours * 3_600_000).toISOString();
  const bookedRanges = (
    db
      .prepare(
        `select booth_id, start_date, end_date from booth_bookings
         where shop_id = ? and end_date >= ? and (status = 'paid' or (status = 'unpaid' and created_at > ?))
         order by start_date`,
      )
      .all(req.params.id, todayStr(), holdCutoff) as any[]
  ).map(r => ({ boothId: r.booth_id, startDate: r.start_date, endDate: r.end_date }));
  // Dates the shop has blocked show as unavailable too.
  const blocked = db
    .prepare(
      `select bb.booth_id, bb.start_date, bb.end_date from booth_blocks bb join booths b on b.id = bb.booth_id
       where b.shop_id = ? and bb.end_date >= ? order by bb.start_date`,
    )
    .all(req.params.id, todayStr()) as any[];
  bookedRanges.push(...blocked.map(r => ({ boothId: r.booth_id, startDate: r.start_date, endDate: r.end_date })));
  bookedRanges.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const reviews = (
    db
      .prepare(
        `select r.*, u.name author_name from shop_reviews r join users u on u.id = r.author_id
         where r.shop_id = ? and r.hidden = 0 order by r.created_at desc limit 50`,
      )
      .all(req.params.id) as any[]
  ).map((r): Review => ({ id: r.id, authorName: r.author_name, rating: r.rating, text: r.text, createdAt: r.created_at }));
  const detail: ShopDetail = { ...toShop(s), reviews, bookedRanges };
  res.json(detail);
});

function firstName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}
