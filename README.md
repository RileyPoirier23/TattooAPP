# InkSpace - Tattoo Industry Marketplace

InkSpace is a dual-sided marketplace connecting tattoo artists with shops for guest spots (B2B) and clients with artists for appointments (B2C).

## 🚀 Quick Start

### 1. Environment Setup
Create a `.env` file in the root directory:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPS_API_KEY=your_google_maps_api_key
VITE_GEMINI_API_KEY=your_gemini_ai_api_key
```

### 2. Backend Setup (Supabase) - CRITICAL STEP

You **MUST** run the SQL script below to set up the database. The app will not work without this.

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** tab (icon on the left).
3. Click **New query**.
4. Copy the SQL script below and paste it into the editor.
5. Click **Run** (bottom right).

#### 📜 SQL Script (Copy All)

```sql
-- 1. Enable necessary extensions
create extension if not exists "moddatetime" schema "extensions";

-- 2. Create Storage Buckets (Fixes "Bucket Not Found")
insert into storage.buckets (id, name, public)
values 
  ('portfolios', 'portfolios', true),
  ('booking-references', 'booking-references', true),
  ('message_attachments', 'message_attachments', true)
on conflict (id) do nothing;

-- 3. Create Tables (IF NOT EXISTS)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text,
  full_name text,
  role text check (role in ('artist', 'client', 'shop-owner', 'dual', 'admin')),
  city text,
  specialty text,
  bio text,
  portfolio jsonb default '[]'::jsonb,
  socials jsonb default '{}'::jsonb,
  hourly_rate numeric,
  services jsonb default '[]'::jsonb,
  aftercare_message text,
  request_healed_photo boolean default false,
  hours jsonb default '{}'::jsonb,
  intake_settings jsonb default '{"requireSize": true, "requireDescription": true, "requireLocation": true}'::jsonb,
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.shops (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id),
  name text not null,
  location text,
  address text,
  lat double precision,
  lng double precision,
  amenities text[],
  image_url text,
  payment_methods jsonb,
  is_verified boolean default false,
  rating numeric default 0,
  average_artist_rating numeric default 0,
  reviews jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.booths (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade,
  name text not null,
  daily_rate numeric not null,
  photos text[],
  amenities text[],
  rules text,
  created_at timestamptz default now()
);

create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid references public.profiles(id),
  shop_id uuid references public.shops(id),
  booth_id uuid references public.booths(id),
  start_date date not null,
  end_date date not null,
  payment_status text default 'unpaid',
  total_amount numeric,
  platform_fee numeric,
  created_at timestamptz default now()
);

create table if not exists public.client_booking_requests (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id), -- Nullable for Guests
  artist_id uuid references public.profiles(id),
  start_date date,
  end_date date,
  message text,
  status text default 'pending',
  tattoo_width numeric,
  tattoo_height numeric,
  body_placement text,
  payment_status text default 'unpaid',
  deposit_amount numeric,
  deposit_paid_at timestamptz,
  platform_fee numeric,
  service_id text,
  budget numeric,
  reference_image_urls text[],
  preferred_time text,
  review_rating numeric,
  review_text text,
  review_submitted_at timestamptz,
  -- Guest Fields
  guest_name text,
  guest_email text,
  guest_phone text,
  created_at timestamptz default now()
);

-- Ensure Guest Columns exist (idempotent alter)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'client_booking_requests' and column_name = 'guest_name') then
        alter table public.client_booking_requests add column guest_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'client_booking_requests' and column_name = 'guest_email') then
        alter table public.client_booking_requests add column guest_email text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'client_booking_requests' and column_name = 'guest_phone') then
        alter table public.client_booking_requests add column guest_phone text;
    end if;
    -- Make client_id nullable if it isn't already
    alter table public.client_booking_requests alter column client_id drop not null;
end $$;


create table if not exists public.artist_availability (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  status text check (status in ('available', 'unavailable')),
  created_at timestamptz default now(),
  unique(artist_id, date)
);

