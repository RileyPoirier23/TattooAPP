# InkSpace: Tattoo Booth & Artist Discovery Platform

InkSpace is a dual-platform application designed to revolutionize the tattoo industry. It serves as a B2B marketplace for tattoo artists to find and book booths at shops (like an Airbnb for tattoo spaces) and a B2C discovery tool for clients to find and book sessions with available artists in their city.

---

### Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [URL Routing Structure](#url-routing-structure)
- [Tech Stack](#tech-stack)
- [Getting Started: Setup & Installation](#getting-started-setup--installation)
- [Supabase SQL Setup](#supabase-sql-setup)
- [Troubleshooting Wiki](#troubleshooting-wiki)
- [Project Structure](#project-structure)
- [Next Generation Roadmap](#next-generation-roadmap)

---

## Project Overview

InkSpace addresses two major pain points in the tattoo industry: the difficulty for traveling artists to find temporary work, and the challenge for clients to discover artists who are currently available. By creating a centralized platform with dedicated routing and a polished UI, InkSpace connects all sides of the market, fostering a more dynamic and accessible community.

## Key Features

### For Artists
- 🔎 **Advanced Shop Search:** Find and filter tattoo shops by city, name, and specific amenities via the `/shops` route.
- ✨ **AI Recommendations:** Get personalized shop recommendations based on your location and specialty.
- 📅 **Booth Booking:** View available booths and book them directly through an interactive calendar.
- 💳 **Secure Stripe Payments:** A professional, secure Stripe-powered interface for booth rental payments (simulated).
- 🖼️ **Portfolio Management:** Upload and manage a personal portfolio on your dedicated `/profile` page.
- ✨ **AI Image Editor:** Edit portfolio images using text prompts powered by the Gemini API.
- ✍️ **AI Bio Generator:** Instantly create a professional and engaging artist bio.
- ✅ **Verification System:** Request and receive a "Verified Artist" badge to build trust.
- ⭐️ **Shop Reviews:** Rate and review shops after completing a booking.
- 🗓️ **Availability Calendar:** Manage your schedule on the `/availability` page.

### For Clients
- 🎨 **Advanced Artist Discovery:** Search for artists by name, city, specialty, and average client rating on the `/artists` route.
- ✨ **AI Recommendations:** Receive personalized artist suggestions based on your location and preferences.
- 👤 **Detailed Profiles:** View artist portfolios, bios, specialties, and client reviews.
- 🗓️ **Booking Requests:** Send detailed booking requests to artists for new tattoos.
- 💳 **Secure Stripe Deposits:** Securely pay booking deposits via a professional, Stripe-powered payment interface (simulated).
- 💬 **Direct Messaging:** Communicate with artists in real-time on the fully mobile-responsive `/messages` page.
- 🔔 **Live Notifications:** Get instant alerts for booking updates without needing to refresh the page.
- 📚 **Booking Management:** Track all your active and past bookings on the `/bookings` page.

### For Shop Owners
- 🏠 **Shop Onboarding:** A guided flow at `/onboarding` to create and list a new shop.
- 📊 **Dashboard:** A central hub at `/dashboard` to manage shop details, payment methods, and booths.
- ✅ **Verification System:** Request shop verification to increase visibility and trust.
- 📈 **Review Management:** View reviews left by artists who have booked booths.

### For Admins
- 👑 **Comprehensive Admin Dashboard:** A powerful panel at `/admin` to view and manage all platform data.
- 📝 **Direct Editing:** Click to edit any user or shop's details directly from the dashboard.
- ⚡ **Quick Verification:** Instantly verify or unverify users and shops with a single click.
- 📈 **Platform Analytics:** View key metrics like total users, shops, and pending verifications at a glance.

## URL Routing Structure
The application now uses a client-side router to provide a multi-page experience:
- `/`: Homepage with hero section.
- `/artists`: Client search view for finding artists.
- `/shops`: Artist search view for finding shops.
- `/profile`: The logged-in user's personal profile page.
- `/bookings`: A dashboard for viewing and managing all personal bookings.
- `/availability`: For artists to manage their calendar.
- `/messages`: The main messaging interface.
- `/messages/:id`: A specific, linkable conversation.
- `/settings`: User account settings.
- `/dashboard`: The dashboard for Shop Owners.
- `/admin`: The dashboard for Administrators.
- `/onboarding`: The setup flow for new Shop Owners.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Routing:** Custom React Hook using Browser History API
- **Styling:** Tailwind CSS (fully responsive design with animations)
- **State Management:** Zustand
- **Backend-as-a-Service (BaaS):** Supabase (Database, Auth, Storage)
- **Payments:** Stripe.js
- **AI / Geolocation:**
  - Google Gemini API
  - Google Maps Platform API

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

# Stripe Publishable Key
# Get this from your Stripe dashboard > Developers > API keys
VITE_STRIPE_PUBLISHABLE_KEY="YOUR_STRIPE_PUBLISHABLE_KEY"
```

### 5. Supabase Setup (Crucial)
Go to the **[Supabase SQL Setup](#supabase-sql-setup)** section below. Copy the entire SQL script and run it in your Supabase project's SQL Editor. This will create all necessary tables and security policies.

### 6. Running the Application
Once your setup is complete, run the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## Supabase SQL Setup

This is the complete script to set up your Supabase database.

**Instructions:**
1.  Navigate to your Supabase Project.
2.  Go to the **SQL Editor** in the sidebar.
3.  Click **"New query"**.
4.  Copy the entire script below and paste it into the editor.
5.  Click **"RUN"**. This will create all tables and set up the required security policies.

---

### **Full Setup Script**

```sql
-- =================================================================
-- 0. RESET SCRIPT
-- WARNING: This script will delete all existing data in the tables.
-- It is designed for a clean setup. Do not run on a production database with live data.
-- =================================================================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.client_booking_requests CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.booths CASCADE;
DROP TABLE IF EXISTS public.artist_availability CASCADE;
DROP TABLE IF EXISTS public.verification_requests CASCADE;
DROP TABLE IF EXISTS public.shops CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();


-- =================================================================
-- 1. USER PROFILES TABLE
-- Stores public user data, linked to the private auth.users table.
-- =================================================================
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    full_name text,
    role text DEFAULT 'client'::text NOT NULL,
    city text,
    specialty text,
    bio text,
    portfolio jsonb DEFAULT '[]'::jsonb,
    socials jsonb,
    hourly_rate integer,
    services jsonb DEFAULT '[]'::jsonb,
    aftercare_message text,
    request_healed_photo boolean DEFAULT false,
    is_verified boolean DEFAULT false NOT NULL,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT profiles_username_key UNIQUE (username)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 1.A. NEW USER TRIGGER
-- This function and trigger automatically create a profile for new users,
-- resolving the RLS issue on signup.
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role, city, specialty, bio)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'role',
    CASE
      WHEN new.raw_user_meta_data->>'role' IN ('artist', 'dual')
      THEN new.raw_user_meta_data->>'city'
      ELSE NULL
    END,
    CASE
      WHEN new.raw_user_meta_data->>'role' IN ('artist', 'dual')
      THEN 'New Artist'
      ELSE NULL
    END,
    CASE
      WHEN new.raw_user_meta_data->>'role' IN ('artist', 'dual')
      THEN 'An artist based in ' || COALESCE(new.raw_user_meta_data->>'city', 'a new city') || '.'
      ELSE NULL
    END
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =================================================================
-- 1.B. PROFILES RLS POLICIES
-- =================================================================
-- Allow users to see all artist and dual-role profiles (for search).
CREATE POLICY "Enable public read access for artists" ON public.profiles FOR SELECT USING (role = ANY (ARRAY['artist'::text, 'dual'::text]));
-- Allow users to see their own profile.
CREATE POLICY "Enable read access for authenticated user on own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- Allow users to update their own profile.
CREATE POLICY "Enable update for users based on user_id" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- =================================================================
-- 2. SHOPS TABLE
-- Stores information about tattoo shops.
-- =================================================================
CREATE TABLE public.shops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    address text,
    lat double precision,
    lng double precision,
    amenities text[],
    rating integer,
    image_url text,
    payment_methods jsonb,
    reviews jsonb DEFAULT '[]'::jsonb,
    is_verified boolean DEFAULT false NOT NULL,
    owner_id uuid,
    average_artist_rating double precision DEFAULT 0,
    CONSTRAINT shops_pkey PRIMARY KEY (id),
    CONSTRAINT shops_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view all shops.
CREATE POLICY "Enable public read access for all shops" ON public.shops FOR SELECT USING (true);
-- Allow shop owners to create a shop.
CREATE POLICY "Enable insert for authenticated shop owners" ON public.shops FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text AND auth.uid() = owner_id);
-- Allow shop owners to update their own shop.
CREATE POLICY "Enable update for shop owners" ON public.shops FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);


-- =================================================================
-- 3. BOOTHS TABLE
-- Stores information about individual booths within a shop.
-- =================================================================
CREATE TABLE public.booths (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    name text NOT NULL,
    daily_rate numeric NOT NULL,
    photos text[],
    amenities text[],
    rules text,
    CONSTRAINT booths_pkey PRIMARY KEY (id),
    CONSTRAINT booths_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE
);
ALTER TABLE public.booths ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view all booths.
CREATE POLICY "Enable public read access for all booths" ON public.booths FOR SELECT USING (true);
-- Allow authenticated users to create booths (shop owner logic is in API).
CREATE POLICY "Enable insert for authenticated users" ON public.booths FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
-- Allow authenticated users to update booths (shop owner logic is in API).
CREATE POLICY "Enable update for authenticated users" ON public.booths FOR UPDATE USING (auth.role() = 'authenticated'::text);
-- Allow authenticated users to delete booths (shop owner logic is in API).
CREATE POLICY "Enable delete for authenticated users" ON public.booths FOR DELETE USING (auth.role() = 'authenticated'::text);


-- =================================================================
-- 4. BOOKINGS TABLE (ARTIST-TO-SHOP)
-- =================================================================
CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artist_id uuid NOT NULL,
    booth_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    payment_status text DEFAULT 'unpaid'::text,
    total_amount numeric,
    platform_fee numeric,
    CONSTRAINT bookings_pkey PRIMARY KEY (id),
    CONSTRAINT bookings_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT bookings_booth_id_fkey FOREIGN KEY (booth_id) REFERENCES public.booths(id) ON DELETE CASCADE,
    CONSTRAINT bookings_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own bookings.
CREATE POLICY "Enable read for user's own bookings" ON public.bookings FOR SELECT USING (auth.uid() = artist_id);
-- Allow artists to create bookings for themselves.
CREATE POLICY "Enable insert for artists" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = artist_id);


-- =================================================================
-- 5. CLIENT BOOKING REQUESTS TABLE (CLIENT-TO-ARTIST)
-- =================================================================
CREATE TABLE public.client_booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    artist_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    tattoo_width numeric,
    tattoo_height numeric,
    body_placement text,
    payment_status text DEFAULT 'unpaid'::text,
    review_rating integer,
    review_text text,
    review_submitted_at timestamp with time zone,
    deposit_amount numeric,
    deposit_paid_at timestamp with time zone,
    platform_fee numeric,
    service_id text,
    budget numeric,
    reference_image_urls text[],
    CONSTRAINT client_booking_requests_pkey PRIMARY KEY (id),
    CONSTRAINT client_booking_requests_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT client_booking_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.client_booking_requests ENABLE ROW LEVEL SECURITY;

-- Allow involved parties to see the request.
CREATE POLICY "Enable read for involved users" ON public.client_booking_requests FOR SELECT USING (auth.uid() = client_id OR auth.uid() = artist_id);
-- Allow clients to create requests.
CREATE POLICY "Enable insert for clients" ON public.client_booking_requests FOR INSERT WITH CHECK (auth.uid() = client_id);
-- Allow involved parties to update the request (e.g., status change, review).
CREATE POLICY "Enable update for involved users" ON public.client_booking_requests FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = artist_id);


-- =================================================================
-- 6. ARTIST AVAILABILITY TABLE
-- =================================================================
CREATE TABLE public.artist_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artist_id uuid NOT NULL,
    date date NOT NULL,
    status text NOT NULL,
    CONSTRAINT artist_availability_pkey PRIMARY KEY (id),
    CONSTRAINT artist_availability_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT artist_availability_artist_id_date_key UNIQUE (artist_id, date)
);
ALTER TABLE public.artist_availability ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view artist availability.
CREATE POLICY "Enable public read access for availability" ON public.artist_availability FOR SELECT USING (true);
-- Allow artists to manage their own availability.
CREATE POLICY "Enable insert/update for artist on own availability" ON public.artist_availability FOR ALL USING (auth.uid() = artist_id);


