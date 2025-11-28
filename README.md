
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

-- 2. RESET ALL POLICIES (Scorched Earth Policy)
-- We drop everything to ensure no conflicting logic remains.
do $$
begin
  -- Drop Profile Policies
  drop policy if exists "Public profiles" on public.profiles;
  drop policy if exists "Users update own" on public.profiles;
  drop policy if exists "Profiles_Read_All" on public.profiles;
  drop policy if exists "Profiles_Manage_Own" on public.profiles;
  drop policy if exists "Profiles_Insert_Update_Own" on public.profiles;
  drop policy if exists "Simple_Read_All" on public.profiles;
  drop policy if exists "Simple_Update_Own" on public.profiles;
  drop policy if exists "Simple_Insert_Own" on public.profiles;
  
  -- Drop Booking Policies
  drop policy if exists "Bookings_Create_Public" on public.client_booking_requests;
  drop policy if exists "Bookings_View_Own" on public.client_booking_requests;
  drop policy if exists "Bookings_Update_Own" on public.client_booking_requests;

  -- Drop Notification Policies
  drop policy if exists "Notif_Read_Own" on public.notifications;
  drop policy if exists "Notif_Create_Public" on public.notifications;
  drop policy if exists "Notif_Update_Own" on public.notifications;
exception when others then null;
end $$;

-- 3. PROFILE POLICIES (The Availability Fix)
alter table public.profiles enable row level security;

-- Everyone can read profiles
create policy "Profiles_Read_All" on public.profiles for select using (true);

-- You can Insert/Update your own profile.
create policy "Profiles_Manage_Own" on public.profiles 
for all 
using (auth.uid() = id) 
with check (auth.uid() = id);

-- 4. BOOKING POLICIES (Guest Support)
alter table public.client_booking_requests enable row level security;

-- ANYONE (Guest or User) can create a booking request
create policy "Bookings_Create_Public" on public.client_booking_requests 
for insert 
with check (true);

-- Artists/Clients can view their own
create policy "Bookings_View_Own" on public.client_booking_requests 
for select 
using (auth.uid() = artist_id OR auth.uid() = client_id);

-- Artists/Clients can update status
create policy "Bookings_Update_Own" on public.client_booking_requests 
for update 
using (auth.uid() = artist_id OR auth.uid() = client_id);

-- 5. NOTIFICATION POLICIES (The "Pop up" Fix)
alter table public.notifications enable row level security;

-- Users can see their own notifications
create policy "Notif_Read_Own" on public.notifications for select using (auth.uid() = user_id);

-- ANYONE can create a notification (Critical for Client -> Artist alerts)
create policy "Notif_Create_Public" on public.notifications 
for insert 
with check (true);

-- Users can mark as read
create policy "Notif_Update_Own" on public.notifications for update using (auth.uid() = user_id);

-- 6. DATA INTEGRITY
alter table public.profiles alter column hours type jsonb using hours::jsonb;
alter table public.profiles alter column hours set default '{}'::jsonb;

-- 7. KEEP RPCs ONLY FOR COMPLEX JOINS (Messaging/Booking)
-- We keep these because they handle complex data joining that is hard to do client-side.
create or replace function get_my_conversations_v2(p_user_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin select jsonb_agg(jsonb_build_object('id', c.id, 'participantOneId', c.participant_one_id, 'participantTwoId', c.participant_two_id, 'otherUser', jsonb_build_object('id', coalesce(p.id, '00000000-0000-0000-0000-000000000000'), 'name', coalesce(p.full_name, 'Unknown User')))) from public.conversations c left join public.profiles p on p.id = case when c.participant_one_id = p_user_id then c.participant_two_id else c.participant_one_id end where c.participant_one_id = p_user_id or c.participant_two_id = p_user_id into result; return coalesce(result, '[]'::jsonb); end; $$;
grant execute on function get_my_conversations_v2 to authenticated;

create or replace function create_booking_request(p_artist_id uuid, p_start_date date, p_end_date date, p_message text, p_tattoo_width numeric, p_tattoo_height numeric, p_body_placement text, p_deposit_amount numeric, p_platform_fee numeric, p_service_id text, p_budget numeric, p_reference_image_urls text[], p_preferred_time text, p_client_id uuid default null, p_guest_name text default null, p_guest_email text default null, p_guest_phone text default null) returns jsonb language plpgsql security definer as $$
declare new_record record; client_data record; artist_data record;
begin insert into public.client_booking_requests (artist_id, start_date, end_date, message, tattoo_width, tattoo_height, body_placement, deposit_amount, platform_fee, service_id, budget, reference_image_urls, preferred_time, client_id, guest_name, guest_email, guest_phone) values (p_artist_id, p_start_date, p_end_date, p_message, p_tattoo_width, p_tattoo_height, p_body_placement, p_deposit_amount, p_platform_fee, p_service_id, p_budget, p_reference_image_urls, p_preferred_time, p_client_id, p_guest_name, p_guest_email, p_guest_phone) returning * into new_record; select id, full_name from public.profiles where id = new_record.client_id into client_data; select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data; return to_jsonb(new_record) || jsonb_build_object('client', to_jsonb(client_data)) || jsonb_build_object('artist', to_jsonb(artist_data)); end; $$;
grant execute on function create_booking_request to authenticated;
```
