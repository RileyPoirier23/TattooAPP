// Starting content for the FAQ and policy pages. The owner edits them in Admin → Pages.
// {{siteName}}, {{siteUrl}} and {{contact}} are filled in when a page is shown (see fillPageTokens).

export const DEFAULT_PAGES: { slug: string; title: string; body: string }[] = [
  {
    slug: 'faq',
    title: 'FAQ',
    body: `## How do I book a tattoo?
Find an artist you like, open their profile and choose **Request a booking**. Pick a service and a date when they're available, describe your idea and add reference photos if you have them. The artist reviews your request and approves it, suggests changes or declines it.

## Do I need an account?
No. You can book as a guest — you'll get a private link (also sent by email) to check your request and pay your deposit. With a free account all your bookings, messages and receipts are in one place.

## How do deposits work?
When an artist approves your request, you pay a deposit online to lock in your date. The deposit goes towards the price of your tattoo. A small booking fee may be added; you always see the total before you pay. See the [Booking & Cancellation Policy](/p/booking-policy) for refunds.

## Is paying online safe?
Payments are processed by Square. Your card details go straight to Square and are never stored on {{siteName}}.

## Can I cancel or reschedule?
Contact your artist through Messages as early as possible. You can cancel a request from **My bookings** (or your private booking link) before the appointment. Deposits follow the [Booking & Cancellation Policy](/p/booking-policy).

## I'm a tattoo artist. How do I join?
Sign up as an artist, then fill in your dashboard: profile, at least one portfolio photo, your services and prices, and your working hours. Your profile appears in the artist search as soon as it has a photo.

## How do guest spots work?
Shops list booths that travelling artists can rent by the day. Choose your dates, then pay to confirm the booth. Unpaid reservations are released automatically after a while so others can book.

## How do artists and shops get paid?
Payments are collected by {{siteName}}. Artists receive their clients' deposits, and shops receive their booth rentals minus the platform fee. Add your payout details in your dashboard; the Earnings page shows what you've earned and what has been paid out.

## How do I contact you?
Reach us through {{contact}}.`,
  },
  {
    slug: 'booking-policy',
    title: 'Booking & Cancellation Policy',
    body: `This policy applies to tattoo appointments and booth rentals booked on {{siteName}}. Individual artists and shops may have their own additional policies — ask them before you book.

## Requests and confirmation
A booking request is not confirmed until the artist approves it **and** any deposit has been paid. If the artist hasn't answered by the requested date, the request expires automatically.

## Deposits
Deposits secure your appointment and are applied to the final price of your tattoo. Any booking fee shown at checkout covers payment processing and is not part of the deposit.

## If you cancel or reschedule
Please let your artist know as early as possible — at least 48 hours before your appointment. Deposits are non-refundable when you cancel, unless your artist agrees otherwise. Moving your appointment to a new date is up to the artist.

## If the artist cancels
If your artist cancels your appointment, your deposit is refunded in full.

## No-shows and lateness
Missing your appointment without notice may forfeit your deposit. Arriving very late may mean your appointment is shortened or rescheduled.

## Age and health
You must be 18 or older and bring valid photo ID. Tell your artist about any allergies, medical conditions or medications before your appointment. Artists may refuse service for health or safety reasons, or if you are under the influence of alcohol or drugs.

## Booth rentals (guest spots)
A booth is confirmed once the rental is paid in full. Unpaid reservations are released automatically after the hold time shown at checkout. If the shop cancels a paid rental, it is refunded in full. If the artist cancels a paid rental, refunds are up to the shop.

## Refunds
Approved refunds go back to the card used to pay. They usually appear within 5–10 business days, depending on your bank.

## Questions
Contact us through {{contact}}.`,
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    body: `These terms apply when you use {{siteName}} ({{siteUrl}}). By creating an account or making a booking you agree to them. Please also read our [Privacy Policy](/p/privacy) and [Booking & Cancellation Policy](/p/booking-policy).

## 1. What {{siteName}} is
{{siteName}} is an online marketplace that connects clients with independent tattoo artists, and travelling artists with tattoo shops that rent out booths. {{siteName}} is not a tattoo studio. Artists and shops are independent businesses and are solely responsible for their services, their work, their licences and permits, and for following health, safety and hygiene rules.

## 2. Who can use it
You must be at least 18 years old (or the age of majority where you live) to create an account or book a tattoo. The information you give us must be accurate and kept up to date.

## 3. Your account
Keep your password private; you are responsible for what happens under your account. Tell us straight away if you think someone else has access to it. We may suspend or close accounts that break these terms or put other people at risk.

## 4. Bookings and deposits
A booking is a direct arrangement between the client and the artist. It is confirmed only once the artist approves it and any deposit has been paid. Deposits are collected by {{siteName}} on the artist's behalf and passed on to the artist. Cancellations, rescheduling and refunds follow the [Booking & Cancellation Policy](/p/booking-policy).

## 5. Booth rentals
Artists who rent a booth pay the price shown when booking, and must follow the shop's rules and all local regulations while working there. Rental payments are collected by {{siteName}} and passed on to the shop, minus the platform fee shown to the shop.

## 6. Paid plans
Artists may be offered an optional monthly plan ("Pro"). It is charged to the card you save and renews automatically each month until you cancel. You can cancel any time in Settings; you keep the plan until the end of the period you've paid for. If the price changes, we'll tell you in advance by email and the new price applies from your next renewal. Payments for past periods are not refunded, except where the law requires it.

## 7. Payments
Payments are processed by Square, subject to Square's own terms. {{siteName}} never sees or stores your full card number. Fees are always shown before you pay.

## 8. Your content
You keep ownership of the photos, text and reviews you post. You give {{siteName}} permission to store and display them on the site so we can run the service. Only post content you have the right to share. Reviews must be honest and based on a real appointment or rental. We may remove content that breaks these terms.

## 9. Things you must not do
Don't harass, threaten or deceive other people; post illegal, hateful or sexually explicit content; make fake bookings or reviews; send spam; impersonate anyone; or try to break, overload or get around the security of the site.

## 10. Health and safety
Tattooing carries health risks. Clients should discuss allergies, medical conditions and aftercare with their artist. {{siteName}} does not give medical advice and is not responsible for the work or advice of artists and shops.

## 11. Disclaimers and liability
The site is provided "as is". To the fullest extent the law allows, {{siteName}} is not responsible for the work, conduct or premises of artists and shops, for disputes between users, or for indirect or consequential losses. Where we are responsible, our total liability is limited to the fees you paid to {{siteName}} in the 12 months before the claim. Nothing in these terms limits rights you have under consumer protection law.

## 12. Ending your account
You can delete your account at any time in Settings. We may suspend or end access to the site for anyone who breaks these terms.

## 13. Changes
We may update these terms from time to time. If we make important changes we'll let you know on the site or by email. Continuing to use {{siteName}} afterwards means you accept the updated terms.

## 14. Contact
Questions about these terms? Contact us through {{contact}}.`,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    body: `This policy explains what personal information {{siteName}} ({{siteUrl}}) collects, why, and the choices you have.

## What we collect
- **Account details:** your name, email address, city and account type. Your password is stored only in scrambled (hashed) form.
- **Artist and shop profiles:** bio, photos, services and prices, working hours, shop address and payout details.
- **Bookings:** the date, your tattoo idea, size, placement, budget and any reference photos you attach. Guests also give their name, email and (optionally) phone number.
- **Messages** you send through the site, and **reviews** you write.
- **Payments:** Square processes all card payments. We receive the payment result and, for saved cards, the card brand and last four digits — never your full card number.
- **Technical information:** a login cookie, and your IP address, which our server uses for security and to prevent abuse.

## How we use it
To run the marketplace — bookings, payments, payouts, messages and reviews; to send you emails about your bookings and account; to keep the site secure and prevent fraud and spam; and to meet legal and accounting obligations. We do not sell your personal information and we don't use advertising trackers.

## Who we share it with
- **The artist or shop you book with** — your name, contact details and booking details, so they can serve you.
- **Square** — to process payments.
- **Our email provider** — to deliver emails to you.
- **Our hosting provider** — which stores the site and its data.
- **Google** — the site loads fonts from Google Fonts and, on shop pages, maps from Google Maps, so Google receives your IP address when those load.
- **Authorities** — only when the law requires it.

## Photos
Portfolio and shop photos are public. Reference photos you attach to a booking are shared with that artist and aren't listed publicly. We automatically remove hidden location data from uploaded JPEG photos.

## Cookies
We use one essential cookie to keep you logged in, and your browser remembers display preferences such as light or dark mode. Square's payment form may use its own cookies to prevent fraud. There are no advertising or tracking cookies.

## How long we keep it
We keep your information while your account is open. When you delete your account, your profile, photos, messages and reviews are deleted. Records of bookings and payments are kept without your account where the artist or shop needs them for their own records, and for as long as accounting and tax law requires. Automatic backup copies are replaced within about a week.

## Your choices and rights
- **See your data:** download a copy any time in **Settings → Download my data**.
- **Correct it:** edit your profile and account details in Settings.
- **Delete it:** delete your account in **Settings → Delete account**.
- For anything else, contact us through {{contact}}.

Depending on where you live, you may have further rights under privacy law, including the right to complain to your local data protection authority.

## Security
Connections to the site are encrypted, passwords are hashed, and access to personal information is limited to what's needed to run the service.

## Children
{{siteName}} is not intended for anyone under 18.

## Changes
We may update this policy. The date at the top of this page shows when it last changed; we'll tell you about important changes by email or on the site.

## Contact
Questions or requests about your privacy? Contact us through {{contact}}.`,
  },
];

