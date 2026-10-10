# InkSpace — tattoo artist & guest-spot marketplace

A complete website where:

- **Clients** find tattoo artists, request appointments (with or without an account), and pay deposits online.
- **Artists** run their booking business: portfolio, services & prices, working hours and days off, requests, deposits, reviews, messages, aftercare, earnings.
- **Shop owners** list booths that travelling artists can rent for guest spots, and get paid.
- **The site owner (admin)** customizes everything — name, logo, colours, homepage text, pages, fees, features — and manages users, shops, bookings, payments, refunds, payouts, reports and reviews from the admin panel.

Payments are handled by **Square**. Everything else (accounts, database, image uploads, email) runs inside this one app — there are no other services to sign up for.

---

## What's included

| Area | Features |
|---|---|
| Discovery | Artist search (name, city, style, rating, verified, "near me"), shop search (city, amenities), guest-spot badges, optional "not on the platform yet" shop listings from Google Maps |
| Client bookings | 3-step request (service, date from the artist's real availability, size/placement/budget/idea, up to 5 reference photos), guest booking with a private status link, cancel, add to calendar, reviews |
| Deposits | Artist approves (can adjust the deposit and add a note) → client pays by card via Square → receipt emailed. Optional booking fee on deposits (waived for Pro artists) |
| Artist dashboard | Requests (approve / decline / reschedule / complete / no-show / archive), profile + portfolio (upload, reorder, delete), services & prices, weekly hours + days-off calendar, booking-form requirements, aftercare message, earnings & payout details, Pro plan, verification request |
| Booth rentals | Shops list booths with daily rates; artists pick dates (double-booking is impossible), pay by card, review the shop afterwards. Unpaid reservations are released automatically |
| Pro plan | Monthly subscription charged to a saved card (Square card on file), auto-renews, cancel/resume, update card |
| Messaging | Direct messages with photo attachments and live updates |
| Notifications | In-app bell with live updates, plus emails for the important moments (new request, approval, payment, refunds, password reset) |
| Accounts | Sign up as client / artist / both / shop owner, login, forgot password, change password |
| Admin panel | Dashboard & revenue, Customize (branding, colours, homepage, announcement banner, socials, footer), Pages (FAQ, policies…), Settings (feature switches, fees, Pro price, Square, email, Google Maps), Users, Shops, Bookings, Payments & refunds, Payouts ledger, Verifications, Reports, Reviews, Backup download |

### How the money works

Every payment goes into **the site owner's Square account**. The admin panel's **Payouts** page shows what each artist and shop is owed (deposits go to the artist; booth rentals go to the shop minus the platform's cut). Pay them by e-Transfer/PayPal/etc. and click **Record payout** — they see it in their own Earnings page. Refunds are one click in **Admin → Payments**.

---

## Run it on your computer

Requires [Node.js 22+](https://nodejs.org).

```bash
npm install
cp .env.example .env        # then edit ADMIN_EMAIL / ADMIN_PASSWORD
npm run build
npm start                   # → http://localhost:3000
```

Log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD` and open **Admin** from the account menu.

For development with automatic reloading: `npm run dev`.

---

## Put it online (recommended: Railway)

The app is a single Docker container that needs a **persistent disk** for its database and uploaded photos. [Railway](https://railway.app) is the simplest option (about $5/month):

1. Push this repository to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → pick this repo. Railway detects the `Dockerfile` automatically.
3. Add a **Volume** to the service and mount it at **`/data`**. *(Without this, data is lost on every deploy.)*
4. In the service's **Variables**, add:
   - `APP_URL` = your site's address, e.g. `https://inkspace.up.railway.app` (or your own domain)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` = your admin login
5. Under **Settings → Networking**, generate a domain (or add your own domain).
6. Open the site, log in as admin, and go to **Admin → Settings** to connect Square and email.

**Other hosts work too** — anything that runs a Docker image with a persistent disk mounted at `/data`: Render (with a Disk), Fly.io (with a Volume), DigitalOcean, or any VPS (`docker build -t inkspace . && docker run -p 3000:3000 -v inkspace-data:/data --env-file .env inkspace`).

> Avoid "serverless" hosts like Vercel or Netlify for this app — they can't keep a database file or uploaded images.

---

## Connect Square (payments)

1. Create a free account at [developer.squareup.com](https://developer.squareup.com/apps) and create an application.
2. In your app, start with **Sandbox** (test mode):
   - **Credentials** page → copy the *Sandbox Application ID* and *Sandbox Access token*.
   - **Locations** page → copy the *Location ID*.
3. In **Admin → Settings → Square payments**, choose *Sandbox*, paste the three values, save, then click **Test connection**.
4. Make a test booking and pay with Square's test card `4111 1111 1111 1111`, any future expiry, any CVV, postal code `12345`.
5. When you're ready for real money, switch to **Production** and paste the *Production* Application ID, Access token and Location ID.

The currency is taken automatically from your Square location (e.g. CAD for a Canadian account).

## Connect email

Emails (booking updates, payment receipts, password resets) need an SMTP account. In **Admin → Settings → Email**, enter the SMTP details from any provider — for example:

- **Gmail**: host `smtp.gmail.com`, port `465`, secure on, your Gmail address, and an [app password](https://myaccount.google.com/apppasswords).
- **Resend / Brevo / Mailgun**: use the SMTP credentials from their dashboard (better deliverability for a business domain).

Click **Send test email** to check it works. Until email is set up, messages are written to the server log instead.

## Optional: Google Maps

Add a Google Maps API key in **Admin → Settings** (enable *Maps JavaScript API*, *Geocoding API* and *Places API (New)*) to get shop maps, automatic map pins from addresses, the "Near me" button, and nearby shops that haven't joined yet.

---

## Backups

**Admin → Backup** downloads a copy of the database. Uploaded images live in the `uploads` folder of the data directory (`/data/uploads` on Railway). Railway volumes can also be backed up from the Railway dashboard.

## Lost admin access?

Run `npm run create-admin -- you@example.com "new-password"` on the server (Railway: service → **⋯ → Shell**), or change `ADMIN_EMAIL` / `ADMIN_PASSWORD` and redeploy — that account is promoted to admin on start-up.

---

## For developers

```
client/   React 19 + Tailwind front-end (bundled with esbuild)
server/   Express 5 API, SQLite (better-sqlite3), Square client, email, background jobs
shared/   Types shared by both
tests/    API integration tests (node:test) against a fake Square API
e2e/      Browser tests (Playwright)
```

| Command | What it does |
|---|---|
| `npm run dev` | Rebuild on change + auto-restart server |
| `npm run build` | Production build into `dist/` |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | API tests (payments, refunds, payouts, security, bookings…) |
| `npm run test:e2e` | Browser tests (run `npm run build` first) |

Security notes: passwords are hashed with scrypt; sessions are httpOnly cookies; state-changing requests require a custom header (CSRF protection); uploaded files are checked by their content, not their name; card details never reach the server (Square tokenizes them in the browser); secrets entered in the admin panel are never sent back to browsers.
