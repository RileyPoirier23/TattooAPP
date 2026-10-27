// Full user journeys through the real site in a browser.
import { test, expect, type Page } from '@playwright/test';

// Stand-in for Square's card form so tests never touch real payments.
const FAKE_SQUARE_SDK = `
window.Square = { payments: function () { return { card: async function () { return {
  attach: async function (el) { var d = typeof el === 'string' ? document.querySelector(el) : el; d.innerHTML = '<input data-testid="fake-card" placeholder="Card number" />'; },
  tokenize: async function () { return { status: 'OK', token: 'cnon:card-nonce-ok' }; },
  destroy: async function () { return true; }
}; } }; } };`;

// A 1×1 pixel PNG for portfolio uploads.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1f3d6a00000000049454e44ae426082',
  'hex',
);

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/v1/square.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SQUARE_SDK }));
  // No external fonts/maps during tests.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
});

test.afterEach(() => {
  expect(errors, 'no uncaught errors in the page').toEqual([]);
});

const stamp = Date.now();
const artist = { name: 'Riley Ink', email: `artist-${stamp}@example.com`, password: 'password123' };
const owner = { name: 'Sam Shop', email: `owner-${stamp}@example.com`, password: 'password123' };

async function signUp(page: Page, role: RegExp, user: { name: string; email: string; password: string }, city?: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign up' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: role }).click();
  await dialog.getByLabel(/name/i).first().fill(user.name);
  if (city) await dialog.getByLabel('City you work in').fill(city);
  await dialog.getByLabel('Email').fill(user.email);
  await dialog.getByLabel('Password').fill(user.password);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(dialog).toBeHidden();
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log in' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Password').fill(password);
  await dialog.getByRole('button', { name: 'Log in' }).click();
  await expect(dialog).toBeHidden();
}

async function logOut(page: Page) {
  await page.context().clearCookies();
}

test('artist sets up profile, guest books and pays a deposit', async ({ page }) => {
  await signUp(page, /^Artist I tattoo/, artist, 'Moncton, NB');
  await expect(page).toHaveURL(/\/dashboard\?tab=profile/);

  await page.getByLabel('Bio').fill('Fine line and botanical tattoos. 10 years of experience.');
  await page.getByLabel('Main style').selectOption('Fine Line');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved!')).toBeVisible();
  // Artists show up in search once they have a portfolio photo.
  await page.getByLabel('Add photos').setInputFiles({ name: 'work.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Uploaded!')).toBeVisible();

  await page.getByRole('link', { name: 'Services & prices' }).click();
  await page.getByRole('button', { name: 'Add service' }).click();
  await page.getByLabel('Name').fill('Small tattoo');
  await page.getByLabel('Deposit').fill('60');
  await page.getByRole('button', { name: 'Save services' }).click();
  await expect(page.getByText('Services saved!')).toBeVisible();

  // A guest finds the artist and requests a booking.
  await logOut(page);
  await page.goto('/artists');
  await page.getByRole('link', { name: /Riley Ink/ }).click();
  await expect(page.getByRole('heading', { name: 'Riley Ink' })).toBeVisible();
  await page.getByRole('button', { name: 'Request a booking' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Next month' }).click();
  await dialog.getByRole('button', { name: / 15, \d{4}$/ }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByLabel(/Width/).fill('2');
  await dialog.getByLabel(/Height/).fill('3');
  await dialog.getByLabel(/Placement/).selectOption('Forearm');
  await dialog.getByLabel(/Describe your idea/).fill('A small sprig of lavender on my inner forearm.');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByLabel('Full name *').fill('Gina Guest');
  await dialog.getByLabel('Email *').fill('gina@example.com');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog.getByText('Request sent!')).toBeVisible();
  const guestLink = await dialog.locator('a[href*="/booking/"]').getAttribute('href');
  expect(guestLink).toBeTruthy();

  // The artist approves it.
  await logIn(page, artist.email, artist.password);
  await page.goto('/dashboard');
  await expect(page.getByText('Gina Guest')).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByLabel('Start time').fill('13:30');
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Approved. The client/)).toBeVisible();

  // The guest pays from their private link.
  await logOut(page);
  await page.goto(guestLink!);
  await expect(page.getByText('approved your request')).toBeVisible();
  await page.getByRole('button', { name: /Pay \$61\.74|Pay CA\$61\.74/ }).click();
  await expect(page.getByTestId('fake-card')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Pay .*61\.74/ }).click();
  await expect(page.getByText("Deposit paid. You're booked.")).toBeVisible();
  await expect(page.getByText('Deposit paid', { exact: true })).toBeVisible();
  await expect(page.getByText(/1:30\s?PM/)).toBeVisible();
});

