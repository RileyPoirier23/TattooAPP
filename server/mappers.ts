// Convert database rows into the API shapes defined in shared/types.ts.
import { getDb, parseJson, nowIso } from './db';
import { isPro, type UserRow } from './auth';
import { todayStr } from './http';
import { getSettings } from './settings';
import type {
  BookingRequest, Booth, BoothBooking, GuestSpot, IntakeSettings, Me, PublicArtist, Review, Shop,
} from '../shared/types';

const DEFAULT_INTAKE: IntakeSettings = {
  requireSize: true,
  requirePlacement: true,
  requireDescription: true,
  requireBudget: false,
  requireReferenceImages: false,
};

export function intakeOf(u: UserRow): IntakeSettings {
  return { ...DEFAULT_INTAKE, ...parseJson<Partial<IntakeSettings>>(u.intake_settings, {}) };
}

export function currentGuestSpot(artistId: string): GuestSpot | null {
  const row = getDb()
    .prepare(
      `select s.id shop_id, s.name shop_name, s.city, b.start_date, b.end_date
       from booth_bookings b join shops s on s.id = b.shop_id
       where b.artist_id = ? and b.status = 'paid' and b.end_date >= ?
       order by b.start_date limit 1`,
    )
    .get(artistId, todayStr()) as any;
  if (!row) return null;
  return { shopId: row.shop_id, shopName: row.shop_name, city: row.city, startDate: row.start_date, endDate: row.end_date };
}

export function toPublicArtist(u: UserRow): PublicArtist {
  return {
    id: u.id,
    name: u.name,
    city: u.city,
    specialty: u.specialty,
    bio: u.bio,
    avatarUrl: u.avatar_url,
    portfolio: parseJson(u.portfolio, []),
    socials: parseJson(u.socials, {}),
    services: parseJson(u.services, []),
    hours: parseJson(u.hours, {}),
    intakeSettings: intakeOf(u),
    isVerified: !!u.is_verified,
    isPro: isPro(u),
    averageRating: u.average_rating,
    reviewCount: u.review_count,
    guestSpot: currentGuestSpot(u.id),
  };
}

export function daysOffFor(artistId: string): string[] {
  return (
    getDb()
      .prepare('select date from days_off where artist_id = ? and date >= ? order by date')
      .all(artistId, todayStr(-1)) as { date: string }[]
  ).map(r => r.date);
}

export function toMe(u: UserRow): Me {
  const db = getDb();
  const shop = db.prepare('select id from shops where owner_id = ?').get(u.id) as { id: string } | undefined;
  const pending = db
    .prepare("select 1 from verification_requests where user_id = ? and status = 'pending' limit 1")
    .get(u.id);
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    name: u.name,
    city: u.city,
    specialty: u.specialty,
    bio: u.bio,
    avatarUrl: u.avatar_url,
    portfolio: parseJson(u.portfolio, []),
    socials: parseJson(u.socials, {}),
    services: parseJson(u.services, []),
    hours: parseJson(u.hours, {}),
    intakeSettings: intakeOf(u),
    aftercareMessage: u.aftercare_message,
    payoutMethod: parseJson(u.payout_method, {}),
    isVerified: !!u.is_verified,
    verificationPending: !!pending,
    subscription: {
      tier: u.subscription_tier,
      isPro: isPro(u),
      proUntil: u.pro_until,
      autoRenew: !!u.pro_auto_renew,
      cardLabel: u.card_label,
    },
    shopId: shop?.id ?? null,
    daysOff: daysOffFor(u.id),
  };
}

export function toBooth(r: any): Booth {
  return {
    id: r.id,
    shopId: r.shop_id,
    name: r.name,
    dailyRate: r.daily_rate,
    description: r.description,
    active: !!r.active,
  };
}

export function toShop(r: any, includeInactiveBooths = false): Shop {
  const booths = (
    getDb()
      .prepare(`select * from booths where shop_id = ? ${includeInactiveBooths ? '' : 'and active = 1'} order by daily_rate, name`)
      .all(r.id) as any[]
  ).map(toBooth);
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    city: r.city,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    description: r.description,
    amenities: parseJson(r.amenities, []),
    imageUrl: r.image_url,
    isVerified: !!r.is_verified,
    averageRating: r.average_rating,
    reviewCount: r.review_count,
    booths,
  };
}