-- =================================================================
-- 7. NOTIFICATIONS TABLE
-- =================================================================
CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own notifications.
CREATE POLICY "Enable access for user's own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);


-- =================================================================
-- 8. CONVERSATIONS & MESSAGES TABLES
-- =================================================================
CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participant_one_id uuid NOT NULL,
    participant_two_id uuid NOT NULL,
    CONSTRAINT conversations_pkey PRIMARY KEY (id),
    CONSTRAINT conversations_participant_one_id_fkey FOREIGN KEY (participant_one_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT conversations_participant_two_id_fkey FOREIGN KEY (participant_two_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text,
    attachment_url text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
    CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow participants to see their conversations and messages.
CREATE POLICY "Enable access for conversation participants" ON public.conversations FOR ALL USING (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);
CREATE POLICY "Enable access for message participants" ON public.messages FOR ALL USING (
    (SELECT conversation_id FROM public.messages WHERE id = messages.id) IN (
        SELECT id FROM public.conversations WHERE (participant_one_id = auth.uid() OR participant_two_id = auth.uid())
    )
);


-- =================================================================
-- 9. VERIFICATION REQUESTS TABLE
-- =================================================================
CREATE TABLE public.verification_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    shop_id uuid,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT verification_requests_pkey PRIMARY KEY (id),
    CONSTRAINT verification_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT verification_requests_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE SET NULL
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create requests.
CREATE POLICY "Enable insert for authenticated users" ON public.verification_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
-- For simplicity in this project, allow authenticated users to see all requests (an admin would normally be the only one).
CREATE POLICY "Enable read for authenticated users" ON public.verification_requests FOR SELECT USING (auth.role() = 'authenticated'::text);
-- Allow authenticated users to update requests (admin logic is in the app).
CREATE POLICY "Enable update for authenticated users" ON public.verification_requests FOR UPDATE USING (auth.role() = 'authenticated'::text);


-- =================================================================
-- 10. STORAGE BUCKETS AND POLICIES
-- Create these in the Supabase Dashboard under Storage.
-- =================================================================
-- Instructions:
-- 1. Go to Storage > Buckets > Create Bucket.
-- 2. Create the following buckets and make them PUBLIC.
--    - portfolios
--    - booking-references
--    - message_attachments
-- 3. For each bucket, go to its "Policies" tab and add the policies below.

-- Policy for `portfolios` bucket:
-- "Allow authenticated users to upload their own portfolio images."
-- TARGET ROLES: authenticated
-- ALLOWED OPERATIONS: SELECT, INSERT, UPDATE
-- USING expression: (bucket_id = 'portfolios' AND (storage.foldername(name))[1] = (auth.uid())::text)
-- WITH CHECK expression: (bucket_id = 'portfolios' AND (storage.foldername(name))[1] = (auth.uid())::text)

-- Policy for `booking-references` bucket:
-- "Allow authenticated users to upload reference images."
-- TARGET ROLES: authenticated
-- ALLOWED OPERATIONS: SELECT, INSERT
-- USING expression: (bucket_id = 'booking-references')
-- WITH CHECK expression: (bucket_id = 'booking-references')

-- Policy for `message_attachments` bucket:
-- "Allow authenticated users to upload message attachments."
-- TARGET ROLES: authenticated
-- ALLOWED OPERATIONS: SELECT, INSERT
-- USING expression: (bucket_id = 'message_attachments')
-- WITH CHECK expression: (bucket_id = 'message_attachments')
```

---

## Troubleshooting Wiki

If you encounter issues, check here first.

### Connection Issues / "Failed to fetch"
This is the most common error and is almost always related to Supabase setup.

1.  **Run the SQL Setup Script:** The definitive solution is to use the complete script provided in the **[Supabase SQL Setup](#supabase-sql-setup)** section above. This script creates all tables and, most importantly, applies the correct Row Level Security (RLS) policies that allow the app to fetch public data (like artists and shops) before a user logs in.
2.  **Check `.env` Variables:** After running the script, double-check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your `.env` file are correct and have no extra spaces. For a deployed app (like on Vercel), ensure these are set as **Environment Variables** in the project settings.
3.  **Check Browser Console:** Open your browser's developer tools (F12 or Ctrl+Shift+I) and look at the **Network** tab. If you see requests to Supabase failing with a 401 or 403 error, it confirms an authentication or RLS issue that should be resolved by the setup script.

### Google Maps Not Loading
1.  **Check API Key:** Ensure `VITE_MAPS_API_KEY` in your `.env` or deployment variables is correct.
2.  **Enable APIs:** In your Google Cloud Console, make sure you have enabled the **Maps JavaScript API** and the **Places API**.
3.  **API Key Restrictions:** If you have restricted your API key, ensure your development or deployment URL (e.g., `inkspacebooking.vercel.app`) is included in the allowed HTTP referrers.

### Gemini AI Features Not Working
1.  **Check API Key:** Ensure `VITE_API_KEY` (for Gemini) is set correctly.
2.  **Enable API:** In your Google Cloud Console, make sure you have enabled the **Generative Language API** (also known as the Gemini API).

### Image Uploads Fail
This is almost always a Supabase Storage policy issue.
1.  **Public Buckets:** Confirm that your storage buckets (`portfolios`, `booking-references`, etc.) exist and are marked as "Public".
2.  **Storage RLS Policies:** Go to **Storage > Policies** in your Supabase dashboard. Verify you have policies that allow `authenticated` users to perform `INSERT` (upload) operations on all relevant buckets, as described in the SQL Setup section.

### Authentication Errors (Login/Signup)
1.  **Email Confirmation:** By default, Supabase requires users to confirm their email. For development, you can disable this by going to **Authentication > Providers > Email** and turning off "Confirm email".
2.  **RLS Policy Violation on Signup:** If you see an error about "violates row-level security policy for table 'profiles'", it means the automatic profile creation trigger is failing. Ensure you have run the **latest** version of the SQL Setup Script, as this contains the necessary function and trigger.

## Project Structure
-   `src/components/`: Contains all React components, organized by views, shared elements, and modals.
-   `src/hooks/`: Custom React hooks, including the main state management store (`useAppStore.ts`) and the new client-side router (`useRouter.ts`).
-   `src/services/`: Modules for interacting with external APIs (Supabase, Gemini, Google Maps).
-   `src/types.ts`: Centralized TypeScript type definitions for the entire application.
-   `src/data/`: Contains static data, such as dropdown options for forms.

## Next Generation Roadmap
With the core platform now complete, future development can focus on advanced growth and community features:
-   **Real-time Collaboration Tools:** Implement a shared canvas or design space where artists and clients can collaborate on tattoo concepts.
-   **Advanced Analytics Dashboard:** Provide shop owners with detailed analytics on booth occupancy rates, revenue trends, and artist performance.
-   **Community Forum & Events:** Create a dedicated space for artists to share techniques and for shops to post events or workshops.
-   **Gamification & Achievements:** Introduce badges for artists (e.g., "Road Warrior") and clients (e.g., "Collector") to encourage platform engagement.