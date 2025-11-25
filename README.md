
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

-- 2. Create Storage Buckets (Idempotent)
insert into storage.buckets (id, name, public)
values 
  ('portfolios', 'portfolios', true),
  ('booking-references', 'booking-references', true),
  ('message_attachments', 'message_attachments', true)
on conflict (id) do nothing;

-- 3. Ensure Tables Exist
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text, full_name text, role text, city text, specialty text, bio text, 
  portfolio jsonb default '[]'::jsonb, socials jsonb default '{}'::jsonb, 
  hourly_rate numeric, services jsonb default '[]'::jsonb, aftercare_message text, 
  request_healed_photo boolean default false, hours jsonb default '{}'::jsonb, 
  intake_settings jsonb default '{"requireSize": true, "requireDescription": true, "requireLocation": true}'::jsonb, 
  is_verified boolean default false, 
  created_at timestamptz default now()
);

create table if not exists public.shops (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id),
  name text not null, location text, address text, lat double precision, lng double precision,
  amenities text[], image_url text, payment_methods jsonb, is_verified boolean default false,
  rating numeric default 0, average_artist_rating numeric default 0, reviews jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.booths (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade,
  name text not null, daily_rate numeric not null, photos text[], amenities text[], rules text,
  created_at timestamptz default now()
);

create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid references public.profiles(id),
  shop_id uuid references public.shops(id),
  booth_id uuid references public.booths(id),
  start_date date not null, end_date date not null, payment_status text default 'unpaid',
  total_amount numeric, platform_fee numeric, created_at timestamptz default now()
);

create table if not exists public.client_booking_requests (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id), -- Nullable for Guests
  artist_id uuid references public.profiles(id),
  start_date date, end_date date, message text, status text default 'pending',
  tattoo_width numeric, tattoo_height numeric, body_placement text, payment_status text default 'unpaid',
  deposit_amount numeric, deposit_paid_at timestamptz, platform_fee numeric, service_id text,
  budget numeric, reference_image_urls text[], preferred_time text, review_rating numeric,
  review_text text, review_submitted_at timestamptz,
  -- Guest Fields
  guest_name text, guest_email text, guest_phone text,
  created_at timestamptz default now()
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
  content text, attachment_url text, created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  message text not null, read boolean default false, created_at timestamptz default now()
);

create table if not exists public.verification_requests (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id),
  shop_id uuid references public.shops(id),
  type text check (type in ('artist', 'shop')),
  status text default 'pending', created_at timestamptz default now()
);

-- 4. UPDATE TABLES FOR GUEST & FOREIGN KEY STABILITY
-- This ensures the API can find relationships even for guests
do $$
begin
    -- Add guest columns if missing
    if not exists (select 1 from information_schema.columns where table_name = 'client_booking_requests' and column_name = 'guest_name') then
        alter table public.client_booking_requests add column guest_name text;
        alter table public.client_booking_requests add column guest_email text;
        alter table public.client_booking_requests add column guest_phone text;
    end if;
    
    -- Make client_id nullable
    alter table public.client_booking_requests alter column client_id drop not null;

    -- RECREATE FOREIGN KEYS WITH EXPLICIT NAMES (Crucial for API Joins)
    alter table public.client_booking_requests drop constraint if exists client_booking_requests_client_id_fkey;
    alter table public.client_booking_requests add constraint client_booking_requests_client_id_fkey foreign key (client_id) references public.profiles(id);
    
    alter table public.client_booking_requests drop constraint if exists client_booking_requests_artist_id_fkey;
    alter table public.client_booking_requests add constraint client_booking_requests_artist_id_fkey foreign key (artist_id) references public.profiles(id);
end $$;

-- 5. SECURE BOOKING FUNCTION (RPC)
-- This allows guests to create bookings and immediately get the ID back without RLS blocking the read.
create or replace function create_booking_request(
  p_artist_id uuid,
  p_start_date date,
  p_end_date date,
  p_message text,
  p_tattoo_width numeric,
  p_tattoo_height numeric,
  p_body_placement text,
  p_deposit_amount numeric,
  p_platform_fee numeric,
  p_service_id text,
  p_budget numeric,
  p_reference_image_urls text[],
  p_preferred_time text,
  p_client_id uuid default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null
) returns jsonb
language plpgsql security definer
as $$
declare
  new_record record;
  client_data record;
  artist_data record;
begin
  insert into public.client_booking_requests (
    artist_id, start_date, end_date, message, tattoo_width, tattoo_height, body_placement,
    deposit_amount, platform_fee, service_id, budget, reference_image_urls, preferred_time,
    client_id, guest_name, guest_email, guest_phone
  ) values (
    p_artist_id, p_start_date, p_end_date, p_message, p_tattoo_width, p_tattoo_height, p_body_placement,
    p_deposit_amount, p_platform_fee, p_service_id, p_budget, p_reference_image_urls, p_preferred_time,
    p_client_id, p_guest_name, p_guest_email, p_guest_phone
  ) returning * into new_record;

  -- Manually fetch relations to construct the response expected by the frontend
  -- This works even if the user is an anonymous guest
  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;

  return to_jsonb(new_record) 
    || jsonb_build_object('client', to_jsonb(client_data)) 
    || jsonb_build_object('artist', to_jsonb(artist_data));
end;
$$;

-- 6. RESET & APPLY RLS POLICIES
alter table public.profiles enable row level security;
alter table public.client_booking_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Profiles
drop policy if exists "Public profiles" on public.profiles;
create policy "Public profiles" on public.profiles for select using (true);
drop policy if exists "Users update own" on public.profiles;
create policy "Users update own" on public.profiles for update using (auth.uid() = id);
drop policy if exists "Users insert own" on public.profiles;
create policy "Users insert own" on public.profiles for insert with check (auth.uid() = id);

-- Bookings (Allow Public Insert for Guests)
drop policy if exists "Public request creation" on public.client_booking_requests;
create policy "Public request creation" on public.client_booking_requests for insert with check (true);

drop policy if exists "View requests" on public.client_booking_requests;
create policy "View requests" on public.client_booking_requests for select using (
  auth.uid() = artist_id OR auth.uid() = client_id
);

drop policy if exists "Update requests" on public.client_booking_requests;
create policy "Update requests" on public.client_booking_requests for update using (
  auth.uid() = client_id or auth.uid() = artist_id
);

-- Messaging
drop policy if exists "Conversation visibility" on public.conversations;
create policy "Conversation visibility" on public.conversations for select using (auth.uid() = participant_one_id or auth.uid() = participant_two_id);
drop policy if exists "Conversation create" on public.conversations;
create policy "Conversation create" on public.conversations for insert with check (auth.uid() = participant_one_id or auth.uid() = participant_two_id);

drop policy if exists "Message visibility" on public.messages;
create policy "Message visibility" on public.messages for select using (exists (select 1 from public.conversations where conversations.id = messages.conversation_id and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())));
drop policy if exists "Message create" on public.messages;
create policy "Message create" on public.messages for insert with check (auth.uid() = sender_id);

-- Storage (Allow Guests to Upload References)
drop policy if exists "Public upload refs" on storage.objects;
create policy "Public upload refs" on storage.objects for insert with check ( bucket_id = 'booking-references' );
drop policy if exists "Public view refs" on storage.objects;
create policy "Public view refs" on storage.objects for select using ( bucket_id = 'booking-references' );

-- 7. AUTO PROFILE TRIGGER
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
