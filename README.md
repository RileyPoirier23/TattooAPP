# InkSpace - Tattoo Booth & Artist Discovery (V2 - Backend Ready)

InkSpace is a dual-platform application for the tattoo industry. This version has been significantly upgraded to be backend-ready, with a complete guide to integrating a Supabase database and storage for full functionality.

---

## Table of Contents

1.  [Prerequisites](#prerequisites)
2.  [Local Setup Instructions](#local-setup-instructions)
3.  [Backend Integration with Supabase (Crucial!)](#backend-integration-with-supabase-crucial)
4.  [Troubleshooting](#troubleshooting)
5.  [Deployment Guide](#deployment-guide)
6.  [Project Structure](#project-structure)

---

## Prerequisites

Before you begin, ensure you have the following software installed on your Windows 11 machine.

1.  **Node.js & npm:** This project is built on Node.js.
    *   **To Install:** Download the LTS version from the [official Node.js website](https://nodejs.org/).
    *   **To Verify:** Open a terminal and run `node -v` and `npm -v`.

2.  **Git:** Required for cloning the project repository.
    *   **To Install:** Download from the [Git for Windows website](https://git-scm.com/download/win).

3.  **A Code Editor:** We recommend [Visual Studio Code](https://code.visualstudio.com/).

---

## Local Setup Instructions

Follow these steps to get the application running on your local machine.

### Step 1: Clone the Repository

1.  Open your terminal (e.g., PowerShell).
2.  Navigate to your projects directory: `cd C:\Users\YourUser\Documents\Projects`.
3.  Clone the repository: `git clone <YOUR_REPOSITORY_URL> inkspace`
4.  Navigate into the project folder: `cd inkspace`

### Step 2: Install Project Dependencies

The `package.json` file lists all the necessary libraries for this project. Instead of a `requirements.txt` file (which is for Python projects), Node.js projects use `npm` to manage dependencies.

1.  In the project's root directory, run:
    ```bash
    npm install
    ```
    This command reads `package.json` and installs all required packages.

### Step 3: Configure Environment Variables

This is the most critical step. The application needs several secret keys to connect to Google and Supabase services.

1.  In the root of the project, create a new file named `.env`.
2.  Open `.env` and paste the following content. **Note the `VITE_` prefix is required.**

    ```
    # Google Gemini API Key for AI features
    VITE_API_KEY=YOUR_GEMINI_API_KEY_HERE

    # Google Maps API Key for interactive maps
    VITE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE

    # Supabase credentials (get these from your Supabase project dashboard)
    VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
    ```

3.  **Get Your Google API Keys:**
    *   **`VITE_API_KEY` (Gemini):** Go to [Google AI Studio](https://aistudio.google.com/app/apikey) to create and copy your key.
    *   **`VITE_MAPS_API_KEY` (Google Maps):** Go to the [Google Cloud Console](https://console.cloud.google.com/), create a key, and **enable the "Maps JavaScript API"** for it.

4.  **Get Your Supabase Keys:** You will get these in the next section when you set up the backend.

### Step 4: Run the Development Server

1.  In your terminal, from the project root, run:
    ```bash
    npm run dev
    ```
2.  Open your web browser and navigate to the local address provided (usually `http://localhost:5173`). The app will run, but most features will not work until the Supabase backend is connected.

---

## Backend Integration with Supabase (Crucial!)

This section guides you through creating a live backend, which will make all features of the application fully functional.

### Step 1: Create a Supabase Project

1.  Go to [supabase.com](https://supabase.com/) and create an account or sign in.
2.  Click "New project" and give it a name (e.g., `inkspace-app`).
3.  Choose a region close to you (e.g., `Canada (Central)`).
4.  Wait for your new project to be provisioned.

### Step 2: Set Up Supabase Database Tables

1.  In your Supabase project dashboard, navigate to the **SQL Editor**.
2.  Click **+ New query**.
3.  Copy the entire SQL script from the expandable section below and paste it into the SQL Editor.
4.  Click **RUN**. This will create all the necessary tables and relationships for the app.

<details>
<summary><strong>Click to expand the full SQL Schema Script</strong></summary>

```sql
-- Profiles table to store public user data, linked to auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client', -- 'artist', 'client', 'shop-owner', 'dual'
  city TEXT, -- Primarily for artists
  specialty TEXT, -- Primarily for artists
  bio TEXT, -- Primarily for artists
  portfolio TEXT[], -- Array of image URLs
  is_verified BOOLEAN DEFAULT FALSE
);

-- Shops table
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  amenities TEXT[],
  rating FLOAT,
  image_url TEXT,
  payment_methods JSONB,
  is_verified BOOLEAN DEFAULT FALSE
);

-- Booths table, linked to shops
CREATE TABLE booths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_rate INT NOT NULL
);

-- Bookings table (for artists booking booths)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  booth_id UUID REFERENCES booths(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' -- 'unpaid', 'paid'
);

-- Client booking requests table
CREATE TABLE client_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  message TEXT,
  tattoo_size TEXT,
  body_placement TEXT,
  estimated_hours INT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'declined'
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
);

-- Notifications table
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (examples to get you started)
-- Profiles are viewable by everyone
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- Users can only update their own profile
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- All users can view shops and booths
CREATE POLICY "Shops are viewable by everyone." ON shops FOR SELECT USING (true);
CREATE POLICY "Booths are viewable by everyone." ON booths FOR SELECT USING (true);

-- Authenticated users can create bookings
CREATE POLICY "Authenticated users can create bookings." ON bookings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Users can view their own bookings
CREATE POLICY "Users can view their own bookings." ON bookings FOR SELECT USING (auth.uid() = artist_id);

-- Add more RLS policies as needed for security!

```
</details>

### Step 3: Set Up Supabase Storage

1.  In your Supabase dashboard, go to **Storage**.
2.  Click **Create a new bucket**.
3.  Name the bucket `portfolios` and make it a **Public** bucket.
4.  Click **Create Bucket**.
5.  Navigate into your new `portfolios` bucket and click on **Bucket Settings**.
6.  You will need to add Policies to allow artists to upload their work. This is an advanced topic, but a simple starting point is to allow authenticated users to upload to their own folder.

### Step 4: Connect Your App to Supabase

1.  In your Supabase dashboard, go to **Project Settings** (the gear icon).
2.  Click on **API**.
3.  Find your **Project URL** and **Project API Keys** (use the `anon` `public` key).
4.  Copy these two values and paste them into your `.env` file from [Local Setup Step 3](#step-3-configure-environment-variables).

    ```
    VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
    ```

### Step 5: Implement the Backend Logic

The application's frontend is ready. You just need to replace the placeholder functions in `/services/apiService.ts` with real Supabase calls.

1.  **Install the Supabase client library:**
    ```bash
    npm install @supabase/supabase-js
    ```
2.  **Create a Supabase client file:** Create a new file `/services/supabaseClient.ts` and add:
    ```typescript
    import { createClient } from '@supabase/supabase-js';

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL and Anon Key must be provided in .env');
    }

    export const supabase = createClient(supabaseUrl, supabaseAnonKey);
    ```
3.  **Replace the code in `/services/apiService.ts`** with the code from the expandable section below. This code uses the Supabase client to interact with the database you just created.

<details>
<summary><strong>Click to expand the full apiService.ts code</strong></summary>

```typescript
// @/services/apiService.ts
import { supabase } from './supabaseClient';
import type { Artist, Shop, Booth, Booking, ClientBookingRequest, Notification } from '../types';

// NOTE: This file assumes you have set up the Supabase database schema from the README.

export const fetchInitialData = async () => {
    const { data: artists, error: artistsError } = await supabase.from('profiles').select('*').in('role', ['artist', 'dual']);
    const { data: shops, error: shopsError } = await supabase.from('shops').select('*');
    const { data: booths, error: boothsError } = await supabase.from('booths').select('*');
    const { data: bookings, error: bookingsError } = await supabase.from('bookings').select('*');

    if (artistsError || shopsError || boothsError || bookingsError) {
        console.error({ artistsError, shopsError, boothsError, bookingsError });
        throw new Error('Failed to fetch initial data from Supabase.');
    }
    
    // The database schema is slightly different from the mock types, so we adapt it here.
    const adaptedArtists = artists.map(profile => ({
        id: profile.id,
        name: profile.full_name,
        specialty: profile.specialty,
        portfolio: profile.portfolio,
        city: profile.city,
        bio: profile.bio,
    }));

    return { 
        artists: adaptedArtists, 
        shops, 
        booths, 
        bookings,
        clientBookingRequests: [], // You can fetch these if needed on specific pages
        notifications: [] // Fetched per user
    };
};

export const updateArtistData = async (artistId: string, updatedData: Partial<Artist>): Promise<Artist> => {
    // Adapt frontend data model to backend schema
    const profileUpdate: { [key: string]: any } = {};
    if (updatedData.name) profileUpdate.full_name = updatedData.name;
    if (updatedData.specialty) profileUpdate.specialty = updatedData.specialty;
    if (updatedData.bio) profileUpdate.bio = updatedData.bio;
    if (updatedData.city) profileUpdate.city = updatedData.city;
    if (updatedData.portfolio) profileUpdate.portfolio = updatedData.portfolio;

    const { data, error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', artistId)
        .select()
        .single();

    if (error) throw error;
    
    return {
        id: data.id,
        name: data.full_name,
        specialty: data.specialty,
        portfolio: data.portfolio,
        city: data.city,
        bio: data.bio,
    };
};

export const uploadPortfolioImage = async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, file);
    
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('portfolios').getPublicUrl(fileName);
    return data.publicUrl;
};

// ... Implement all other functions (updateShop, addBooth, createBooking, etc.) using Supabase calls
// Example for createBooking:
export const createBookingForArtist = async (bookingData: Omit<Booking, 'id'>): Promise<Booking> => {
    const { data, error } = await supabase
        .from('bookings')
        .insert({
            artist_id: bookingData.artistId,
            booth_id: bookingData.boothId,
            shop_id: bookingData.shopId,
            start_date: bookingData.startDate,
            end_date: bookingData.endDate,
            payment_status: bookingData.paymentStatus
        })
        .select()
        .single();
        
    if (error) throw error;
    
    // Adapt the returned data to match the frontend type
    return {
        id: data.id,
        artistId: data.artist_id,
        boothId: data.booth_id,
        shopId: data.shop_id,
        startDate: data.start_date,
        endDate: data.end_date,
        paymentStatus: data.payment_status,
        city: '' // Note: City isn't in the bookings table, it's looked up from the shop. May need to adjust logic.
    };
};

// You would continue this pattern for every function in the original apiService file.
// fetchNotifications, createClientBookingRequest, etc.
```

</details>

### Step 6: Restart and Test

1.  Stop your development server (`Ctrl+C` in the terminal).
2.  Restart it: `npm run dev`.
3.  The application should now be fully functional, reading and writing data to your live Supabase backend. Try signing up, uploading a portfolio picture, and booking a booth.

---

## Troubleshooting

This section covers common issues and their solutions. Before diving in, **always check your browser's Developer Console (F12)** for specific error messages.

### 1. Signup & Profile Errors

-   **Symptom:** You successfully create an account, but get an error like `"Could not find the 'is_verified' column..."` or `"Profile setup failed"`.
-   **Cause:** The application code is trying to use a database column (e.g., `is_verified`) that doesn't exist in your live Supabase table. This usually happens if you set up your database before that column was added to the official schema.
-   **Fix:** Run the following SQL commands in your Supabase SQL Editor to safely add the missing columns without deleting any data.

    ```sql
    -- Adds the required 'is_verified' column to your profiles table
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

    -- Adds the required 'is_verified' column to your shops table
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    ```

### 2. Data Not Appearing or Actions Failing (e.g., Can't Create Booking)

-   **Symptom:** You can view data, but you can't create, update, or delete anything. The browser console might show a `401 Unauthorized` or an RLS-related error.
-   **Cause:** This is almost always a **Row Level Security (RLS)** issue. The SQL script in this guide enables RLS but only provides a few basic policies. You need policies that allow users to perform specific actions.
-   **Fix:**
    1.  Go to **Authentication -> Policies** in your Supabase dashboard.
    2.  Select the table that's causing issues (e.g., `bookings`).
    3.  Create a new policy. For example, to allow any logged-in user to create a booking, you would create an `INSERT` policy with the expression `auth.role() = 'authenticated'`.
    4.  Review the official [Supabase RLS documentation](https://supabase.com/docs/guides/auth/row-level-security) for more complex examples.

### 3. API Key & Services Issues

-   **Symptom (Google Maps):** The map area shows an error like `"This page can't load Google Maps correctly"`.
-   **Fix (Google Maps):**
    1.  Verify that `VITE_MAPS_API_KEY` in your `.env` file is correct.
    2.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
    3.  Make sure the **"Maps JavaScript API"** is **enabled** for your API key. This is a common oversight.
    4.  Ensure you have billing enabled on your Google Cloud project.

-   **Symptom (Gemini AI):** AI features (like generating a bio) fail with an API error.
-   **Fix (Gemini AI):**
    1.  Verify that `VITE_API_KEY` in your `.env` file is correct.
    2.  Check your usage limits in your [Google AI Studio dashboard](https://aistudio.google.com/app/apikey).

### 4. Portfolio Image Uploads Failing

-   **Symptom:** When an artist tries to upload a portfolio image, it fails, often with a `403 Forbidden` error in the console.
-   **Cause:** The Supabase Storage bucket (`portfolios`) is missing the correct access policies.
-   **Fix:**
    1.  In your Supabase dashboard, go to **Storage** and select the `portfolios` bucket.
    2.  Click on **Bucket Settings -> Policies**.
    3.  You need to create policies that allow authenticated users to upload files. A common policy allows a user to upload into a folder matching their user ID. Consult the [Supabase Storage documentation](https://supabase.com/docs/guides/storage/security/access-control) for examples.

### 5. Deployment Issues (on Vercel/Netlify)

-   **Symptom:** The deployed site is a blank screen or crashes immediately.
-   **Cause 1:** Environment variables were not added to the deployment platform.
-   **Fix 1:** Go to your Vercel/Netlify project's **Settings -> Environment Variables**. Add all the variables from your local `.env` file (`VITE_API_KEY`, `VITE_SUPABASE_URL`, etc.). Redeploy your project.

-   **Cause 2:** Supabase is blocking requests from your deployed URL due to CORS.
-   **Fix 2:** Go to your Supabase dashboard -> **Project Settings -> API**. Scroll down to **CORS Configuration** and add your Vercel/Netlify URL (e.g., `https://your-app-name.vercel.app`) to the list of allowed origins.

---

## Deployment Guide

To deploy your app as a live website, you can use services like Vercel or Netlify.

1.  **Push to a Git Provider:** Make sure your project is pushed to a GitHub, GitLab, or Bitbucket repository.
2.  **Sign up for Vercel:** Go to [vercel.com](https://vercel.com/) and sign up with your Git provider account.
3.  **Import Project:** Import your InkSpace repository.
4.  **Configure Settings:** Vercel will auto-detect that it's a Vite project. You don't need to change the build commands.
5.  **Add Environment Variables:** This is crucial. Go to your Vercel project's **Settings -> Environment Variables**. Add all the variables from your local `.env` file (`VITE_API_KEY`, `VITE_MAPS_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
6.  **Deploy:** Click the "Deploy" button. Vercel will build and deploy your site, giving you a public URL.

---

## Project Structure

-   `/components`: Reusable React components.
-   `/data`: Holds static data like dropdown options.
-   `/hooks`: Custom React hooks for state management.
-   `/services`: Modules for external APIs (Gemini, Supabase).
-   `/types`: TypeScript type definitions for the entire application.
-   `App.tsx`: The main application component and router.