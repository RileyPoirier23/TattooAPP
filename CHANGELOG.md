# Changelog

## [1.1.0] — 2026-10-10 — Review fixes

### Money
- Clients are charged exactly what the Pay button shows (the booking fee updates if the artist joins or leaves Pro).
- An expired booth reservation can no longer be paid once someone else has booked the dates.
- If a booking or rental is cancelled while the card is being charged, the charge is refunded automatically.
- Failed Pro renewals are retried daily for 3 days instead of cancelling on the first failure; suspended accounts are never billed.
- "Update card" no longer turns a cancelled plan back on; existing subscribers keep their price when the Pro price changes.
- Test (sandbox) payments are kept apart from real ones in revenue, earnings and payouts.
- Refunding a deposit cancels the appointment; admins can't delete users who are owed money or have paid bookings.
- Square "Test connection" now reports wrong keys; unclear payment failures tell the client to check before retrying.

### Security & reliability
- Upload requests are size- and rate-limited (no more crashing the server or filling the disk).
- The admin set-up can't promote someone else's account with their own password; added `ADMIN_RESET_PASSWORD` and a working recovery tool.
- Email can be sent through Resend's API (Railway blocks SMTP on its Hobby plan); private links are no longer written to production logs.
- Live updates reconnect after a server restart; old tabs recover after an update.

### Bookings & people
- Artists set an exact start time when approving (shown everywhere and in calendar links).
- Unanswered requests expire after their date; clients can't cancel after the appointment; one artist can hold at most 3 unpaid booths.
- New messages notify the recipient (and email them); clients are emailed when the admin changes their booking; artists when a client cancels.
- Guests can add a booking to their account later; guests' reviews require a paid deposit.
- Shops can block dates and cancel rentals.
- Sign-up requires accepting the Terms; booking requires confirming 18+ and the booking policy.
- Users can delete their account.
- Artist and shop pages show proper titles and previews when shared; search engines can read the site.
- Accessibility: dialogs announce their title, keep keyboard focus and restore it; better text contrast; screen-reader labels for ratings and choices.
- Many smaller fixes (phone layouts, double-sent messages, oversized photos, timezone edge cases, Windows builds, `.env` loading).

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
