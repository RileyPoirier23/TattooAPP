# InkSpace - Tattoo Booth & Artist Discovery Platform

InkSpace is a dual-platform application for the tattoo industry. The B2B side allows tattoo artists to find and book booths at shops, like an Airbnb for tattoo spaces. The B2C side enables clients to discover and book sessions with artists who are available in their city.

## Features

- **Dual View Modes:** Seamlessly switch between "For Artists" (finding booths) and "For Clients" (finding artists).
- **Interactive Search & Filtering:** Search for artists and shops by name, location, or specialty.
- **Google Maps Integration:** View shop locations on a dynamic, dark-mode map. Unverified local shops are pulled from Google Places to populate the map.
- **AI-Powered Features:**
  - **Gemini Bio Generation:** Artists can automatically generate a professional bio with one click.
  - **Gemini Shop Insights:** Get AI-powered summaries of shops using Google Search grounding for up-to-date information.
  - **Gemini Image Editing:** Artists can edit their portfolio images using text prompts. AI-edited images are clearly marked with an "AI" badge for transparency.
- **Full Booking System:**
  - Artists can book available booths by the day.
  - Clients can send detailed booking requests to artists.
- **User Profiles & Dashboards:** Dedicated views for artists, clients, and shop owners to manage their profiles, bookings, and listings.
- **Admin Panel:** A hidden "DevLogin" provides access to a dashboard to view and manage platform data.
- **Supabase Backend:** Fully integrated with Supabase for authentication, database, and storage.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **AI:** Google Gemini API
- **Maps & Location:** Google Maps JavaScript API, Google Places API

---

## Project Setup

Follow these steps to get the project running locally.

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- A Supabase account (free tier is sufficient)
- A Google Cloud Platform account with billing enabled (for Maps and Gemini APIs)

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/inkspace.git
cd inkspace
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

You need to create a `.env` file in the root of the project. Copy the contents of `.env.template` into a new file named `.env` and fill in the values.

```
# .env

# Supabase Credentials
# Find these in your Supabase project settings under "API"
VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# Google Cloud Credentials
# Find these in your Google Cloud Console under "APIs & Services > Credentials"
VITE_API_KEY="YOUR_GEMINI_API_KEY"
VITE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
```

**Getting Your Keys:**