create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  participant_one_id uuid references public.profiles(id),
  participant_two_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  content text,
  attachment_url text,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.verification_requests (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id),
  shop_id uuid references public.shops(id),
  type text check (type in ('artist', 'shop')),
  status text default 'pending',
  created_at timestamptz default now()
);

-- 4. Enable RLS
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.booths enable row level security;
alter table public.bookings enable row level security;
alter table public.client_booking_requests enable row level security;
alter table public.artist_availability enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_requests enable row level security;

-- 5. Storage Policies (Clean up old ones first to prevent errors)
drop policy if exists "Public Access to Portfolios" on storage.objects;
drop policy if exists "Authenticated users can upload portfolios" on storage.objects;
drop policy if exists "Users can delete own portfolio images" on storage.objects;
drop policy if exists "Public Access to Booking Refs" on storage.objects;
drop policy if exists "Authenticated users can upload refs" on storage.objects;
drop policy if exists "Public upload refs" on storage.objects;
drop policy if exists "Public Access to Message Attachments" on storage.objects;
drop policy if exists "Authenticated users can upload attachments" on storage.objects;

-- Re-create Storage Policies
create policy "Public Access to Portfolios" on storage.objects for select using ( bucket_id = 'portfolios' );
create policy "Authenticated users can upload portfolios" on storage.objects for insert with check ( bucket_id = 'portfolios' and auth.role() = 'authenticated' );
create policy "Users can delete own portfolio images" on storage.objects for delete using ( bucket_id = 'portfolios' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Public Access to Booking Refs" on storage.objects for select using ( bucket_id = 'booking-references' );
-- Allow ANYONE (including guests) to upload references
create policy "Public upload refs" on storage.objects for insert with check ( bucket_id = 'booking-references' );

create policy "Public Access to Message Attachments" on storage.objects for select using ( bucket_id = 'message_attachments' );
create policy "Authenticated users can upload attachments" on storage.objects for insert with check ( bucket_id = 'message_attachments' and auth.role() = 'authenticated' );

-- 6. Table Policies (Clean up old ones first)
drop policy if exists "Public profiles" on public.profiles;
drop policy if exists "Users update own" on public.profiles;
drop policy if exists "Users insert own" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Public profiles" on public.profiles for select using (true);
create policy "Users update own" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Public shops" on public.shops;
drop policy if exists "Owners manage shops" on public.shops;
drop policy if exists "Shops viewable by everyone" on public.shops;
drop policy if exists "Shop owners can insert shops" on public.shops;
drop policy if exists "Shop owners can update own shops" on public.shops;
drop policy if exists "Shop owners can delete own shops" on public.shops;

create policy "Public shops" on public.shops for select using (true);
create policy "Owners manage shops" on public.shops for all using (auth.uid() = owner_id);

drop policy if exists "Public booths" on public.booths;
drop policy if exists "Owners manage booths" on public.booths;
drop policy if exists "Booths viewable by everyone" on public.booths;
drop policy if exists "Shop owners can manage booths" on public.booths;

create policy "Public booths" on public.booths for select using (true);
create policy "Owners manage booths" on public.booths for all using (
  exists (select 1 from public.shops where shops.id = booths.shop_id and shops.owner_id = auth.uid())
);

drop policy if exists "Booking visibility" on public.bookings;
drop policy if exists "Artist create booking" on public.bookings;
drop policy if exists "Users can see their own bookings" on public.bookings;
drop policy if exists "Artists can insert bookings" on public.bookings;

create policy "Booking visibility" on public.bookings for select using (auth.uid() = artist_id or exists (select 1 from public.shops where shops.id = bookings.shop_id and shops.owner_id = auth.uid()));
create policy "Artist create booking" on public.bookings for insert with check (auth.uid() = artist_id);

-- Client Booking Requests (Critical for Guest Booking)
drop policy if exists "Client Request visibility" on public.client_booking_requests;
drop policy if exists "Public request creation" on public.client_booking_requests;
drop policy if exists "Update request" on public.client_booking_requests;
drop policy if exists "Artist view requests" on public.client_booking_requests;
drop policy if exists "Clients and Artists can view their requests" on public.client_booking_requests;
drop policy if exists "Clients can insert requests" on public.client_booking_requests;
drop policy if exists "Users can update their requests" on public.client_booking_requests;

-- Allow Artists to see requests, OR the client to see their own
create policy "Artist view requests" on public.client_booking_requests for select using (
  auth.uid() = artist_id OR auth.uid() = client_id
);
-- Allow ANYONE to insert a request (Guests)
create policy "Public request creation" on public.client_booking_requests for insert with check (true);
create policy "Update request" on public.client_booking_requests for update using (auth.uid() = client_id or auth.uid() = artist_id);

drop policy if exists "Conversation visibility" on public.conversations;
drop policy if exists "Conversation create" on public.conversations;
drop policy if exists "Users can view their conversations" on public.conversations;
drop policy if exists "Users can insert conversations" on public.conversations;

create policy "Conversation visibility" on public.conversations for select using (auth.uid() = participant_one_id or auth.uid() = participant_two_id);
create policy "Conversation create" on public.conversations for insert with check (auth.uid() = participant_one_id or auth.uid() = participant_two_id);

drop policy if exists "Message visibility" on public.messages;
drop policy if exists "Message create" on public.messages;
drop policy if exists "Users can view messages in their convos" on public.messages;
drop policy if exists "Users can insert messages" on public.messages;

create policy "Message visibility" on public.messages for select using (exists (select 1 from public.conversations where conversations.id = messages.conversation_id and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())));
create policy "Message create" on public.messages for insert with check (auth.uid() = sender_id);

