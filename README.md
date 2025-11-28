
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

-- 2. SMART SAVE FUNCTION (V3 - The Fix)
create or replace function save_artist_hours_v3(
  p_hours jsonb
)
returns jsonb
language plpgsql security definer
as $$
declare
  updated_profile record;
  user_meta jsonb;
  user_email text;
begin
  -- 1. Try to update existing profile
  update public.profiles 
  set hours = p_hours, updated_at = now()
  where id = auth.uid()
  returning * into updated_profile;

  -- 2. If update found a row, return it
  if found then
    return to_jsonb(updated_profile);
  end if;

  -- 3. If NO row found, we must create one. 
  -- We fetch details from auth.users to avoid "column cannot be null" errors.
  select raw_user_meta_data, email into user_meta, user_email
  from auth.users
  where id = auth.uid();

  insert into public.profiles (
    id, 
    username, 
    full_name, 
    role, 
    city, 
    hours
  )
  values (
    auth.uid(),
    user_email,
    coalesce(user_meta->>'full_name', 'Artist'),
    coalesce(user_meta->>'role', 'artist'),
    coalesce(user_meta->>'city', ''),
    p_hours
  )
  returning * into updated_profile;

  return to_jsonb(updated_profile);
end;
$$;

-- 3. GRANT PERMISSION
grant execute on function save_artist_hours_v3 to authenticated;

-- 4. ENSURE MESSAGING FUNCTIONS EXIST (Just in case)
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

-- 5. GRANT EXECUTE
grant execute on function get_my_conversations to authenticated;
grant execute on function send_message to authenticated;
grant execute on function get_messages to authenticated;
```