export const BOOKING_REQUEST_SELECT = `
  select br.*, a.name artist_name, c.name client_name, c.email client_email
  from booking_requests br
  join users a on a.id = br.artist_id
  left join users c on c.id = br.client_id`;

export function toBookingRequest(r: any, opts: { includeToken?: boolean; includeContact?: boolean } = {}): BookingRequest {
  const isGuest = !r.client_id;
  const review: Review | null = r.review_rating
    ? {
        id: r.id,
        authorName: isGuest ? r.guest_name : r.client_name,
        rating: r.review_rating,
        text: r.review_text || '',
        createdAt: r.review_at,
        hidden: !!r.review_hidden,
      }
    : null;
  return {
    id: r.id,
    artistId: r.artist_id,
    artistName: r.artist_name,
    clientId: r.client_id,
    clientName: isGuest ? r.guest_name || 'Guest' : r.client_name || 'Deleted user',
    isGuest,
    guestEmail: opts.includeContact ? r.guest_email : null,
    guestPhone: opts.includeContact ? r.guest_phone : null,
    serviceId: r.service_id,
    serviceName: r.service_name,
    servicePrice: r.service_price,
    date: r.date,
    preferredTime: r.preferred_time,
    message: r.message,
    tattooWidth: r.tattoo_width,
    tattooHeight: r.tattoo_height,
    bodyPlacement: r.body_placement,
    budget: r.budget,
    referenceImages: parseJson(r.reference_images, []),
    status: r.status,
    depositCents: r.deposit_cents,
    feeCents: r.fee_cents,
    paymentStatus: r.payment_status,
    depositPaidAt: r.deposit_paid_at,
    artistNote: r.artist_note,
    archived: !!r.artist_archived,
    review,
    ...(opts.includeToken ? { accessToken: r.access_token } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const BOOTH_BOOKING_SELECT = `
  select bb.*, u.name artist_name, bo.name booth_name, s.name shop_name, s.city shop_city,
    exists(select 1 from shop_reviews r where r.booth_booking_id = bb.id) reviewed
  from booth_bookings bb
  join users u on u.id = bb.artist_id
  join booths bo on bo.id = bb.booth_id
  join shops s on s.id = bb.shop_id`;

export function holdExpiry(createdAt: string): string {
  const hours = getSettings().boothHoldHours;
  return new Date(new Date(createdAt).getTime() + hours * 3_600_000).toISOString();
}

export function toBoothBooking(r: any): BoothBooking {
  return {
    id: r.id,
    artistId: r.artist_id,
    artistName: r.artist_name,
    boothId: r.booth_id,
    boothName: r.booth_name,
    shopId: r.shop_id,
    shopName: r.shop_name,
    shopCity: r.shop_city,
    startDate: r.start_date,
    endDate: r.end_date,
    days: r.days,
    totalCents: r.total_cents,
    feeCents: r.fee_cents,
    status: r.status,
    paidAt: r.paid_at,
    holdExpiresAt: r.status === 'unpaid' ? holdExpiry(r.created_at) : null,
    reviewed: !!r.reviewed,
    createdAt: r.created_at,
  };
}

export function recomputeArtistRating(artistId: string) {
  getDb()
    .prepare(
      `update users set
        average_rating = coalesce((select avg(review_rating) from booking_requests where artist_id = @id and review_rating is not null and review_hidden = 0), 0),
        review_count = (select count(*) from booking_requests where artist_id = @id and review_rating is not null and review_hidden = 0),
        updated_at = @now
       where id = @id`,
    )
    .run({ id: artistId, now: nowIso() });
}

export function recomputeShopRating(shopId: string) {
  getDb()
    .prepare(
      `update shops set
        average_rating = coalesce((select avg(rating) from shop_reviews where shop_id = @id and hidden = 0), 0),
        review_count = (select count(*) from shop_reviews where shop_id = @id and hidden = 0),
        updated_at = @now
       where id = @id`,
    )
    .run({ id: shopId, now: nowIso() });
}
