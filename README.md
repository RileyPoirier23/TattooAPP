
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

-- 3. ENABLE REALTIME
ALTER TABLE public.client_booking_requests REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

do $$
begin
  begin alter publication supabase_realtime add table public.client_booking_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
end $$;

-- 4. STORAGE SETUP (The Missing Piece for Messaging/Portfolios)
-- Ensure buckets exist
insert into storage.buckets (id, name, public) values ('portfolios', 'portfolios', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('message_attachments', 'message_attachments', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('booking-references', 'booking-references', true) on conflict (id) do nothing;

-- Portfolio Policies
drop policy if exists "Public_View_Portfolios" on storage.objects;
create policy "Public_View_Portfolios" on storage.objects for select using (bucket_id = 'portfolios');

drop policy if exists "Artists_Upload_Portfolios" on storage.objects;
create policy "Artists_Upload_Portfolios" on storage.objects for insert with check (bucket_id = 'portfolios' AND auth.role() = 'authenticated');

drop policy if exists "Artists_Delete_Portfolios" on storage.objects;
create policy "Artists_Delete_Portfolios" on storage.objects for delete using (bucket_id = 'portfolios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Message Attachment Policies
drop policy if exists "Authenticated_View_Attachments" on storage.objects;
create policy "Authenticated_View_Attachments" on storage.objects for select using (bucket_id = 'message_attachments' AND auth.role() = 'authenticated');

drop policy if exists "Authenticated_Upload_Attachments" on storage.objects;
create policy "Authenticated_Upload_Attachments" on storage.objects for insert with check (bucket_id = 'message_attachments' AND auth.role() = 'authenticated');

-- Booking Reference Policies
drop policy if exists "Public_Upload_Refs" on storage.objects;
create policy "Public_Upload_Refs" on storage.objects for insert with check (bucket_id = 'booking-references');
drop policy if exists "Public_View_Refs" on storage.objects;
create policy "Public_View_Refs" on storage.objects for select using (bucket_id = 'booking-references');

-- 5. THE FIXED BOOKING FUNCTION
-- Returns the FULL record (including client_id) + related data.
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
    client_id, guest_name, guest_email, guest_phone, updated_at
  ) values (
    p_artist_id, p_start_date, p_end_date, p_message, p_tattoo_width, p_tattoo_height, p_body_placement, 
    p_deposit_amount, p_platform_fee, p_service_id, p_budget, p_reference_image_urls, p_preferred_time, 
    p_client_id, p_guest_name, p_guest_email, p_guest_phone, now()
  ) returning * into new_record;
  
  -- 2. Fetch Related Data
  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;
  
  -- 3. Send Notification (Safe Block)
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
  exception when others then null; 
  end;

  -- 4. Return FULL Record + Relations (The Fix)
  return to_jsonb(new_record) || jsonb_build_object(
    'client', jsonb_build_object('id', client_data.id, 'full_name', client_data.full_name),
    'artist', jsonb_build_object('id', artist_data.id, 'full_name', artist_data.full_name, 'services', artist_data.services)
  );
end; $$;

grant execute on function create_booking_request to authenticated;
grant execute on function create_booking_request to anon;
```
