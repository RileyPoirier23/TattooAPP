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
- [URL Routing Structure](#url-routing-structure)
- [Tech Stack](#tech-stack)
- [Getting Started: Setup & Installation](#getting-started-setup--installation)
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
Follow the detailed SQL schema and Storage setup instructions from previous versions. The schema is comprehensive and includes all necessary tables, RLS policies, and storage bucket policies.

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
2.  **Storage RLS Policies:** Go to **Storage > Policies** in your Supabase dashboard. Verify you have policies that allow `authenticated` users to perform `INSERT` operations on both buckets.

### Authentication Errors (Login/Signup)
1.  **Email Confirmation:** By default, Supabase requires users to confirm their email. For development, you can disable this by going to **Authentication > Providers > Email** and turning off "Confirm email".
2.  **Check RLS for `profiles` Table:** A new user signup can fail if the RLS policy for `INSERT` on the `profiles` table is missing. The provided schema script includes this, but it's worth checking if you're having issues.

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