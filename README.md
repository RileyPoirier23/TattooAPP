
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
-- 1. EXTENSIONS & SETUP
create extension if not exists "moddatetime" schema "extensions";

-- 2. TABLES & COLUMNS (Safe checks)
alter table public.profiles alter column hours type jsonb using hours::jsonb;
update public.profiles set hours = '{}'::jsonb where hours is null;
alter table public.profiles alter column hours set default '{}'::jsonb;

alter table public.client_booking_requests add column if not exists guest_name text;
alter table public.client_booking_requests add column if not exists guest_email text;
alter table public.client_booking_requests add column if not exists guest_phone text;
alter table public.client_booking_requests alter column client_id drop not null;

-- 3. RESET PERMISSIONS (Clean Slate)
do $$
begin
  drop policy if exists "Public profiles" on public.profiles;
  drop policy if exists "Users update own" on public.profiles;
  drop policy if exists "Users insert own" on public.profiles;
  drop policy if exists "Conversation visibility" on public.conversations;
  drop policy if exists "Conversation create" on public.conversations;
  drop policy if exists "Message visibility" on public.messages;
  drop policy if exists "Message create" on public.messages;
  drop policy if exists "Public request creation" on public.client_booking_requests;
  drop policy if exists "View requests" on public.client_booking_requests;
  drop policy if exists "Update requests" on public.client_booking_requests;
exception when others then null;
end $$;

-- 4. BASIC POLICIES
create policy "Public_profiles_v5" on public.profiles for select using (true);
create policy "Users_update_own_v5" on public.profiles for update using (auth.uid() = id);
create policy "Users_insert_own_v5" on public.profiles for insert with check (auth.uid() = id);

create policy "Public_request_creation_v5" on public.client_booking_requests for insert with check (true);
create policy "View_requests_v5" on public.client_booking_requests for select using (auth.uid() = artist_id OR auth.uid() = client_id);
create policy "Update_requests_v5" on public.client_booking_requests for update using (auth.uid() = artist_id OR auth.uid() = client_id);

-- 5. MESSAGING RPCs (The Fix)

-- A. Find or Create Conversation
create or replace function find_or_create_conversation(p_other_user_id uuid)
returns uuid
language plpgsql security definer
as $$
declare
  current_user_id uuid;
  conv_id uuid;
begin
  current_user_id := auth.uid();
  
  -- Try to find existing
  select id into conv_id from public.conversations
  where (participant_one_id = current_user_id and participant_two_id = p_other_user_id)
     or (participant_one_id = p_other_user_id and participant_two_id = current_user_id)
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  -- Create new
  insert into public.conversations (participant_one_id, participant_two_id)
  values (current_user_id, p_other_user_id)
  returning id into conv_id;

  return conv_id;
end;
$$;

-- B. Get My Conversations List
create or replace function get_my_conversations(p_user_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare
  result jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'participantOneId', c.participant_one_id,
      'participantTwoId', c.participant_two_id,
      'otherUser', jsonb_build_object(
        'id', p.id,
        'name', p.full_name
      )
    )
  )
  from public.conversations c
  join public.profiles p on p.id = case 
    when c.participant_one_id = p_user_id then c.participant_two_id 
    else c.participant_one_id 
  end
  where c.participant_one_id = p_user_id or c.participant_two_id = p_user_id
  into result;

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- C. Get Messages for Conversation
create or replace function get_messages(p_conversation_id uuid)
returns setof public.messages
language plpgsql security definer
as $$
begin
  if not exists (
    select 1 from public.conversations 
    where id = p_conversation_id 
    and (participant_one_id = auth.uid() or participant_two_id = auth.uid())
  ) then
    return;
  end if;

  return query select * from public.messages 
  where conversation_id = p_conversation_id 
  order by created_at asc;
end;
$$;

-- D. Send Message
create or replace function send_message(p_conversation_id uuid, p_content text, p_attachment_url text)
returns jsonb
language plpgsql security definer
as $$
declare
  new_message record;
begin
  if not exists (
    select 1 from public.conversations 
    where id = p_conversation_id 
    and (participant_one_id = auth.uid() or participant_two_id = auth.uid())
  ) then
    raise exception 'Not a participant';
  end if;

  insert into public.messages (conversation_id, sender_id, content, attachment_url)
  values (p_conversation_id, auth.uid(), p_content, p_attachment_url)
  returning * into new_message;

  return to_jsonb(new_message);
end;
$$;

-- 6. STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('booking-references', 'booking-references', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('portfolios', 'portfolios', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('message_attachments', 'message_attachments', true) on conflict (id) do nothing;

drop policy if exists "Public upload refs" on storage.objects;
drop policy if exists "Public view refs" on storage.objects;
create policy "Public_upload_refs_v5" on storage.objects for insert with check ( bucket_id = 'booking-references' );
create policy "Public_view_refs_v5" on storage.objects for select using ( bucket_id = 'booking-references' );

-- 7. BOOKING FUNCTION
create or replace function create_booking_request(
  p_artist_id uuid, p_start_date date, p_end_date date, p_message text, p_tattoo_width numeric, p_tattoo_height numeric,
  p_body_placement text, p_deposit_amount numeric, p_platform_fee numeric, p_service_id text, p_budget numeric,
  p_reference_image_urls text[], p_preferred_time text, p_client_id uuid default null, p_guest_name text default null,
  p_guest_email text default null, p_guest_phone text default null
) returns jsonb language plpgsql security definer as $$
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

  select id, full_name from public.profiles where id = new_record.client_id into client_data;
  select id, full_name, services from public.profiles where id = new_record.artist_id into artist_data;

  return to_jsonb(new_record) || jsonb_build_object('client', to_jsonb(client_data)) || jsonb_build_object('artist', to_jsonb(artist_data));
end;
$$;
```
