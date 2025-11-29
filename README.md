
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
-- 1. EXTENSIONS
create extension if not exists "moddatetime" schema "extensions";

-- 2. FORCE FOREIGN KEY NAMES (The "Empty Dashboard" Fix)
-- We find and rename the connections to match exactly what the API expects.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'client_booking_requests'
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.client_booking_requests DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '"';
    END LOOP;
END $$;

-- Re-create with EXACT names required by apiService.ts
ALTER TABLE public.client_booking_requests
ADD CONSTRAINT client_booking_requests_client_id_fkey
FOREIGN KEY (client_id) REFERENCES public.profiles(id);

ALTER TABLE public.client_booking_requests
ADD CONSTRAINT client_booking_requests_artist_id_fkey
FOREIGN KEY (artist_id) REFERENCES public.profiles(id);

-- 3. SCHEMA REPAIR
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles alter column hours type jsonb using hours::jsonb;
alter table public.profiles alter column hours set default '{}'::jsonb;
alter table public.profiles add column if not exists subscription_tier text default 'free';

alter table public.client_booking_requests add column if not exists updated_at timestamptz default now();
alter table public.client_booking_requests add column if not exists guest_name text;
alter table public.client_booking_requests add column if not exists guest_email text;
alter table public.client_booking_requests add column if not exists guest_phone text;
alter table public.client_booking_requests add column if not exists preferred_time text;
alter table public.client_booking_requests add column if not exists budget numeric;
alter table public.client_booking_requests add column if not exists reference_image_urls text[] default array[]::text[];
alter table public.client_booking_requests alter column service_id type text;
alter table public.client_booking_requests alter column client_id drop not null; -- Allow Guests

-- 4. CREATE REPORTS TABLE
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id),
  target_id text not null, -- Can be a User ID or Booking ID
  type text check (type in ('user', 'booking')),
  reason text,
  status text default 'pending', -- pending, resolved, dismissed
  details text,
  created_at timestamptz default now()
);

-- 5. RESET PERMISSIONS
alter table public.profiles enable row level security;
alter table public.client_booking_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

do $$
begin
  drop policy if exists "Profiles_Read_All" on public.profiles;
  drop policy if exists "Profiles_Manage_Own" on public.profiles;
  drop policy if exists "Bookings_Public_Insert" on public.client_booking_requests;
  drop policy if exists "Bookings_View_Own" on public.client_booking_requests;
  drop policy if exists "Bookings_Update_Own" on public.client_booking_requests;
  drop policy if exists "Notif_View_Own" on public.notifications;
  drop policy if exists "Notif_Create_Public" on public.notifications;
  drop policy if exists "Notif_Update_Own" on public.notifications;
  drop policy if exists "Public_Upload_Refs" on storage.objects;
  drop policy if exists "Public_View_Refs" on storage.objects;
  drop policy if exists "Reports_Insert_Authenticated" on public.reports;
  drop policy if exists "Reports_View_All" on public.reports;
  drop policy if exists "Reports_Update_All" on public.reports;
exception when others then null;
end $$;

-- Policies
create policy "Profiles_Read_All" on public.profiles for select using (true);
create policy "Profiles_Manage_Own" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Bookings_Public_Insert" on public.client_booking_requests for insert with check (true);
create policy "Bookings_View_Own" on public.client_booking_requests for select using (auth.uid() = artist_id OR auth.uid() = client_id);
create policy "Bookings_Update_Own" on public.client_booking_requests for update using (auth.uid() = artist_id OR auth.uid() = client_id);

create policy "Notif_View_Own" on public.notifications for select using (auth.uid() = user_id);
create policy "Notif_Create_Public" on public.notifications for insert with check (true);
create policy "Notif_Update_Own" on public.notifications for update using (auth.uid() = user_id);

-- Reports Policies
create policy "Reports_Insert_Authenticated" on public.reports for insert with check (auth.role() = 'authenticated');
create policy "Reports_View_All" on public.reports for select using (true); 
create policy "Reports_Update_All" on public.reports for update using (true);

-- Storage
insert into storage.buckets (id, name, public) values ('booking-references', 'booking-references', true) on conflict (id) do nothing;
create policy "Public_Upload_Refs" on storage.objects for insert with check (bucket_id = 'booking-references');
create policy "Public_View_Refs" on storage.objects for select using (bucket_id = 'booking-references');

-- 6. BOOKING RPC (Returns Full Data for Dashboard)
create or replace function create_booking_request(
  p_artist_id uuid, p_start_date date, p_end_date date, p_message text, 
  p_tattoo_width numeric, p_tattoo_height numeric, p_body_placement text, 
  p_deposit_amount numeric, p_platform_fee numeric, p_service_id text, 
  p_budget numeric, p_reference_image_urls text[], p_preferred_time text, 
  p_client_id uuid default null, p_guest_name text default null, 
  p_guest_email text default null, p_guest_phone text default null
) returns jsonb language plpgsql security definer as $$
declare 
  new_record record; 
  client_data record; 
  artist_data record;
  display_name text;
begin
  -- Insert
  insert into public.client_booking_requests (
    artist_id, start_date, end_date, message, tattoo_width, tattoo_height, body_placement, 
    deposit_amount, platform_fee, service_id, budget, reference_image_urls, preferred_time, 
    client_id, guest_name, guest_email, guest_phone, updated_at
  ) values (
    p_artist_id, p_start_date, p_end_date, p_message, p_tattoo_width, p_tattoo_height, p_body_placement, 
    p_deposit_amount, p_platform_fee, p_service_id, p_budget, p_reference_image_urls, p_preferred_time, 
    p_client_id, p_guest_name, p_guest_email, p_guest_phone, now()
  ) returning * into new_record;
  
  -- Fetch Data
  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;
  
  -- Notify
  begin
    if p_guest_name is not null and p_guest_name != '' then
      display_name := p_guest_name || ' (Guest)';
    elsif client_data.full_name is not null then
      display_name := client_data.full_name;
    else
      display_name := 'A client';
    end if;
    insert into public.notifications (user_id, message, read)
    values (p_artist_id, 'New booking request from ' || display_name, false);
  exception when others then null; end;

  -- Return Full Data
  return to_jsonb(new_record) || jsonb_build_object(
    'client', jsonb_build_object('id', client_data.id, 'full_name', client_data.full_name),
    'artist', jsonb_build_object('id', artist_data.id, 'full_name', artist_data.full_name, 'services', artist_data.services)
  );
end; $$;

grant execute on function create_booking_request to authenticated;
grant execute on function create_booking_request to anon;

-- 7. REFRESH
NOTIFY pgrst, 'reload config';
```
