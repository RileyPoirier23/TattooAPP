// Full user journeys through the real site in a browser.
import { test, expect, type Page } from '@playwright/test';

// Stand-in for Square's card form so tests never touch real payments.
const FAKE_SQUARE_SDK = `
window.Square = { payments: function () { return { card: async function () { return {
  attach: async function (el) { var d = typeof el === 'string' ? document.querySelector(el) : el; d.innerHTML = '<input data-testid="fake-card" placeholder="Card number" />'; },
  tokenize: async function () { return { status: 'OK', token: 'cnon:card-nonce-ok' }; },
  destroy: async function () { return true; }
}; } }; } };`;

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
  await dialog.getByRole('button', { name: / 15 \d{4}$/ }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByLabel(/Width/).fill('2');
  await dialog.getByLabel(/Height/).fill('3');
  await dialog.getByLabel(/Placement/).selectOption('Forearm');
  await dialog.getByLabel(/Describe your idea/).fill('A small sprig of lavender on my inner forearm.');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByLabel('Full name *').fill('Gina Guest');
  await dialog.getByLabel('Email *').fill('gina@example.com');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog.getByText('Request sent!')).toBeVisible();
  const guestLink = await dialog.locator('a[href*="/booking/"]').getAttribute('href');
  expect(guestLink).toBeTruthy();

  // The artist approves it.
  await logIn(page, artist.email, artist.password);
  await page.goto('/dashboard');
  await expect(page.getByText('Gina Guest')).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Approved — the client/)).toBeVisible();

  // The guest pays from their private link.
  await logOut(page);
  await page.goto(guestLink!);
  await expect(page.getByText('approved your request')).toBeVisible();
  await page.getByRole('button', { name: /Pay \$61\.74|Pay CA\$61\.74/ }).click();
  await expect(page.getByTestId('fake-card')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Pay .*61\.74/ }).click();
  await expect(page.getByText("Deposit paid — you're booked!")).toBeVisible();
  await expect(page.getByText('Deposit paid', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Booth paid — your guest spot is confirmed!')).toBeVisible();
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
