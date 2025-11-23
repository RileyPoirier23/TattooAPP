
# InkSpace Booking System — Functional Overview

## 1. General Description

The InkSpace booking system is designed to provide a smooth, intuitive experience for both tattoo artists and clients. It simplifies appointment scheduling, automates administrative tasks, and enhances client communication while giving artists full control over how they run their bookings.

---

# Developer Specification (Technical / Functional Breakdown)

## 1. Overview

A booking platform for tattoo artists and clients that manages intake, scheduling, deposits, reminders, and follow-ups, with a shared backend for mobile and web interfaces.

## 2. Setup Guide & Troubleshooting

### **CRITICAL: Manual Setup Steps for Supabase**

To prevent the **"Bucket not found"** error and ensure images load correctly, you **must** manually create storage buckets in your Supabase project dashboard.

1.  **Create Storage Buckets:**
    Go to your Supabase Dashboard -> Storage -> Buckets and create these three **Public** buckets:
    *   `portfolios`
    *   `booking-references`
    *   `message_attachments`

2.  **Set Storage Policies:**
    For each bucket, click "Configuration" -> "Policies" and add a new policy to allow uploads.
    *   **Name:** "Allow public uploads"
    *   **Allowed Operations:** SELECT, INSERT, UPDATE, DELETE
    *   **Target Roles:** Anon, Authenticated (check both)

3.  **Database Row Level Security (RLS):**
    Ensure you run the SQL scripts provided in the project documentation (if available) or disable RLS on the `profiles`, `shops`, and `client_booking_requests` tables temporarily if you are encountering "Permission denied" errors during development.

---

## 3. Core Modules

### 3.1 Client Booking Flow
- **Intake Form:** Fields for name, phone, email, tattoo location, size, reference images, budget, and description. Data saved to `client_profiles`.
- **Select Service:** Pulls from `artist_services`. Displays name, duration, and price.
- **Select Date & Time:** Interactive calendar with read-only availability from `artist_schedule`. Status becomes `pending_approval`.
- **Deposit & Confirmation:** Stripe API integration. 2.9% fee for non-subscribed artists. On success, status becomes `confirmed` and appointment is added to `artist_calendar`.
- **Notifications Module:** 48-hour reminders and custom pre-appointment messages via Push, SMS (Twilio), and Email (SendGrid).
- **Appointment Completion:** Artist can set status to `complete`, `rescheduled`, `no_show`, or `payment_requested`.
- **Post-Appointment Automations:** On `complete`, trigger requests for ratings, send aftercare instructions, and (after 14 days) request healed photos.

### 3.2 Artist Onboarding & Control Panel
- **Profile Setup:** Fields for name, shop info, and social links. Supports multiple locations (`artist_locations`).
- **Hours of Operation:** Editable daily hours and custom overrides.
- **Service Management:** Up to 10 custom services in `artist_services` with rules for duration, deposit, and availability.
- **Intake Customization:** Artists can toggle which fields are required on their intake form.
- **Communication Settings:** Editable templates for all automated messages stored in `artist_messages`.

### 3.3 Sharing & Marketing Integration
- **Booking Link System:** Unique URL (`inkspace.app/artist/[username]`) with deep-linking to the app.
- **Client Database:** Client info saved to `client_profiles`, exportable for marketing.

## 4. Monetization
- **Free Tier:** Basic booking with a 2.9% transaction fee.
- **Subscription:** Monthly/annual plan removes fees and unlocks advanced features.
- **Shop Plan (Future):** Multi-artist dashboard with tiered pricing.

## 5. Tech Stack (Recommended)
- **Frontend:** React / React Native
- **Backend:** Node.js (Express)
- **Database:** Firestore or PostgreSQL
- **Payments:** Stripe
- **Notifications:** Firebase / Twilio / SendGrid
- **Hosting:** AWS Amplify or Firebase
- **Auth:** Firebase Authentication

## 6. Key Collections / Tables
- `artists`: Account info, subscription status.
- `artist_services`: Service definitions.
- `artist_calendar`: Availability and bookings.
- `artist_messages`: Automated message templates.
- `client_profiles`: Client data.
- `appointments`: Booking and payment records.
- `transactions`: Payment history.
- `ratings`: Client reviews.

## 7. Triggers & Automations
- **Deposit Paid:** Confirms appointment, adds to calendar.
- **48 Hours Before:** Sends reminder.
- **Appointment Complete:** Sends rating request and aftercare.
- **14 Days After:** Sends healed photo request.
- **Payment Requested:** Generates Stripe payment link.
