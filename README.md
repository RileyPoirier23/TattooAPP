
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

-- 2. REPAIR MISSING PROFILES (The Critical Fix)
-- This takes everyone from auth.users and ensures they have a row in public.profiles
insert into public.profiles (id, username, full_name, role, city)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', 'User'), 
  coalesce(raw_user_meta_data->>'role', 'client'),
  coalesce(raw_user_meta_data->>'city', '')
from auth.users
on conflict (id) do nothing;

-- 3. UPDATED SAVE FUNCTION (Using Upsert)
create or replace function set_artist_hours_v2(
  p_hours jsonb
)
returns jsonb
language plpgsql security definer
as $$
declare
  updated_profile record;
begin
  -- Try to update, if missing (shouldn't happen with backfill, but safe), insert partial
  insert into public.profiles (id, hours, updated_at)
  values (auth.uid(), p_hours, now())
  on conflict (id) do update
  set hours = EXCLUDED.hours, updated_at = EXCLUDED.updated_at
  returning * into updated_profile;

  return to_jsonb(updated_profile);
end;
$$;

-- 4. ENSURE PERMISSIONS
grant execute on function set_artist_hours_v2 to authenticated;

-- Ensure RLS allows upserts
drop policy if exists "Users insert own" on public.profiles;
create policy "Users_insert_own_v7" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users update own" on public.profiles;
drop policy if exists "Users_update_own_v6" on public.profiles;
create policy "Users_update_own_v7" on public.profiles for update using (auth.uid() = id);

-- 5. MESSAGING FUNCTIONS (Ensuring they exist)
create or replace function get_my_conversations(p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare result jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', c.id, 'participantOneId', c.participant_one_id, 'participantTwoId', c.participant_two_id, 'otherUser', jsonb_build_object('id', p.id, 'name', p.full_name)))
  from public.conversations c
  join public.profiles p on p.id = case when c.participant_one_id = p_user_id then c.participant_two_id else c.participant_one_id end
  where c.participant_one_id = p_user_id or c.participant_two_id = p_user_id
  into result;
  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function send_message(p_conversation_id uuid, p_content text default null, p_attachment_url text default null)
returns jsonb language plpgsql security definer as $$
declare new_message record;
begin
  if not exists (select 1 from public.conversations where id = p_conversation_id and (participant_one_id = auth.uid() or participant_two_id = auth.uid())) then raise exception 'Not a participant'; end if;
  insert into public.messages (conversation_id, sender_id, content, attachment_url) values (p_conversation_id, auth.uid(), p_content, p_attachment_url) returning * into new_message;
  return to_jsonb(new_message);
end;
$$;

create or replace function get_messages(p_conversation_id uuid)
returns setof public.messages language plpgsql security definer as $$
begin
  if not exists (select 1 from public.conversations where id = p_conversation_id and (participant_one_id = auth.uid() or participant_two_id = auth.uid())) then return; end if;
  return query select * from public.messages where conversation_id = p_conversation_id order by created_at asc;
end;
$$;

-- 6. GRANT EXECUTE
grant execute on function get_my_conversations to authenticated;
grant execute on function send_message to authenticated;
grant execute on function get_messages to authenticated;
```