drop policy if exists "Notif visibility" on public.notifications;
drop policy if exists "Notif create" on public.notifications;
drop policy if exists "Notif update" on public.notifications;
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "System/Users can insert notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;

create policy "Notif visibility" on public.notifications for select using (auth.uid() = user_id);
create policy "Notif create" on public.notifications for insert with check (true);
create policy "Notif update" on public.notifications for update using (auth.uid() = user_id);

drop policy if exists "Availability public" on public.artist_availability;
drop policy if exists "Artist manage avail" on public.artist_availability;
drop policy if exists "Artists manage availability" on public.artist_availability;

create policy "Availability public" on public.artist_availability for select using (true);
create policy "Artist manage avail" on public.artist_availability for all using (auth.uid() = artist_id);

drop policy if exists "Verification visibility" on public.verification_requests;
drop policy if exists "Verification create" on public.verification_requests;
drop policy if exists "Verification requests viewable by owner" on public.verification_requests;
drop policy if exists "Create verification" on public.verification_requests;

create policy "Verification visibility" on public.verification_requests for select using (auth.uid() = profile_id or exists (select 1 from public.shops where shops.id = verification_requests.shop_id and shops.owner_id = auth.uid()));
create policy "Verification create" on public.verification_requests for insert with check (true);

-- 7. Auto-Profile Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, role, city)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'city'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 3. Run the App
```bash
npm install
npm run dev
```

---

## 🛠 Features

*   **For Clients:**
    *   Find artists by city, specialty, and rating.
    *   Book appointments with a detailed intake wizard (size, placement, photos).
    *   Real-time chat with artists.
*   **For Artists:**
    *   Manage weekly availability and hours.
    *   View and approve/decline booking requests (with full details).
    *   Search for guest spot booths at shops.
    *   AI-powered bio generation and service suggestions.
*   **For Shops:**
    *   List booths for rent.
    *   Manage incoming guest artists.

---

## ❓ Troubleshooting

**"AI service not configured" Error:**
*   **Cause:** The application cannot read your API key.
*   **Fix:** Ensure your `.env` file uses the variable name `VITE_GEMINI_API_KEY`.

**"Bucket not found" Error:**
*   **Cause:** Storage buckets weren't created.
*   **Fix:** Run the SQL script above.

**Guest Bookings not working:**
*   **Cause:** Database RLS policies preventing public inserts.
*   **Fix:** Run the SQL script above to update the policies.
