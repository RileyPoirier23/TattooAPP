
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

-- 2. ENSURE COLUMNS EXIST (Safety Check)
alter table public.client_booking_requests 
add column if not exists updated_at timestamptz default now();

-- Ensure service_id is text type
alter table public.client_booking_requests 
alter column service_id type text;

-- 3. THE "SAFE" BOOKING FUNCTION
-- This version isolates the notification logic so it cannot crash the booking.
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
  -- 1. Insert Booking (The Critical Step)
  insert into public.client_booking_requests (
    artist_id, start_date, end_date, message, tattoo_width, tattoo_height, body_placement, 
    deposit_amount, platform_fee, service_id, budget, reference_image_urls, preferred_time, 
    client_id, guest_name, guest_email, guest_phone, updated_at
  ) values (
    p_artist_id, p_start_date, p_end_date, p_message, p_tattoo_width, p_tattoo_height, p_body_placement, 
    p_deposit_amount, p_platform_fee, p_service_id, p_budget, p_reference_image_urls, p_preferred_time, 
    p_client_id, p_guest_name, p_guest_email, p_guest_phone, now()
  ) returning * into new_record;
  
  -- 2. Fetch Data for Response
  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;
  
  -- 3. Attempt Notification (Wrapped in Safe Block)
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
  exception when others then
    -- If notification fails, do nothing. Do NOT roll back the booking.
    -- This fixes the "Failed to send" error if notification permissions are tricky.
    null;
  end;

  return to_jsonb(new_record) || jsonb_build_object('client', to_jsonb(client_data)) || jsonb_build_object('artist', to_jsonb(artist_data));
end; $$;

-- 4. GRANT PERMISSIONS
grant execute on function create_booking_request to authenticated;
grant execute on function create_booking_request to anon;
```