1.  **Supabase:**
    *   Create a new project at [supabase.com](https://supabase.com).
    *   Navigate to **Project Settings > API**.
    *   Copy the **Project URL** and the `public` **anon key**.

2.  **Google Cloud:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project.
    *   Go to **APIs & Services > Library** and enable the following APIs:
        *   **Gemini API** (sometimes listed as "Generative Language API" or similar)
        *   **Maps JavaScript API**
        *   **Places API**
    *   Go to **APIs & Services > Credentials**.
    *   Create one API key for Gemini (`VITE_API_KEY`) and another for Google Maps (`VITE_MAPS_API_KEY`). **It is highly recommended to restrict these keys** to your domain or IP address for security.

### 4. Supabase Database & Storage Setup

You need to set up your database schema and storage bucket. Go to the **SQL Editor** in your Supabase dashboard and run the following queries.

**Important:** If you are re-running this setup, please first go to the **Table Editor** and delete all existing public tables (`profiles`, `shops`, `bookings`, etc.) to ensure a clean setup.

#### Schema SQL

Copy and paste the entire block below into the SQL Editor and click **Run**. This script is idempotent, meaning it's safe to run multiple times on a clean database.

```sql
-- Create the profiles table to store user data linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL,
  city TEXT,
  specialty TEXT,
  bio TEXT,
  portfolio JSONB,
  is_verified BOOLEAN DEFAULT false,
  socials JSONB
);

-- Create the shops table
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  amenities TEXT[],
  rating NUMERIC,
  image_url TEXT,
  reviews JSONB,
  payment_methods JSONB,
  is_verified BOOLEAN DEFAULT false
);

-- Create the booths table
CREATE TABLE IF NOT EXISTS public.booths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_rate NUMERIC NOT NULL,
  photos TEXT[],
  amenities TEXT[],
  rules TEXT
);

-- Create the bookings table for artists booking booths
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  booth_id uuid REFERENCES public.booths(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_status TEXT DEFAULT 'unpaid'
);

-- Create the client_booking_requests table
CREATE TABLE IF NOT EXISTS public.client_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  message TEXT,
  status TEXT DEFAULT 'pending',
  tattoo_size TEXT,
  body_placement TEXT,
  estimated_hours INTEGER,
  payment_status TEXT DEFAULT 'unpaid',
  review_rating INTEGER,
  review_text TEXT,
  review_submitted_at TIMESTAMPTZ
);

-- Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create conversations table to link participants
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_one_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_two_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(participant_one_id, participant_two_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create artist_availability table
CREATE TABLE IF NOT EXISTS public.artist_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  "date" DATE NOT NULL,
  status TEXT NOT NULL, -- e.g., 'available', 'unavailable'
  UNIQUE(artist_id, "date")
);


-- Enable Row Level Security (RLS) for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_availability ENABLE ROW LEVEL SECURITY;


-- RLS Policies: Allow public read access for essential data
DROP POLICY IF EXISTS "Public read access for profiles" ON public.profiles;
CREATE POLICY "Public read access for profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for shops" ON public.shops;
CREATE POLICY "Public read access for shops" ON public.shops FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for booths" ON public.booths;
CREATE POLICY "Public read access for booths" ON public.booths FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for bookings" ON public.bookings;
CREATE POLICY "Public read access for bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for artist_availability" ON public.artist_availability;
CREATE POLICY "Public read access for artist_availability" ON public.artist_availability FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for client booking requests" ON public.client_booking_requests;
CREATE POLICY "Public read access for client booking requests" ON public.client_booking_requests FOR SELECT USING (true);

-- RLS Policies: Allow users to manage their own data
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow authenticated users to create bookings" ON public.bookings;
CREATE POLICY "Allow authenticated users to create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow artists to view their own bookings" ON public.bookings;
CREATE POLICY "Allow artists to view their own bookings" ON public.bookings FOR SELECT USING (auth.uid() = artist_id);

DROP POLICY IF EXISTS "Allow authenticated users to create client requests" ON public.client_booking_requests;
CREATE POLICY "Allow authenticated users to create client requests" ON public.client_booking_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow users to view their own client requests" ON public.client_booking_requests;
CREATE POLICY "Allow users to view their own client requests" ON public.client_booking_requests FOR SELECT USING (auth.uid() = client_id OR auth.uid() = artist_id);

DROP POLICY IF EXISTS "Allow users to update their own client requests" ON public.client_booking_requests;
CREATE POLICY "Allow users to update their own client requests" ON public.client_booking_requests FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = artist_id);

DROP POLICY IF EXISTS "Allow users to manage their own notifications" ON public.notifications;
CREATE POLICY "Allow users to manage their own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Artists can manage their own availability" ON public.artist_availability;
CREATE POLICY "Artists can manage their own availability" ON public.artist_availability FOR ALL USING (auth.uid() = artist_id);

-- RLS Policies for Messaging
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT USING (
    conversation_id IN (
        SELECT id FROM public.conversations WHERE auth.uid() = participant_one_id OR auth.uid() = participant_two_id
    )
);

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations" ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
        SELECT id FROM public.conversations WHERE auth.uid() = participant_one_id OR auth.uid() = participant_two_id
    )
);

-- RLS Policies for Admins (Optional, for dev admin user)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "Admins can manage all shops" ON public.shops;
CREATE POLICY "Admins can manage all shops" ON public.shops FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));
```

#### Storage Setup

1.  Go to the **Storage** section in your Supabase dashboard.
2.  Create a new bucket named `portfolios`.
3.  Create a new bucket named `message_attachments`.
4.  Go to **Policies** for the `portfolios` bucket and create the following policies:

    *   **Allow public read access:**
        *   Policy Name: `Public Read Access`
        *   Allowed operations: `SELECT`
        *   Target roles: `anon`, `authenticated`
        *   Policy Definition: `true`

    *   **Allow authenticated users to upload:**
        *   Policy Name: `Authenticated Upload Access`
        *   Allowed operations: `INSERT`
        *   Target roles: `authenticated`
        *   Policy Definition: `bucket_id = 'portfolios'`
5. Go to **Policies** for the `message_attachments` bucket and create the following policies:
    *   **Allow public read access:**
        *   Policy Name: `Public Read Access for Attachments`
        *   Allowed operations: `SELECT`
        *   Target roles: `anon`, `authenticated`
        *   Policy Definition: `true`

    *   **Allow authenticated users to upload:**
        *   Policy Name: `Authenticated Upload for Attachments`
        *   Allowed operations: `INSERT`
        *   Target roles: `authenticated`
        *   Policy Definition: `bucket_id = 'message_attachments'`

### 5. Run the Application

Once your `.env` file is set up and your Supabase project is configured, you can start the development server.

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

---

## Troubleshooting

- **"Failed to fetch initial data from Supabase" on load:**
  - **Cause:** This is almost always a database schema or Row Level Security (RLS) issue. The initial, anonymous data fetch is being blocked.
  - **Fix:** Follow the setup instructions in Step 4 very carefully. If you've run the script before, **delete all your public tables** (`profiles`, `shops`, etc.) from the Supabase Table Editor and re-run the entire SQL script from this README. This ensures all tables and RLS policies are created correctly.

- **Blank Screen on Startup:**
  - **Cause:** Missing or incorrect environment variables.
  - **Fix:** Ensure your `.env` file exists, is correctly named, and all keys are prefixed with `VITE_`. Verify that the keys from Supabase and Google Cloud are correct.

- **Signup Fails with "new row violates row-level security policy"**
  - **Cause:** The RLS policy for inserting into the `profiles` table is missing or incorrect.
  - **Fix:** Go to your Supabase SQL Editor and ensure the policy `Allow users to insert their own profile` exists and is enabled. The definition should be `(auth.uid() = id)`.

- **Google Maps Error (e.g., "ApiNotActivatedMapError")**
  - **Cause:** The required Google Maps APIs are not enabled, or your API key is restricted.
  - **Fix:** In your Google Cloud Console, double-check that **Maps JavaScript API** and **Places API** are both enabled. Also, check the restrictions on your API key to ensure your local development URL (`localhost`) is allowed.

- **Image Uploads Fail:**
  - **Cause:** The Supabase Storage bucket is named incorrectly or the policies are wrong.
  - **Fix:** Ensure your bucket is named exactly `portfolios` (all lowercase). Verify the Storage policies allow public `SELECT` and authenticated `INSERT`.