// SQLite database: connection, schema migrations and small query helpers.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config';

export type DB = Database.Database;

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  create table users (
    id text primary key,
    email text not null unique collate nocase,
    password_hash text not null,
    role text not null check (role in ('client','artist','dual','shop-owner','admin')),
    name text not null,
    city text not null default '',
    specialty text not null default '',
    bio text not null default '',
    avatar_url text,
    portfolio text not null default '[]',
    socials text not null default '{}',
    services text not null default '[]',
    hours text not null default '{}',
    intake_settings text not null default '{}',
    aftercare_message text not null default '',
    payout_method text not null default '{}',
    is_verified integer not null default 0,
    status text not null default 'active' check (status in ('active','suspended')),
    subscription_tier text not null default 'free' check (subscription_tier in ('free','pro')),
    pro_until text,
    pro_auto_renew integer not null default 0,
    square_customer_id text,
    square_card_id text,
    card_label text,
    average_rating real not null default 0,
    review_count integer not null default 0,
    created_at text not null,
    updated_at text not null
  );

  create table sessions (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at text not null,
    created_at text not null
  );
  create index sessions_user on sessions(user_id);

  create table password_resets (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at text not null,
    used_at text
  );

  create table shops (
    id text primary key,
    owner_id text not null unique references users(id) on delete cascade,
    name text not null,
    city text not null default '',
    address text not null default '',
    lat real,
    lng real,
    description text not null default '',
    amenities text not null default '[]',
    image_url text,
    is_verified integer not null default 0,
    average_rating real not null default 0,
    review_count integer not null default 0,
    created_at text not null,
    updated_at text not null
  );

  create table booths (
    id text primary key,
    shop_id text not null references shops(id) on delete cascade,
    name text not null,
    daily_rate real not null check (daily_rate >= 0),
    description text not null default '',
    active integer not null default 1,
    created_at text not null
  );
  create index booths_shop on booths(shop_id);

  create table booth_bookings (
    id text primary key,
    artist_id text not null references users(id) on delete cascade,
    booth_id text not null references booths(id) on delete cascade,
    shop_id text not null references shops(id) on delete cascade,
    start_date text not null,
    end_date text not null,
    days integer not null,
    total_cents integer not null,
    fee_cents integer not null,
    status text not null default 'unpaid' check (status in ('unpaid','paid','cancelled','refunded')),
    paid_at text,
    created_at text not null
  );
  create index booth_bookings_booth on booth_bookings(booth_id, start_date);
  create index booth_bookings_artist on booth_bookings(artist_id);
  create index booth_bookings_shop on booth_bookings(shop_id);

  create table booking_requests (
    id text primary key,
    artist_id text not null references users(id) on delete cascade,
    client_id text references users(id) on delete set null,
    guest_name text,
    guest_email text,
    guest_phone text,
    access_token text not null,
    service_id text,
    service_name text not null default 'Custom tattoo',
    service_price real,
    date text not null,
    preferred_time text not null default 'anytime',
    message text not null default '',
    tattoo_width real,
    tattoo_height real,
    body_placement text not null default '',
    budget real,
    reference_images text not null default '[]',
    status text not null default 'pending' check (status in ('pending','approved','declined','cancelled','completed','no-show')),
    deposit_cents integer not null default 0,
    fee_cents integer not null default 0,
    payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
    deposit_paid_at text,
    artist_note text not null default '',
    artist_archived integer not null default 0,
    review_rating integer,
    review_text text,
    review_at text,
    review_hidden integer not null default 0,
    created_at text not null,
    updated_at text not null
  );
  create index booking_requests_artist on booking_requests(artist_id);
  create index booking_requests_client on booking_requests(client_id);

  create table shop_reviews (
    id text primary key,
    shop_id text not null references shops(id) on delete cascade,
    booth_booking_id text not null unique references booth_bookings(id) on delete cascade,
    author_id text not null references users(id) on delete cascade,
    rating integer not null check (rating between 1 and 5),
    text text not null default '',
    hidden integer not null default 0,
    created_at text not null
  );

  create table payments (
    id text primary key,
    kind text not null check (kind in ('deposit','booth','subscription')),
    ref_id text not null,
    user_id text references users(id) on delete set null,
    payer_email text,
    description text not null default '',
    amount_cents integer not null,
    fee_cents integer not null default 0,
    payee_id text references users(id) on delete set null,
    payee_amount_cents integer not null default 0,
    currency text not null,
    square_payment_id text unique,
    receipt_url text,
    status text not null default 'completed' check (status in ('completed','refunded')),
    refunded_at text,
    created_at text not null
  );
  create index payments_payee on payments(payee_id);
  create index payments_ref on payments(ref_id);

  create table payouts (
    id text primary key,
    payee_id text not null references users(id) on delete cascade,
    amount_cents integer not null check (amount_cents > 0),
    currency text not null,
    method text not null default '',
    note text not null default '',
    created_by text,
    created_at text not null
  );

  create table notifications (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    message text not null,
    link text,
    read integer not null default 0,
    created_at text not null
  );
  create index notifications_user on notifications(user_id, created_at);

  create table conversations (
    id text primary key,
    user_a text not null references users(id) on delete cascade,
    user_b text not null references users(id) on delete cascade,
    created_at text not null,
    last_message_at text,
    unique (user_a, user_b)
  );

  create table messages (
    id text primary key,
    conversation_id text not null references conversations(id) on delete cascade,
    sender_id text not null references users(id) on delete cascade,
    content text not null default '',
    attachment_url text,
    read_at text,
    created_at text not null
  );
  create index messages_conversation on messages(conversation_id, created_at);

  create table days_off (
    artist_id text not null references users(id) on delete cascade,
    date text not null,
    primary key (artist_id, date)
  );

  create table verification_requests (
    id text primary key,
    type text not null check (type in ('artist','shop')),
    user_id text not null references users(id) on delete cascade,
    shop_id text references shops(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    note text not null default '',
    created_at text not null,
    decided_at text
  );

  create table reports (
    id text primary key,
    reporter_id text references users(id) on delete set null,
    target_type text not null check (target_type in ('user','booking','shop','review','message')),
    target_id text not null,
    reason text not null,
    status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
    admin_note text not null default '',
    created_at text not null
  );

  create table settings (
    key text primary key,
    value text not null
  );

  create table pages (
    id text primary key,
    slug text not null unique,
    title text not null,
    body text not null default '',
    published integer not null default 1,
    show_in_footer integer not null default 1,
    sort_order integer not null default 0,
    updated_at text not null
  );
  `,
  // v2 — appointment times, renewal retries, test-vs-live payments, shop blocked dates (pro_price_cents is unused)
  `
  alter table booking_requests add column appointment_time text;
  alter table users add column pro_price_cents integer;
  alter table users add column renewal_failed_at text;
  alter table payments add column environment text not null default 'sandbox';
  alter table payouts add column environment text not null default 'sandbox';
  create table booth_blocks (
    id text primary key,
    booth_id text not null references booths(id) on delete cascade,
    start_date text not null,
    end_date text not null,
    note text not null default '',
    created_at text not null
  );
  create index booth_blocks_booth on booth_blocks(booth_id, start_date);
  `,
  // v3 — terms acceptance records, reminder tracking, contact form inbox
  `
  alter table users add column terms_accepted_at text;
  alter table booking_requests add column terms_accepted_at text;
  alter table booking_requests add column reminder_sent_at text;
  alter table booking_requests add column deposit_reminder_sent_at text;
  create table contact_messages (
    id text primary key,
    name text not null,
    email text not null,
    message text not null,
    user_id text references users(id) on delete set null,
    status text not null default 'new' check (status in ('new','replied','archived')),
    created_at text not null
  );
  create index contact_messages_created on contact_messages(created_at);
  create index booking_requests_date on booking_requests(date, status);
  `,
  // v4 — indexes for lookups that grow with the site (admin lists, payouts, spam checks, conversations)
  `
  create index payments_user on payments(user_id);
  create index payments_env_created on payments(environment, created_at);
  create index payouts_payee on payouts(payee_id);
  create index booking_requests_guest_email on booking_requests(guest_email);
  create index booking_requests_created on booking_requests(created_at);
  create index booth_bookings_status on booth_bookings(status, created_at);
  create index conversations_user_b on conversations(user_b);
  create index shop_reviews_shop on shop_reviews(shop_id);
  `,
  // v5 — who cancelled a booking (a paid booking cancelled by the artist or admin waits for a refund)
  `
  alter table booking_requests add column cancelled_by text;
  `,
  // v6 — card charges whose result never arrived (replayed before charging again, so nobody is charged twice)
  `
  create table pending_charges (
    ref text primary key,
    body text not null,
    created_at text not null
  );
  `,
];

let db: DB | null = null;

export function getDb(): DB {
  if (!db) db = openDb(config.databaseFile);
  return db;
}

export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('busy_timeout = 5000');
  migrate(conn);
  return conn;
}

/** Test hook: swap the active database. */
export function setDb(conn: DB) {
  db = conn;
}

function migrate(conn: DB) {
  const current = conn.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    conn.transaction(() => {
      conn.exec(MIGRATIONS[v]);
      conn.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
