# Owner's guide

This guide is for the person running the site day to day. You don't need to know any code. Everything here is done from the **admin panel**: log in with your admin email and password, open the account menu (top right) and choose **Admin**.

> For installing the site on a server, see the [README](README.md).

---

## 1. Before you launch

The **Overview** page in the admin panel has a setup checklist that ticks itself off as you go. In order:

1. **Customize** — site name, logo, colors, home page text, announcement banner, social links and your **contact email**. A live preview shows your changes before you save. If you pick a very light main color, buttons automatically switch to dark text so they stay readable.
2. **Settings → Square payments** — connect Square (step-by-step instructions are in the README). Start in **Sandbox** to make test bookings with Square's test card, then switch to **Production** with your live keys when you're ready for real money. Test payments are kept separate and never mix with real ones in your totals.
3. **Settings → Email** — paste a Resend API key (recommended) or SMTP details, set the **From address** and use **Send a test email**. Without email the site still works, but nobody gets booking updates, reminders or password-reset emails.
4. **Pages** — the site comes with starter **Terms of Service**, **Privacy Policy**, **Booking & Cancellation Policy** and **FAQ** pages. They already contain your site name and contact details (the `{{siteName}}`, `{{siteUrl}}` and `{{contact}}` placeholders fill these in automatically). **Read them and adjust them to your business and location before launch — ideally with a lawyer.** They are a sensible starting point, not legal advice.
5. **Settings → Features** and **Fees & pricing** — choose what's switched on (bookings, guest bookings, booth rentals, messaging, reviews, the Pro plan) and set your booking fee, booth commission, default deposit and how long unpaid booth reservations are held.
6. Optional: a **Google Maps** key for shop maps, "near me" search and listings of shops that haven't joined yet.

## 2. How the money works

Every payment goes into **your Square account**:

| Payment | Who pays | Where it goes |
|---|---|---|
| Booking deposit | Client, after the artist approves | The deposit is owed to the artist. Your **booking fee** (a % on top) is yours. Artists on Pro: no booking fee for their clients. |
| Booth rental | Artist renting a guest spot | Owed to the shop, minus your **booth commission**. |
| Pro plan | Artist, monthly | All yours. |

**Payouts:** the **Payouts** page shows exactly what each artist and shop is owed. Pay them your usual way (e-Transfer, PayPal, bank transfer…) and click **Record payout**; they see it on their own Earnings page. Their payout details are on the same page.

**Refunds:** **Payments → Refund** sends the full amount back to the payer's card through Square (usually 5–10 business days) and updates everything automatically: a refunded deposit cancels the appointment, a refunded rental frees the booth, a refunded Pro payment ends that plan. If you'd already paid the artist or shop, their balance goes negative and comes off their next payout.

When a client cancels a paid booking, or a shop cancels a paid rental, you get an email so you can decide on a refund. If the shop or the artist cancelled, that money shows as **on hold** (not owed to them) until you refund it.

**Bookkeeping:** **Export CSV** on the Payments page (it follows your current filters) and **Export payout records** on the Payouts page download spreadsheets for your accountant. Prices are charged exactly as entered, so if you need to collect sales tax (GST/HST/VAT…), build it into your fees and prices or ask your accountant. Card disputes (chargebacks) are handled in your Square dashboard.

## 3. The Pro plan

The Pro plan is **switched off** until you turn it on in **Settings → Features**. When it's on, artists can pay a monthly price to remove the booking fee for their clients, get a Pro badge and be listed first in the artist search.

- **Price:** set it in **Settings → Fees & pricing → Pro plan price**. Subscribers always pay the price that's listed. When you change it, every subscriber is emailed straight away and the new price applies from their **next renewal**. Some places require advance notice before a price rise, so it's good practice to change it well before most renewals.
- **Renewals:** charged automatically to the artist's saved card each month. If a card fails, the site retries daily for 3 days (they keep Pro meanwhile) before the plan ends. Suspended accounts are never charged.
- **Cancelling:** artists cancel any time in Settings and keep Pro until the end of the month they paid for.
- **Turning Pro off later** stops new sign-ups. Current subscribers keep their plan (and can still cancel it) until they cancel.
- You can also give someone Pro for free from **Users** (pick an end date or leave it open-ended).

## 4. Day to day

- **Inbox** — messages from the **Contact us** page. They're also emailed to your contact email (or every admin if none is set). **Reply by email** opens your email app with their address filled in.
- **Bookings** — every client booking and booth rental, searchable. Open **Details** to see the whole request, or **Change date or time** (the client and artist are notified). Changing a status doesn't move money — use Payments for refunds.
- **Verifications** — artists and shops can request a verified badge; approve or reject here.
- **Reports** and **Reviews** — handle reports from members, and hide reviews that break your rules.
- **Users** — search everyone; edit details, suspend (logs them out), give Pro, copy a password-reset link, or delete an account. Accounts that are still owed money or have upcoming paid bookings can't be deleted — suspend them instead.
- **Shops** — verify shops, edit their details and cover photo, or remove them.

Badges in the admin menu show what needs attention (new messages, pending verifications and reports).

## 5. Emails the site sends for you

Booking requests (to the artist), approvals and payment links (to the client), payment receipts, reminders about unpaid deposits (after a day) and upcoming appointments (a day or so before), cancellations and date changes, new messages, expiring booth reservations, Pro renewals and price changes, refunds, and password resets.

## 6. Keeping things safe

- **Backups:** the site saves a copy of its database every night and keeps the last 7 (see **Backup**). Those copies live on the same server, so also click **Download backup** regularly — at least weekly and always before updates — and keep the file somewhere else. Uploaded photos are stored separately in the `uploads` folder; your host's volume backups cover both.
- **Privacy:** members can download all their data and delete their account themselves in **Settings**. Hidden location data is removed from uploaded photos. Backup files contain personal information — keep them private.
- **Security built in:** passwords are scrambled (hashed), card details never touch the server (Square handles them), accounts lock for 15 minutes after repeated wrong passwords, and forms are protected against spam and abuse.

## 7. Troubleshooting

| Problem | What to do |
|---|---|
| Emails aren't arriving | **Settings → Email → Send a test email**. With Resend, your domain must be verified and the From address must be on that domain. Ask people to check spam. |
| Payments fail | **Settings → Square → Test connection**. Make sure the environment (Sandbox/Production) matches the keys you pasted. |
| A member can't log in | After several wrong passwords the account is locked for 15 minutes. Or send them a reset link from **Users**. |
| You're locked out of admin | See "Lost admin access?" in the README (`ADMIN_RESET_PASSWORD`). |
| Someone's profile isn't in the artist search | Artists appear once they've added at least one portfolio photo (their profile link works before that). |

## 8. Handing over or changing hands

If the site is transferred to a new owner: transfer the hosting project (e.g. Railway) and the domain, change the admin password (or create a new admin in **Users** and remove the old one), create new Square and Resend keys under the new owner's accounts and paste them into **Settings**, and update the contact email in **Customize**.
