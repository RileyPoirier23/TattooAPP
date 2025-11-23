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

### 2. Backend Setup (Supabase) - CRITICAL STEP

You **MUST** run the included SQL script to set up the database. The app will not work without this.

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** tab (icon on the left).
3. Open the file `supabase_setup.sql` provided in this project.
4. Copy the entire content and paste it into the Supabase SQL Editor.
5. Click **Run** (bottom right).

*This script automatically creates all Tables, Storage Buckets, and Security Policies.*

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
    *   View and approve/decline booking requests (with full details).
    *   Search for guest spot booths at shops.
    *   AI-powered bio generation and service suggestions.
*   **For Shops:**
    *   List booths for rent.
    *   Manage incoming guest artists.

---

## ❓ Troubleshooting

**"Bucket not found" Error:**
*   **Cause:** Storage buckets weren't created.
*   **Fix:** Run the `supabase_setup.sql` script again. It contains the `INSERT INTO storage.buckets` command.

**"Permission denied" / RLS Error:**
*   **Cause:** Missing Row Level Security policies.
*   **Fix:** Re-run the `supabase_setup.sql` script.

**Registration - "Check your email":**
*   **Info:** By default, Supabase requires email confirmation.
*   **Fix:** You can disable this in Supabase Dashboard -> Authentication -> Providers -> Email -> Toggle off "Confirm email" for instant login during development.
