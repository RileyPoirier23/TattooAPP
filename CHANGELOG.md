# Changelog

## [1.0.0] — 2026-10-10 — Rebuild

The site was rebuilt from the ground up as a single self-hosted app.

### Changed
- **No more Supabase, Stripe, Vite or Vercel.** One Node.js server now handles the API, database (SQLite), image uploads, email and the website itself. Deploy anywhere Docker runs (Railway recommended).
- **Payments moved to Square**: client deposits, booth rentals, and the Pro plan (monthly, card on file). Amounts are always calculated on the server.
- New design system: consistent buttons, forms, cards and dialogs; full light/dark support; works on phones.

### Added
- **Admin panel**: customize branding/colours/homepage/pages; feature switches; fees & pricing; Square, email and Maps settings; manage users, shops, bookings, payments (refunds), payouts ledger, verifications, reports, reviews; database backup.
- Guest booking with a private link to check status and pay the deposit.
- Artist services editor, weekly hours + days-off calendar, booking-form requirements, editable aftercare message, earnings page, payout details, verification requests.
- Shop setup with automatic map location, cover photo upload, booth editor, rentals list, earnings.
- Booth rentals with double-booking protection, automatic release of unpaid holds, and shop reviews.
- Password reset by email, change password, email notifications, live notifications and messages.
- Automated API tests and browser tests.

### Fixed
- Payments never worked (Stripe calls were always rejected) and bookings could be marked "paid" without paying.
- Anyone could make themselves admin, verified or Pro; a hard-coded admin password existed; all users' emails were publicly readable.
- Shop creation and adding/editing booths failed.
- Dates showed one day early in North America; past dates could be booked; artists with no hours set couldn't be booked at all.
- Guests attaching reference photos got an error.
- Reviews and ratings were invisible to the public.
- The site crashed on load when the AI key was missing (AI features removed for now).
