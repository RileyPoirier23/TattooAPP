
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
-- 1. ENABLE EXTENSIONS
create extension if not exists "moddatetime" schema "extensions";

-- 2. RESET PROFILES TABLE (Columns)
-- Ensure 'hours' is JSONB.
alter table public.profiles alter column hours type jsonb using hours::jsonb;
alter table public.profiles alter column hours set default '{}'::jsonb;

-- 3. NUCLEAR OPTION: DROP ALL POLICIES
-- We drop everything to ensure no old, broken rules are blocking us.
do $$
begin
  drop policy if exists "Public profiles" on public.profiles;
  drop policy if exists "Users update own" on public.profiles;
  drop policy if exists "Users insert own" on public.profiles;
  drop policy if exists "Public_profiles_v4" on public.profiles;
  drop policy if exists "Users_update_own_v4" on public.profiles;
  drop policy if exists "Users_insert_own_v4" on public.profiles;
  drop policy if exists "Public_profiles_v5" on public.profiles;
  drop policy if exists "Users_update_own_v5" on public.profiles;
  drop policy if exists "Users_insert_own_v5" on public.profiles;
  -- Drop any other variations
  drop policy if exists "Enable read access for all users" on public.profiles;
  drop policy if exists "Enable insert for users based on user_id" on public.profiles;
  drop policy if exists "Enable update for users based on email" on public.profiles;
exception when others then null;
end $$;

-- 4. RE-APPLY CLEAN POLICIES (Profiles)
alter table public.profiles enable row level security;

create policy "Profiles_Read_All" on public.profiles 
for select using (true);

create policy "Profiles_Insert_Own" on public.profiles 
for insert with check (auth.uid() = id);

create policy "Profiles_Update_Own" on public.profiles 
for update using (auth.uid() = id);

-- 5. THE FIX: Save Availability Function (V7)
-- SECURITY DEFINER: Runs as admin, bypassing RLS for the upsert.
-- SEARCH_PATH: Fixes "relation not found" errors.
create or replace function save_artist_hours_v7(
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

  -- Upsert: Try to insert, if ID exists, update.
  insert into public.profiles (
    id, 
    username, 
    full_name, 
    role, 
    city, 
    hours
  )
  values (
    current_uid,
    coalesce(p_email, 'user@inkspace.app'), -- Fallback email
    coalesce(p_full_name, 'Artist'),        -- Fallback name
    'artist',
    coalesce(p_city, ''),
    p_hours
  )
  on conflict (id) do update
  set
    hours = EXCLUDED.hours,
    updated_at = now(),
    -- Also sync name/city if provided
    full_name = case when p_full_name is not null and p_full_name <> '' then EXCLUDED.full_name else public.profiles.full_name end,
    city = case when p_city is not null and p_city <> '' then EXCLUDED.city else public.profiles.city end
  returning * into updated_profile;

  return to_jsonb(updated_profile);
end;
$$;

-- 6. GRANT EXECUTE PERMISSIONS
grant execute on function save_artist_hours_v7 to authenticated;

-- 7. REPAIR MESSAGING (Ensure V2 exists)
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
grant execute on function get_my_conversations_v2 to authenticated;
```
