# InkSpace - Tattoo Industry Marketplace

InkSpace is a dual-sided marketplace connecting tattoo artists with shops for guest spots (B2B) and clients with artists for appointments (B2C).

## 🚀 Quick Start

### 1. Environment Setup
Create a `.env` file in the root directory:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPS_API_KEY=your_google_maps_api_key
API_KEY=your_gemini_ai_api_key
```

### 2. Backend Setup (Supabase)

**A. Run the Database Script:**
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** tab.
3. Open the file `supabase_setup.sql` from this project.
4. Copy the entire content and paste it into the SQL Editor.
5. Click **Run**.
   *This creates all tables, enables security policies, and sets up user registration triggers.*

**B. Create Storage Buckets (Manual Step):**
The SQL script sets up permissions, but you must create the containers manually.
1. Go to the **Storage** tab in Supabase.
2. Click **New Bucket**.
3. Create the following 3 buckets (ensure "Public" is checked for all):
   - `portfolios`
   - `booking-references`
   - `message_attachments`

### 3. Run the App
```bash
npm install
npm run dev
```

---

## 🛠 Features

*   **For Clients:**
    *   Find artists by city, specialty, and rating.
    *   Book appointments with a detailed intake wizard (size, placement, photos).
    *   Real-time chat with artists.
*   **For Artists:**
    *   Manage weekly availability and hours.
    *   View and approve/decline booking requests.
    *   Search for guest spot booths at shops.
    *   AI-powered bio generation and service suggestions.
*   **For Shops:**
    *   List booths for rent.
    *   Manage incoming guest artists.

---

## ❓ Troubleshooting

**"Bucket not found" Error:**
*   **Cause:** The storage buckets have not been created in the Supabase dashboard.
*   **Fix:** Follow Step 2B above exactly. The names must match case-sensitively (`portfolios`, etc.).

**"Permission denied" / RLS Error:**
*   **Cause:** The SQL script was not run, or Row Level Security policies are missing.
*   **Fix:** Re-run the `supabase_setup.sql` script. It is safe to run multiple times (it uses `if not exists` checks).

**Login/Registration Issues:**
*   **Fix:** Check your browser console. If you see "AuthApiError: Database error saving new user", ensure the `handle_new_user` trigger from the SQL script was created successfully.

**Google Maps / Location Search Not Working:**
*   **Fix:** Ensure `VITE_MAPS_API_KEY` is set in `.env` and that the "Places API" and "Maps JavaScript API" are enabled in your Google Cloud Console.

