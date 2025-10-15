# InkSpace: Tattoo Booth & Artist Discovery Platform

InkSpace is a dual-platform application designed to revolutionize the tattoo industry. It serves as a B2B marketplace for tattoo artists to find and book booths at shops (like an Airbnb for tattoo spaces) and a B2C discovery tool for clients to find and book sessions with available artists in their city.

---

### Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
  - [For Artists](#for-artists)
  - [For Clients](#for-clients)
  - [For Shop Owners](#for-shop-owners)
  - [For Admins](#for-admins)
- [Tech Stack](#tech-stack)
- [Getting Started: Setup & Installation](#getting-started-setup--installation)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone the Repository](#2-clone-the-repository)
  - [3. Install Dependencies](#3-install-dependencies)
  - [4. Environment Variables](#4-environment-variables)
  - [5. Supabase Setup (Crucial)](#5-supabase-setup-crucial)
    - [A. Create Supabase Project](#a-create-supabase-project)
    - [B. Run the Database Schema SQL](#b-run-the-database-schema-sql)
    - [C. Set Up Supabase Storage](#c-set-up-supabase-storage)
  - [6. Running the Application](#6-running-the-application)
- [Troubleshooting Wiki](#troubleshooting-wiki)
  - [Connection Issues / "Failed to fetch"](#connection-issues--failed-to-fetch)
  - [Google Maps Not Loading](#google-maps-not-loading)
  - [Gemini AI Features Not Working](#gemini-ai-features-not-working)
  - [Image Uploads Fail](#image-uploads-fail)
  - [Authentication Errors (Login/Signup)](#authentication-errors-loginsignup)
- [Project Structure](#project-structure)
- [Future Roadmap](#future-roadmap)

---

## Project Overview

InkSpace addresses two major pain points in the tattoo industry: the difficulty for traveling artists to find temporary work, and the challenge for clients to discover artists who are currently available. By creating a centralized platform, InkSpace connects all sides of the market, fostering a more dynamic and accessible community.

## Key Features

### For Artists
- 🔎 **Shop Search:** Find and filter tattoo shops by city and name.
- 📅 **Booth Booking:** View available booths and book them directly through an interactive calendar.
- 🖼️ **Portfolio Management:** Upload and manage a personal portfolio of work.
- ✨ **AI Image Editor:** Edit portfolio images using text prompts powered by the Gemini API.
- ✍️ **AI Bio Generator:** Instantly create a professional and engaging artist bio.
- ✅ **Verification System:** Request and receive a "Verified Artist" badge to build trust.
- ⭐️ **Shop Reviews:** Rate and review shops after completing a booking.

### For Clients
- 🎨 **Artist Discovery:** Search for artists by name, city, and specialty.
- 👤 **Detailed Profiles:** View artist portfolios, bios, specialties, and client reviews.
- 🗓️ **Booking Requests:** Send detailed booking requests to artists for new tattoos.
- 💳 **Deposit Payments:** Securely pay booking deposits for approved appointments (simulated).
- 💬 **Direct Messaging:** Communicate with artists in real-time.

### For Shop Owners
- 🏠 **Shop Onboarding:** A guided flow to create and list a new shop on the platform.
- 📊 **Dashboard:** A central hub to manage shop details, payment methods, and booths.
- ✅ **Verification System:** Request shop verification to increase visibility and trust.
- 📈 **Review Management:** View reviews left by artists who have booked booths.

### For Admins
- 👑 **Admin Dashboard:** A comprehensive panel to view and manage all users, shops, bookings, and platform data.
- 🛡️ **Verification Management:** Approve or decline verification requests from artists and shops.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Backend-as-a-Service (BaaS):** Supabase (Database, Auth, Storage)
- **AI / Geolocation:**
  - Google Gemini API (for bio generation, image editing, and grounded search)
  - Google Maps Platform API (for maps, places search, and geolocation)

---

## Getting Started: Setup & Installation

Follow these steps carefully to get your local development environment running.

### 1. Prerequisites
- Node.js (v18 or later)
- A code editor (e.g., VS Code)

### 2. Clone the Repository
```bash
git clone <repository-url>
cd <repository-directory>
```

### 3. Install Dependencies
This project uses `npm`. Run the following command in the root directory:
```bash
npm install
```

### 4. Environment Variables
You need to create a `.env` file in the root of the project. Copy the contents of `.env.template` into it and fill in the values.

```env
# .env

# Supabase Credentials
# Get these from your Supabase project dashboard > Project Settings > API
VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_PUBLIC_ANON_KEY"

# Google Cloud API Keys
# Get these from the Google Cloud Console. Make sure both APIs are enabled.
VITE_API_KEY="YOUR_GEMINI_API_KEY"
VITE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
```

### 5. Supabase Setup (Crucial)

This is the most important part of the setup.

#### A. Create Supabase Project
1.  Go to [supabase.com](https://supabase.com/) and create a new project.
2.  Choose a strong database password and save it securely.
3.  Once the project is created, navigate to **Project Settings > API**.
4.  Copy the **Project URL** and the **`anon` `public` key**.
5.  Paste these into your `.env` file as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

#### B. Run the Database Schema SQL
1.  In your Supabase project, navigate to the **SQL Editor** from the left-hand menu.
2.  Click **+ New query**.
3.  Copy the entire SQL script below and paste it into the editor.
4.  Click the green **RUN** button. This will create all the necessary tables and security policies.

<details>
<summary>Click to view the full Supabase Schema SQL</summary>

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
  socials JSONB,
  hourly_rate NUMERIC -- For artists/dual
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
  rating NUMERIC, -- Client rating
  average_artist_rating NUMERIC DEFAULT 0,
  image_url TEXT,
  reviews JSONB, -- Artist reviews of the shop
  payment_methods JSONB,
  is_verified BOOLEAN DEFAULT false,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
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
  payment_status TEXT DEFAULT 'unpaid',
  total_amount NUMERIC,
  platform_fee NUMERIC,
  payment_intent_id TEXT
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
  review_submitted_at TIMESTAMPTZ,
  deposit_amount NUMERIC,
  platform_fee NUMERIC,
  payment_intent_id TEXT
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

-- Create verification_requests table
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'artist' or 'shop'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK ( (profile_id IS NOT NULL AND shop_id IS NULL AND type = 'artist') OR (profile_id IS NOT NULL AND shop_id IS NOT NULL AND type = 'shop') )
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
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;


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

DROP POLICY IF EXISTS "Shop owners can create their own shop" ON public.shops;
CREATE POLICY "Shop owners can create their own shop" ON public.shops FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Shop owners can update their own shop" ON public.shops;
CREATE POLICY "Shop owners can update their own shop" ON public.shops FOR UPDATE USING (auth.uid() = owner_id);

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

-- RLS Policies for Verification Requests
DROP POLICY IF EXISTS "Users can create their own verification requests" ON public.verification_requests;
CREATE POLICY "Users can create their own verification requests" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can see their own verification requests" ON public.verification_requests;
CREATE POLICY "Users can see their own verification requests" ON public.verification_requests FOR SELECT USING (auth.uid() = profile_id);

-- RLS Policies for Admins (Optional, for dev admin user)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "Admins can manage all shops" ON public.shops;
CREATE POLICY "Admins can manage all shops" ON public.shops FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "Admins can manage verification requests" ON public.verification_requests;
CREATE POLICY "Admins can manage verification requests" ON public.verification_requests FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));
```
</details>

#### C. Set Up Supabase Storage
The app requires two storage "buckets" for image uploads.
1.  Navigate to **Storage** from the left-hand menu.
2.  Click **+ New Bucket** and create a **public** bucket named `portfolios`.
3.  Click **+ New Bucket** again and create a **public** bucket named `message_attachments`.
4.  Next, you **must** create security policies for these buckets. Navigate to **Storage > Policies**.
5.  Create a new policy for the `portfolios` bucket with the following details:
    - **Policy Name:** `Allow authenticated uploads to portfolios`
    - **Allowed operations:** `SELECT`, `INSERT`, `UPDATE`
    - **Target roles:** `authenticated`
    - **Policy Definition (USING expression):** `(bucket_id = 'portfolios'::text)`
    - **Policy Definition (WITH CHECK expression):** `(bucket_id = 'portfolios'::text)`
6.  Create a new policy for the `message_attachments` bucket:
    - **Policy Name:** `Allow authenticated uploads to attachments`
    - **Allowed operations:** `SELECT`, `INSERT`
    - **Target roles:** `authenticated`
    - **Policy Definition (USING expression):** `(bucket_id = 'message_attachments'::text)`
    - **Policy Definition (WITH CHECK expression):** `(bucket_id = 'message_attachments'::text)`


### 6. Running the Application
Once your setup is complete, run the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## Troubleshooting Wiki

If you encounter issues, check here first.

### Connection Issues / "Failed to fetch"
This is the most common error and is almost always related to Supabase setup.

1.  **Check `.env` Variables:** Double-check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct and have no extra spaces or characters.
2.  **Check RLS Policies:** The error "Failed to fetch initial data" often means Row Level Security is blocking the app from reading public data. Go to **Authentication > Policies** in Supabase and ensure that you have policies enabling `SELECT` access for `public.profiles`, `public.shops`, etc., as defined in the schema script.
3.  **Check Browser Console:** Open your browser's developer tools (F12 or Ctrl+Shift+I) and look at the **Network** tab. If you see requests to Supabase failing with a 401 or 403 error, it confirms an authentication or RLS issue.

### Google Maps Not Loading
1.  **Check API Key:** Ensure `VITE_MAPS_API_KEY` in your `.env` is correct.
2.  **Enable APIs:** In your Google Cloud Console, make sure you have enabled the **Maps JavaScript API** and the **Places API**.
3.  **API Key Restrictions:** If you have restricted your API key, ensure your development URL (e.g., `localhost:5173`) is included in the allowed HTTP referrers.

### Gemini AI Features Not Working
1.  **Check API Key:** Ensure `VITE_API_KEY` in your `.env` is correct.
2.  **Enable API:** In your Google Cloud Console, make sure you have enabled the **Generative Language API** (also known as the Gemini API).

### Image Uploads Fail
This is almost always a Supabase Storage policy issue.
1.  **Public Buckets:** Confirm that both `portfolios` and `message_attachments` buckets exist and are marked as "Public".
2.  **Storage RLS Policies:** Go to **Storage > Policies** in your Supabase dashboard. Verify you have policies that allow `authenticated` users to perform `INSERT` operations on both buckets. Refer to the [Storage Setup](#c-set-up-supabase-storage) section for the exact policies.

### Authentication Errors (Login/Signup)
1.  **Email Confirmation:** By default, Supabase requires users to confirm their email. For development, you can disable this by going to **Authentication > Providers > Email** and turning off "Confirm email".
2.  **Check RLS for `profiles` Table:** A new user signup can fail if the RLS policy for `INSERT` on the `profiles` table is missing. The provided schema script includes this, but it's worth checking if you're having issues.

## Project Structure
-   `src/components/`: Contains all React components, organized by views, shared elements, and modals.
-   `src/hooks/`: Custom React hooks, including the main state management store (`useAppStore.ts`).
-   `src/services/`: Modules for interacting with external APIs (Supabase, Gemini, Google Maps).
-   `src/types.ts`: Centralized TypeScript type definitions for the entire application.
-   `src/data/`: Contains static data, such as dropdown options for forms.

## Future Roadmap
-   **Stripe Integration:** Implement real payment processing for booth rentals and client deposits.
-   **Advanced Search Filters:** Add more granular filters (e.g., artist ratings, shop amenities).
-   **Personalized Recommendations:** Use AI to suggest artists to clients and shops to artists.
-   **Push Notifications:** Implement real-time push notifications for a more engaging experience.
