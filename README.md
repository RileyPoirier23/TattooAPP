
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

-- 2. AVAILABILITY: Save Hours (V6 - Client Authority)
-- Explicitly accepts email from client to prevent NULL violations.
-- Sets search_path to ensure public table visibility.
create or replace function save_artist_hours_v6(
  p_hours jsonb,
  p_full_name text,
  p_city text,
  p_email text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  updated_profile record;
  current_uid uuid;
begin
  current_uid := auth.uid();

  insert into public.profiles (
    id, username, full_name, role, city, hours
  )
  values (
    current_uid,
    p_email, -- Use the email passed from client
    coalesce(p_full_name, 'Artist'),
    'artist',
    coalesce(p_city, ''),
    p_hours
  )
  on conflict (id) do update
  set
    hours = EXCLUDED.hours,
    updated_at = now(),
    -- Only update these if provided, otherwise keep existing
    full_name = case when p_full_name is not null and p_full_name <> '' then EXCLUDED.full_name else public.profiles.full_name end,
    city = case when p_city is not null and p_city <> '' then EXCLUDED.city else public.profiles.city end,
    username = case when p_email is not null and p_email <> '' then EXCLUDED.username else public.profiles.username end
  returning * into updated_profile;

  return to_jsonb(updated_profile);
end;
$$;

-- 3. MESSAGING: Get Conversations (V2 - Re-apply for safety)
create or replace function get_my_conversations_v2(p_user_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
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
        'id', coalesce(p.id, '00000000-0000-0000-0000-000000000000'),
        'name', coalesce(p.full_name, 'Unknown User')
      )
    )
  )
  from public.conversations c
  left join public.profiles p on p.id = case 
    when c.participant_one_id = p_user_id then c.participant_two_id 
    else c.participant_one_id 
  end
  where c.participant_one_id = p_user_id or c.participant_two_id = p_user_id
  into result;

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- 4. PERMISSIONS
grant execute on function save_artist_hours_v6 to authenticated;
grant execute on function get_my_conversations_v2 to authenticated;
grant execute on function send_message to authenticated;
grant execute on function get_messages to authenticated;
```