test('shop owner lists a booth and an artist rents it', async ({ page }) => {
  await signUp(page, /^Shop owner/, owner);
  await expect(page).toHaveURL(/\/shop/);
  await page.getByLabel('Shop name').fill('Ink & Dagger');
  await page.getByLabel('Street address').fill('12 Main St');
  await page.getByLabel('City').fill('Halifax, NS');
  await page.getByLabel('Amenities').fill('WiFi, Parking');
  await page.getByRole('button', { name: 'Create my shop' }).click();
  await expect(page.getByText('Your shop is live!')).toBeVisible();
  await page.getByRole('button', { name: 'Add booth' }).click();
  await page.getByRole('dialog').getByLabel('Booth name').fill('Window station');
  await page.getByRole('dialog').getByLabel('Daily rate').fill('90');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Booth added.')).toBeVisible();

  await logOut(page);
  await logIn(page, artist.email, artist.password);
  await page.goto('/shops');
  await page.getByRole('link', { name: /Ink & Dagger/ }).click();
  await page.getByRole('button', { name: 'Book', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const start = new Date();
  start.setDate(start.getDate() + 20);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await dialog.getByLabel('First day').fill(iso(start));
  await dialog.getByLabel('Last day').fill(iso(end));
  await expect(dialog.getByText(/3 days/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Reserve & pay' }).click();
  await expect(page.getByTestId('fake-card')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Pay .*270\.00/ }).click();
  await expect(page.getByText('Booth paid. Your guest spot is confirmed.')).toBeVisible();
  await expect(page).toHaveURL(/\/bookings/);
  await expect(page.getByText('Window station at Ink & Dagger')).toBeVisible();
});

test('pages work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Find an artist' }).first().click();
  await expect(page.getByRole('heading', { name: 'Find an artist' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.goto('/p/faq');
  await expect(page.getByRole('heading', { name: 'FAQ' })).toBeVisible();
});

test('long names, links and place names fit on a small phone', async ({ page }) => {
  // Realistic worst-case data: diacritics, an unbroken link in the bio and a one-word place name.
  const longCity = 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, Wales';
  const api = (method: string, url: string, data: object) =>
    page.request.fetch(url, { method, data, headers: { 'x-requested-with': 'inkspace' } });
  const reg = await api('POST', '/api/auth/register', {
    name: 'Aleksandra Wiśniewska-Kowalczyk', email: `long-${stamp}@example.com`, password: 'password123', role: 'artist', city: longCity, acceptTerms: true,
  });
  expect(reg.ok()).toBe(true);
  const { user } = await reg.json();
  const patch = await api('PATCH', '/api/me', {
    specialty: 'Fine line, micro-realism & single-needle botanicals',
    bio: 'Booking through https://www.instagram.com/aleksandra.wisniewska.kowalczyk.tattoo.studio/ or here.',
  });
  expect(patch.ok()).toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`/artists/${user.id}`);
  await expect(page.getByRole('heading', { name: /Aleksandra/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('visitors can contact the owner, who answers from the admin inbox', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Contact us' }).click();
  await expect(page.getByRole('heading', { name: 'Contact us' })).toBeVisible();
  await page.getByLabel('Your name').fill('Vera Visitor');
  await page.getByLabel('Your email').fill('vera@example.com');
  await page.getByLabel('Message').fill('Do you have any artists who do fine line work in Halifax?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Message sent')).toBeVisible();

  await logIn(page, 'admin@example.com', 'admin-password');
  await page.goto('/admin/inbox');
  await expect(page.getByText('Do you have any artists who do fine line work in Halifax?')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as replied' }).click();
  await expect(page.getByText('No new messages')).toBeVisible();

  // Unsaved changes are protected when leaving a form.
  await page.goto('/admin/customize');
  await page.getByLabel('Site name').fill('Unsaved name');
  page.once('dialog', d => d.dismiss());
  await page.getByRole('link', { name: 'Users' }).first().click();
  await expect(page).toHaveURL(/\/admin\/customize/);
});

test('admin customizes the site and refunds a payment', async ({ page }) => {
  await logIn(page, 'admin@example.com', 'admin-password');
  await expect(page).toHaveURL(/\/admin/);
  await page.goto('/admin/customize');
  await page.getByLabel('Site name').fill('Moncton Ink Co');
  await page.getByRole('button', { name: 'Save changes' }).first().click();
  await expect(page.locator('header').getByText('Moncton Ink Co')).toBeVisible();

  await page.goto('/admin/payments');
  await page.getByRole('button', { name: 'Refund', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /^Refund / }).click();
  await expect(page.getByText(/Refunded .* The payer has been notified/)).toBeVisible();

  // Non-admins can't reach the admin panel.
  await logOut(page);
  await logIn(page, artist.email, artist.password);
  await page.goto('/admin');
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
});
