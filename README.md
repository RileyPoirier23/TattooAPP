
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

-- 2. REFRESH SCHEMA & PERMISSIONS
NOTIFY pgrst, 'reload config';

alter table public.profiles enable row level security;
alter table public.client_booking_requests enable row level security;
alter table public.notifications enable row level security;

-- Simple, open policies for maximum compatibility
drop policy if exists "Profiles_Read_All_V4" on public.profiles;
create policy "Profiles_Read_All_V4" on public.profiles for select using (true);

drop policy if exists "Profiles_Manage_Own_V4" on public.profiles;
create policy "Profiles_Manage_Own_V4" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Bookings_Public_Insert_V4" on public.client_booking_requests;
create policy "Bookings_Public_Insert_V4" on public.client_booking_requests for insert with check (true);

drop policy if exists "Bookings_View_Own_V4" on public.client_booking_requests;
create policy "Bookings_View_Own_V4" on public.client_booking_requests for select using (auth.uid() = artist_id OR auth.uid() = client_id);

drop policy if exists "Bookings_Update_Own_V4" on public.client_booking_requests;
create policy "Bookings_Update_Own_V4" on public.client_booking_requests for update using (auth.uid() = artist_id OR auth.uid() = client_id);

drop policy if exists "Notif_View_Own_V4" on public.notifications;
create policy "Notif_View_Own_V4" on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "Notif_Insert_Public_V4" on public.notifications;
create policy "Notif_Insert_Public_V4" on public.notifications for insert with check (true);

drop policy if exists "Notif_Update_Own_V4" on public.notifications;
create policy "Notif_Update_Own_V4" on public.notifications for update using (auth.uid() = user_id);


-- 3. ENHANCED BOOKING FUNCTION (With Notification Trigger)
-- This function creates the booking AND alerts the artist in one step.
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
  -- 1. Insert Booking
  insert into public.client_booking_requests (
    artist_id, start_date, end_date, message, tattoo_width, tattoo_height, body_placement, 
    deposit_amount, platform_fee, service_id, budget, reference_image_urls, preferred_time, 
    client_id, guest_name, guest_email, guest_phone
  ) values (
    p_artist_id, p_start_date, p_end_date, p_message, p_tattoo_width, p_tattoo_height, p_body_placement, 
    p_deposit_amount, p_platform_fee, p_service_id, p_budget, p_reference_image_urls, p_preferred_time, 
    p_client_id, p_guest_name, p_guest_email, p_guest_phone
  ) returning * into new_record;
  
  -- 2. Fetch Data for Response
  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;
  
  -- 3. Determine Name for Notification
  if p_guest_name is not null and p_guest_name != '' then
    display_name := p_guest_name || ' (Guest)';
  elsif client_data.full_name is not null then
    display_name := client_data.full_name;
  else
    display_name := 'A client';
  end if;

  -- 4. Create Notification for Artist (The "Pop up" Fix)
  insert into public.notifications (user_id, message, read)
  values (p_artist_id, 'New booking request from ' || display_name, false);

  return to_jsonb(new_record) || jsonb_build_object('client', to_jsonb(client_data)) || jsonb_build_object('artist', to_jsonb(artist_data));
end; $$;

grant execute on function create_booking_request to authenticated;
grant execute on function create_booking_request to anon;
```