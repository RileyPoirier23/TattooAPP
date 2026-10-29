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

### New look
- A redesign based on the BookApp "Home 2" template the owner picked, adapted for tattoos and filled with real data instead of placeholders: Fira Sans headings, Poppins text, a bright blue accent (#0066F5, changeable in Admin → Customize, which also has a Vermilion preset), rounded cards, pill buttons and light tinted sections. Fonts are served by the site itself (no Google Fonts request).
- Home page: a full-width hero (the owner's photo, or a mosaic of real work) with the header floating over it and a city + style search that opens the artist search already filtered; popular styles with a real piece and artist count for each; how booking works in four numbered steps; featured artists and shops in scrolling rows with arrows; two promo banners; artists filtered by style with pill buttons; and a dark sign-up banner for artists and shop owners.
- Artist cards show the style, rating, city, starting price and a Book now button; shop cards show amenities, starting rate per day and number of booths. Lists show placeholder cards while loading.
- Centered footer with the logo, contact email, social links and all pages.
- Copy: no emoji in messages and notifications, and em dashes replaced with plain punctuation throughout the site, emails and the starter policy pages.
- Sites still using an earlier default look (the original pink/purple, or the 1.2 studio red) switch to the new defaults automatically, and starter pages nobody edited get the updated text (the Privacy Policy no longer mentions Google Fonts). Anything an owner customized is kept.
- Earlier looks are kept on the `backup/original-vibecoded-look`, `backup/studio-look` and `backup/flash-sheet-look` branches.

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
- Security updates for six third-party packages (form uploads, request parsing, input validation, email address parsing): each could be used to slow or stall the server, or to misroute an email. Dependabot now opens update pull requests automatically.
- Going live: switching Square between Sandbox and Production removes cards saved in the other environment (they can't be charged there), and **Test connection** catches a Sandbox Application ID used with Production (or the reverse).
- `/health` now checks the database answers, and `railway.json` makes Railway wait for it before switching to a new deploy and restart the app if it crashes.
- Feels like an app on phones: the page extends under the notch and home bar with content kept clear of them, buttons react the moment they are pressed (no tap delay or gray flash), hover effects no longer stick after a tap, typing in a field no longer zooms the page on iPhone, the keyboard shows Search/Send keys and a number pad for amounts, pop-ups and the messages list fit the visible screen as the browser bar shows and hides, scrolling inside a pop-up no longer scrolls the page behind it, and the phone's status bar matches the light or dark theme.
- Long real-world data fits on every screen, down to a 320px phone: pasted links in bios and messages, long hyphenated names, one-word place names and long amenity, booth and service names wrap instead of pushing the page sideways or overlapping prices and buttons. The admin overview, Reviews and Messages no longer run past the screen edge on small phones (even with ordinary data), Payments totals stack on small phones, icons never get squeezed, names starting with an emoji show correct initials, review counts show thousands separators (1,284), and artists with no city show no empty "Location not set" line.
- Smoother, quicker motion: on phones pop-ups slide up from the bottom like a native sheet; dropdown menus grow from the button that opened them; pages appear instantly instead of fading in on every click; the loading spinner turns faster; notifications ease out when they close instead of vanishing; and visitors who ask their device for reduced motion get gentle fades instead of sliding, growing or lifting.
- Google Maps help text names the right API to enable (*Places API (New)*).
- Green action buttons (Approve, Record payout…) and the "Guest spot in…" badge have stronger contrast, and inline links on booking pages are underlined (all pages pass automated WCAG 2.1 AA checks with real data).
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
