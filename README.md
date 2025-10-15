# InkSpace - Tattoo Booth & Artist Discovery Platform

InkSpace is a dual-platform application for the tattoo industry. The B2B side allows tattoo artists to find and book booths at shops, like an Airbnb for tattoo spaces. The B2C side enables clients to discover and book sessions with artists who are available in their city.

## Features

- **Dual View Modes:** Seamlessly switch between "For Artists" (finding booths) and "For Clients" (finding artists).
- **Interactive Search & Filtering:** Search for artists and shops by name, location, or specialty.
- **Google Maps Integration:** View shop locations on a dynamic, dark-mode map. Unverified local shops are pulled from Google Places to populate the map.
- **AI-Powered Features:**
  - **Gemini Bio Generation:** Artists can automatically generate a professional bio with one click.
  - **Gemini Shop Insights:** Get AI-powered summaries of shops using Google Search grounding for up-to-date information.
- **Full Booking System:**
  - Artists can book available booths by the day.
  - Clients can send detailed booking requests to artists.
- **User Profiles & Dashboards:** Dedicated views for artists, clients, and shop owners to manage their profiles, bookings, and listings.
- **Admin Panel:** A hidden "DevLogin" provides access to a dashboard to view all platform data.
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

#### Schema SQL

Copy and paste the entire block below into the SQL Editor and click **Run**.

```sql
-- Create the profiles table to store user data
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL,
  city TEXT,
  specialty TEXT,
  bio TEXT,
  portfolio TEXT[],
  is_verified BOOLEAN DEFAULT false
);

-- Create the shops table
CREATE TABLE shops (
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
CREATE TABLE booths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_rate NUMERIC NOT NULL
);

-- Create the bookings table for artists booking booths
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES auth.users(id),
  booth_id uuid REFERENCES booths(id),
  shop_id uuid REFERENCES shops(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_status TEXT DEFAULT 'unpaid'
);

-- Create the client_booking_requests table
CREATE TABLE client_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES auth.users(id),
  artist_id uuid REFERENCES auth.users(id),
  start_date DATE,
  end_date DATE,
  message TEXT,
  status TEXT DEFAULT 'pending',
  tattoo_size TEXT,
  body_placement TEXT,
  estimated_hours INTEGER,
  payment_status TEXT DEFAULT 'unpaid'
);

-- Create the notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create conversations table to link participants
CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_one_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    participant_two_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(participant_one_id, participant_two_id)
);

-- Create messages table
CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- Enable Row Level Security (RLS) for all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;


-- RLS Policies: Allow public read access
CREATE POLICY "Public read access for profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public read access for shops" ON shops FOR SELECT USING (true);
CREATE POLICY "Public read access for booths" ON booths FOR SELECT USING (true);
CREATE POLICY "Public read access for bookings" ON bookings FOR SELECT USING (true);

-- RLS Policies: Allow users to manage their own data
CREATE POLICY "Allow users to insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Allow users to update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow authenticated users to create bookings" ON bookings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow artists to view their own bookings" ON bookings FOR SELECT USING (auth.uid() = artist_id);
CREATE POLICY "Allow authenticated users to create client requests" ON client_booking_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow users to view their own client requests" ON client_booking_requests FOR SELECT USING (auth.uid() = client_id OR auth.uid() = artist_id);
CREATE POLICY "Allow users to manage their own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Messaging
CREATE POLICY "Users can view their own conversations" ON conversations FOR SELECT USING (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (
    conversation_id IN (
        SELECT id FROM conversations WHERE auth.uid() = participant_one_id OR auth.uid() = participant_two_id
    )
);
CREATE POLICY "Users can send messages in their conversations" ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
        SELECT id FROM conversations WHERE auth.uid() = participant_one_id OR auth.uid() = participant_two_id
    )
);

```

#### Storage Setup

1.  Go to the **Storage** section in your Supabase dashboard.
2.  Create a new bucket named `portfolios`.
3.  Go to **Policies** for the `portfolios` bucket and create the following policies:

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


### 5. Run the Application

Once your `.env` file is set up and your Supabase project is configured, you can start the development server.

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

---

## Troubleshooting

If you run into issues, check the following common problems.

- **Blank Screen on Startup:**
  - **Cause:** Missing or incorrect environment variables.
  - **Fix:** Ensure your `.env` file exists, is correctly named, and all keys are prefixed with `VITE_`. Verify that the keys from Supabase and Google Cloud are correct.

- **Signup Error: "Could not find the 'is_verified' column..."**
  - **Cause:** Your live `profiles` or `shops` table in Supabase is missing the `is_verified` column because it was created before the schema was updated.
  - **Fix:** Run the following SQL in your Supabase SQL Editor. This will safely add the column without deleting data.
    ```sql
    ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

    ALTER TABLE public.shops
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
    ```

- **Signup Fails with "new row violates row-level security policy"**
  - **Cause:** The RLS policy for inserting into the `profiles` table is missing or incorrect.
  - **Fix:** Go to your Supabase SQL Editor and ensure the policy `Allow users to insert their own profile` exists and is enabled. The definition should be `(auth.uid() = id)`.

- **Google Maps Error (e.g., "ApiNotActivatedMapError")**
  - **Cause:** The required Google Maps APIs are not enabled, or your API key is restricted.
  - **Fix:** In your Google Cloud Console, double-check that **Maps JavaScript API** and **Places API** are both enabled. Also, check the restrictions on your API key to ensure your local development URL (`localhost`) is allowed.

- **Image Uploads Fail:**
  - **Cause:** The Supabase Storage bucket is named incorrectly or the policies are wrong.
  - **Fix:** Ensure your bucket is named exactly `portfolios` (all lowercase). Verify the Storage policies allow public `SELECT` and authenticated `INSERT`.