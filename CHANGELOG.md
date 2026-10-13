# Changelog

## [1.2.0] — 2026-10-10 — Launch readiness

### Money
- A card is never charged twice when Square's reply is lost: the retry re-sends the original request first.
- Calls to Square, Resend and SMTP time out instead of hanging.
- Pro renewals after a long gap (site down, payments switched off) charge once and start a new month; missed months are never charged.
- Money from a paid rental the shop cancelled, or a paid appointment the artist/admin cancelled, is "on hold" (not owed) until it's refunded.
- Pro subscribers pay the currently listed price. When the admin changes it, subscribers are emailed and the new price applies from their next renewal (this replaces the 1.1.0 price lock).
- The Pro plan ships switched off; the owner turns it on in Admin → Settings when ready. Subscribers can still manage or cancel their plan if it's switched off later. Pro artists are listed first in search (as the plan promises).
- The displayed currency always follows the Square location.

### New
- "Contact us" page with an admin Inbox (replies go straight to the sender).
- Reminder emails before appointments and when an approved deposit is still unpaid; artists are emailed when an unpaid booth reservation expires.
- Nightly automatic database backups (last 7 kept), listed and downloadable in Admin → Backup.
- Members can download all their data from Settings.
- Starter Terms of Service, Privacy Policy, Booking & Cancellation Policy and FAQ, with the site's name and contact details filled in automatically.
- Admin: CSV exports of payments (with the current filters) and payout records for bookkeeping.
- Admin: searchable, paged Users, Bookings, Booth rentals and Payments (with totals); edit a shop's details and cover photo; change a booking's date or time; a fuller setup checklist.
- `OWNER_GUIDE.md` for the person running the site.

### Security & privacy
- Fixed: a specially crafted photo could exhaust the server's memory.
- Rate limits can't be dodged with a fake X-Forwarded-For header (only known hosting proxies are trusted; `TRUST_PROXY` for custom setups).
- Limits on password-reset emails per account and emails per booking; aftercare only after the appointment.
- Deleting an account also deletes its photos, attachments and saved card.
- Accounts lock for 15 minutes after repeated wrong passwords; guest booking and contact-form spam limits and traps.
- Hidden camera/GPS data is removed from uploaded photos; large photos are shrunk before uploading (no more "over 8 MB" errors from phones).
- Content-Security-Policy header; admin-entered links must be web links.
- Sign-ups and bookings record when the terms were accepted.

### Polish
- The booking fee is shown before booking and in every "pay your deposit" message; artists are told about it.
- Clients can switch on artist features from Settings ("Become an artist").
- Plain-language error messages; social links typed without https:// are fixed automatically.
- Messages only say something was emailed when email is set up.
- Meets WCAG 2.1 AA in automated checks (desktop and phone, light and dark): readable button and badge colors for any brand color, labelled controls, underlined inline links.
- Faster first visit: member-only pages load when first opened.
- The rating, "Verified" and "Cover" badges on photos stay readable on light photos (they were faint in dark mode).
- Admin: on shorter laptop screens the sidebar scrolls on its own, so Payments, Payouts and Backup are always reachable; booking status menus are no longer cut off.
- The booth payment window shows when the hold ends in a readable form ("Oct 12, 11:12 PM").
- Clean shutdown on redeploys (finishes in-progress work); database indexes for growing lists.
- Warns before leaving a form with unsaved changes (admin panel and dashboards), including the back button.
- Brand colors stay readable: button text turns dark on light colors and brand-colored text is adjusted for contrast.
- Artists appear in search once they have a portfolio photo; `/sitemap.xml` for search engines.
- Admin changes to bookings are attributed to the admin in notifications.

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
