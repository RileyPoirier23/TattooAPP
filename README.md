# InkSpace Booking System — Functional Overview

## 1. General Description

The InkSpace booking system is designed to provide a smooth, intuitive experience for both tattoo artists and clients. It simplifies appointment scheduling, automates administrative tasks, and enhances client communication while giving artists full control over how they run their bookings.

## 2. Client Booking Flow

### Step 1: Intake Form

When a client begins the booking process, they complete a simple intake form that collects:
- Name, phone number, and email (auto-populates from their profile if logged in).
- Tattoo details: location on the body, approximate size (in inches or centimeters), option to upload reference photos, optional budget field, and a description box.

All client information is automatically saved to a client profile list for future bookings and optional marketing communications.

### Step 2: Select Service

The client chooses from artist-defined services like:
- Consultation
- 1-hour, 2-hour, 3-hour, or 4-hour session
- Full-day session
- Any other custom services the artist adds.

### Step 3: Choose Date & Time

Clients select from the artist’s available days and times. Artists control their availability by setting open hours, blocking specific dates, and limiting services to certain times.

### Step 4: Deposit & Confirmation

After approval, the client pays a deposit to finalize the booking.
- Deposit amount is set by the artist (minimum $50 for free-tier).
- Subscribed artists can make deposits optional.
- All free-tier transactions incur a 2.9% fee (waived for subscribed artists).

### Step 5: Automated Notifications

The system sends automated reminders and pre-appointment instructions written by the artist.

### Step 6: Appointment Completion

The artist marks the appointment as "Complete," "Rescheduled," or "No-show" and can request the remaining balance.

### Step 7: Post-Appointment Automation

- **Client Rating Request:** Clients rate cleanliness, professional conduct, and overall satisfaction.
- **Optional Aftercare Message:** Artist-provided instructions are sent automatically.
- **Optional Healed Photo Request:** Sent two weeks after the appointment.

## 3. Artist Setup & Control (Onboarding System)

### Step 1: Artist Profile
- Personal and shop information, including multiple locations.

### Step 2: Hours & Availability
- Define business hours for each day and set blackout dates or service-specific time windows.

### Step 3: Services Setup
- Create up to 10 custom services with names, durations, deposit amounts, and custom availability.

### Step 4: Intake Form Customization
- Artists customize which details to collect from clients (e.g., size, description, budget).

### Step 5: Communication & Automation Settings
- Personalize and toggle automated messages for reminders, instructions, aftercare, and photo requests.

## 4. Client Access & Marketing Integration

### Booking Access
- Artists share a unique booking link. Clients can book via the app or web without needing to download.

### Client Marketing Database
- All client info is stored for artists to send promotions, announce flash days, or reconnect for future work.

## 5. Monetization Model
- **Primary Revenue:** 2.9% transaction fee on deposits and payments for free-tier artists.
- **Subscription Plan:** Removes fees and unlocks advanced automation and marketing tools.
- **Added Value:** The transaction fees fund InkSpace marketing campaigns, driving more clients to the platform.

## 6. Core Design Principles
- **Convenience:** Simple and fast for both clients and artists.
- **Control:** Artists manage their own schedules, services, and communication.
- **Engagement:** Automated follow-ups maintain client connections.
- **Scalability:** Supports individual artists and multi-artist shops.
- **Transparency:** Clear pricing and benefits.

---

# Developer Specification (Technical / Functional Breakdown)

## 1. Overview

A booking platform for tattoo artists and clients that manages intake, scheduling, deposits, reminders, and follow-ups, with a shared backend for mobile and web interfaces.

## 2. Core Modules

### 2.1 Client Booking Flow
- **Intake Form (Screen 1):** Fields for name, phone, email, tattoo location, size, reference images, budget, and description. Data saved to `client_profiles`.
- **Select Service (Screen 2):** Pulls from `artist_services`. Displays name, duration, and price.
- **Select Date & Time (Screen 3):** Interactive calendar with read-only availability from `artist_schedule`. Status becomes `pending_approval`.
- **Deposit & Confirmation (Screen 4):** Stripe API integration. 2.9% fee for non-subscribed artists. On success, status becomes `confirmed` and appointment is added to `artist_calendar`.
- **Notifications Module:** 48-hour reminders and custom pre-appointment messages via Push, SMS (Twilio), and Email (SendGrid).
- **Appointment Completion:** Artist can set status to `complete`, `rescheduled`, `no_show`, or `payment_requested`.
- **Post-Appointment Automations:** On `complete`, trigger requests for ratings, send aftercare instructions, and (after 14 days) request healed photos.

### 2.2 Artist Onboarding & Control Panel
- **Profile Setup:** Fields for name, shop info, and social links. Supports multiple locations (`artist_locations`).
- **Hours of Operation:** Editable daily hours and custom overrides.
- **Service Management:** Up to 10 custom services in `artist_services` with rules for duration, deposit, and availability.
- **Intake Customization:** Artists can toggle which fields are required on their intake form.
- **Communication Settings:** Editable templates for all automated messages stored in `artist_messages`.

### 2.3 Sharing & Marketing Integration
- **Booking Link System:** Unique URL (`inkspace.app/artist/[username]`) with deep-linking to the app.
- **Client Database:** Client info saved to `client_profiles`, exportable for marketing.

## 3. Monetization
- **Free Tier:** Basic booking with a 2.9% transaction fee.
- **Subscription:** Monthly/annual plan removes fees and unlocks advanced features.
- **Shop Plan (Future):** Multi-artist dashboard with tiered pricing.

## 4. Tech Stack (Recommended)
- **Frontend:** React / React Native
- **Backend:** Node.js (Express)
- **Database:** Firestore or PostgreSQL
- **Payments:** Stripe
- **Notifications:** Firebase / Twilio / SendGrid
- **Hosting:** AWS Amplify or Firebase
- **Auth:** Firebase Authentication

## 5. Key Collections / Tables
- `artists`: Account info, subscription status.
- `artist_services`: Service definitions.
- `artist_calendar`: Availability and bookings.
- `artist_messages`: Automated message templates.
- `client_profiles`: Client data.
- `appointments`: Booking and payment records.
- `transactions`: Payment history.
- `ratings`: Client reviews.

## 6. Triggers & Automations
- **Deposit Paid:** Confirms appointment, adds to calendar.
- **48 Hours Before:** Sends reminder.
- **Appointment Complete:** Sends rating request and aftercare.
- **14 Days After:** Sends healed photo request.
- **Payment Requested:** Generates Stripe payment link.
