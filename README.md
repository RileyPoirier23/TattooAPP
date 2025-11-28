
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

-- 2. RESET PROFILES PERMISSIONS (The Fix)
-- We are removing complex logic and simply saying: 
-- "If you are logged in, you can insert or update your own row."
alter table public.profiles enable row level security;

do $$
begin
  drop policy if exists "Public profiles" on public.profiles;
  drop policy if exists "Users update own" on public.profiles;
  drop policy if exists "Users insert own" on public.profiles;
  drop policy if exists "Profiles_Read_All" on public.profiles;
  drop policy if exists "Profiles_Insert_Own" on public.profiles;
  drop policy if exists "Profiles_Update_Own" on public.profiles;
  -- Clean up previous attempts
  drop policy if exists "Profiles_Insert_Update_Own" on public.profiles;
exception when others then null;
end $$;

-- Allow reading everyone
create policy "Profiles_Read_All" on public.profiles 
for select using (true);

-- Allow Insert/Update ONLY if the ID matches your Auth ID
create policy "Profiles_Insert_Update_Own" on public.profiles 
for all using (auth.uid() = id) with check (auth.uid() = id);

-- 3. ENSURE COLUMNS EXIST
alter table public.profiles alter column hours type jsonb using hours::jsonb;
alter table public.profiles alter column hours set default '{}'::jsonb;

-- 4. MESSAGING & BOOKING FUNCTIONS (Keep these as they are working logic)
create or replace function get_my_conversations_v2(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', c.id, 'participantOneId', c.participant_one_id, 'participantTwoId', c.participant_two_id, 'otherUser', jsonb_build_object('id', coalesce(p.id, '00000000-0000-0000-0000-000000000000'), 'name', coalesce(p.full_name, 'Unknown User'))))
  from public.conversations c left join public.profiles p on p.id = case when c.participant_one_id = p_user_id then c.participant_two_id else c.participant_one_id end
  where c.participant_one_id = p_user_id or c.participant_two_id = p_user_id into result;
  return coalesce(result, '[]'::jsonb);
end; $$;

create or replace function send_message(p_conversation_id uuid, p_content text default null, p_attachment_url text default null)
returns jsonb language plpgsql security definer as $$
declare new_message record;
begin
  if not exists (select 1 from public.conversations where id = p_conversation_id and (participant_one_id = auth.uid() or participant_two_id = auth.uid())) then raise exception 'Not a participant'; end if;
  insert into public.messages (conversation_id, sender_id, content, attachment_url) values (p_conversation_id, auth.uid(), p_content, p_attachment_url) returning * into new_message;
  return to_jsonb(new_message);
end; $$;

create or replace function get_messages(p_conversation_id uuid)
returns setof public.messages language plpgsql security definer as $$
begin
  if not exists (select 1 from public.conversations where id = p_conversation_id and (participant_one_id = auth.uid() or participant_two_id = auth.uid())) then return; end if;
  return query select * from public.messages where conversation_id = p_conversation_id order by created_at asc;
end; $$;

create or replace function create_booking_request(p_artist_id uuid, p_start_date date, p_end_date date, p_message text, p_tattoo_width numeric, p_tattoo_height numeric, p_body_placement text, p_deposit_amount numeric, p_platform_fee numeric, p_service_id text, p_budget numeric, p_reference_image_urls text[], p_preferred_time text, p_client_id uuid default null, p_guest_name text default null, p_guest_email text default null, p_guest_phone text default null) returns jsonb language plpgsql security definer as $$
declare new_record record; client_data record; artist_data record;
begin
  insert into public.client_booking_requests (artist_id, start_date, end_date, message, tattoo_width, tattoo_height, body_placement, deposit_amount, platform_fee, service_id, budget, reference_image_urls, preferred_time, client_id, guest_name, guest_email, guest_phone) values (p_artist_id, p_start_date, p_end_date, p_message, p_tattoo_width, p_tattoo_height, p_body_placement, p_deposit_amount, p_platform_fee, p_service_id, p_budget, p_reference_image_urls, p_preferred_time, p_client_id, p_guest_name, p_guest_email, p_guest_phone) returning * into new_record;
  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;
  return to_jsonb(new_record) || jsonb_build_object('client', to_jsonb(client_data)) || jsonb_build_object('artist', to_jsonb(artist_data));
end; $$;

-- 5. PERMISSIONS
grant execute on function get_my_conversations_v2 to authenticated;
grant execute on function send_message to authenticated;
grant execute on function get_messages to authenticated;
```
