
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

-- 2. STORAGE (Idempotent)
insert into storage.buckets (id, name, public)
values 
  ('portfolios', 'portfolios', true),
  ('booking-references', 'booking-references', true),
  ('message_attachments', 'message_attachments', true)
on conflict (id) do nothing;

-- 3. SCHEMA FIXES (Columns)
-- Ensure guest columns and hours exist
alter table public.profiles add column if not exists hours jsonb default '{}'::jsonb;
alter table public.client_booking_requests add column if not exists guest_name text;
alter table public.client_booking_requests add column if not exists guest_email text;
alter table public.client_booking_requests add column if not exists guest_phone text;
alter table public.client_booking_requests alter column client_id drop not null;

-- 4. CLEANUP POLICIES (Aggressive Reset)
drop policy if exists "Public profiles" on public.profiles;
drop policy if exists "Users update own" on public.profiles;
drop policy if exists "Users insert own" on public.profiles;
drop policy if exists "Public request creation" on public.client_booking_requests;
drop policy if exists "View requests" on public.client_booking_requests;
drop policy if exists "Update requests" on public.client_booking_requests;
drop policy if exists "Conversation visibility" on public.conversations;
drop policy if exists "Conversation create" on public.conversations;
drop policy if exists "Message visibility" on public.messages;
drop policy if exists "Message create" on public.messages;
drop policy if exists "Public upload refs" on storage.objects;
drop policy if exists "Public view refs" on storage.objects;

-- 5. APPLY ROBUST POLICIES

-- Profiles
create policy "Public profiles" on public.profiles for select using (true);
create policy "Users update own" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own" on public.profiles for insert with check (auth.uid() = id);

-- Booking Requests
create policy "Public request creation" on public.client_booking_requests for insert with check (true);
create policy "View requests" on public.client_booking_requests for select using (
  auth.uid() = artist_id OR auth.uid() = client_id
);
create policy "Update requests" on public.client_booking_requests for update using (
  auth.uid() = artist_id OR auth.uid() = client_id
);

-- Messaging (Simplified)
create policy "Conversation visibility" on public.conversations for select using (
  auth.uid() = participant_one_id OR auth.uid() = participant_two_id
);
create policy "Conversation create" on public.conversations for insert with check (
  auth.uid() = participant_one_id OR auth.uid() = participant_two_id
);

create policy "Message visibility" on public.messages for select using (
  exists (
    select 1 from public.conversations 
    where id = messages.conversation_id 
    and (participant_one_id = auth.uid() or participant_two_id = auth.uid())
  )
);
create policy "Message create" on public.messages for insert with check (auth.uid() = sender_id);

-- Storage
create policy "Public upload refs" on storage.objects for insert with check ( bucket_id = 'booking-references' );
create policy "Public view refs" on storage.objects for select using ( bucket_id = 'booking-references' );

-- 6. RPC FUNCTION (The Booking Engine)
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

  -- Fetch relations manually to construct the response
  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;

  return to_jsonb(new_record) 
    || jsonb_build_object('client', to_jsonb(client_data)) 
    || jsonb_build_object('artist', to_jsonb(artist_data));
end;
$$;
```
