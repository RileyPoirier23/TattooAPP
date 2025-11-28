
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
-- 1. FIX THE MISSING COLUMN (The Root Cause of "Failed to save")
alter table public.profiles 
add column if not exists updated_at timestamptz default now();

-- 2. ENSURE OTHER TABLES HAVE IT
alter table public.client_booking_requests 
add column if not exists updated_at timestamptz default now();

-- 3. REFRESH SCHEMA CACHE
-- This forces Supabase/PostgREST to recognize the new columns immediately.
NOTIFY pgrst, 'reload config';

-- 4. VERIFY HOURS COLUMN
-- Just double checking this is correct while we are here.
alter table public.profiles alter column hours type jsonb using hours::jsonb;
alter table public.profiles alter column hours set default '{}'::jsonb;

-- 5. RE-APPLY OPEN PERMISSIONS (Safety Net)
alter table public.profiles enable row level security;

-- Clear old policies to avoid conflicts
do $$
begin
  drop policy if exists "Profiles_Manage_Own" on public.profiles;
  drop policy if exists "Profiles_Read_All" on public.profiles;
  drop policy if exists "Profiles_Insert_Update_Own" on public.profiles;
exception when others then null;
end $$;

-- Apply fresh rules
create policy "Profiles_Manage_Own_V2" on public.profiles 
for all 
using (auth.uid() = id) 
with check (auth.uid() = id);

create policy "Profiles_Read_All_V2" on public.profiles 
for select 
using (true);
```