/** Placeholder text used by earlier versions; pages still showing it are upgraded to the templates above. */
export const OLD_PLACEHOLDERS: Record<string, string[]> = {
  faq: [`## How do deposits work?
When an artist approves your request you'll be asked to pay a deposit to lock in your date. The deposit is put towards the price of your tattoo.

## Do I need an account to book?
No. You can request a booking as a guest — you'll get a private link to check your request and pay your deposit.

## How do guest spots work?
Artists can rent a booth at a participating shop for one or more days. Pay for the booth to confirm it.`],
  'booking-policy': [`## Deposits
Deposits secure your appointment and are generally non-refundable. They are applied to the final price of your tattoo.

## Rescheduling
Contact your artist as early as possible if you need to change your appointment.

## No-shows
Missing an appointment without notice may forfeit your deposit.`],
  terms: ['Edit this page from the admin panel (Admin → Pages) to add your terms of service.'],
  privacy: ['Edit this page from the admin panel (Admin → Pages) to add your privacy policy.'],
};

/** Fills in {{siteName}}, {{siteUrl}} and {{contact}} (the contact email if set, otherwise the contact form). */
export function fillPageTokens(body: string, s: { siteName: string; contactEmail: string }, siteUrl: string): string {
  const contact = s.contactEmail ? `[${s.contactEmail}](mailto:${s.contactEmail})` : '[our contact form](/contact)';
  return body.replaceAll('{{siteName}}', s.siteName).replaceAll('{{siteUrl}}', siteUrl).replaceAll('{{contact}}', contact);
}
