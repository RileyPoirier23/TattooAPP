// Unit tests for browser-side logic that doesn't need a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandVariables, buttonStyle } from '../client/lib/theme';
import { fillPageTokens } from '../client/lib/markdown';
import { fillPageTokens as fillOnServer } from '../server/defaultPages';

type RGB = [number, number, number];
const rgb = (v: string) => v.split(' ').map(Number) as RGB;
function luminance([r, g, b]: RGB) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('default brand colors keep their look', () => {
  const v = brandVariables('#D0281C', '#2F5D50');
  assert.equal(v['--brand-primary'], '208 40 28', 'decorations keep the exact color');
  assert.equal(v['--brand-solid'], '208 40 28', 'the default red is dark enough for white button text as is');
  assert.equal(v['--brand-on-primary'], '255 255 255');
  assert.equal(buttonStyle('#D0281C'), 'as-is');
  assert.equal(buttonStyle('#F04E98'), 'deeper', 'a light pink gets a slightly deeper shade behind white text');
  assert.equal(buttonStyle('#DC2626'), 'as-is');
  assert.equal(buttonStyle('#FFE600'), 'dark-text', 'yellow buttons get dark text');
  assert.equal(buttonStyle('nope'), null);
  assert.deepEqual(brandVariables('not-a-color', 'also-not'), {});
});

test('any brand color stays readable as text and behind button text', () => {
  let seed = 42;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % 256;
  // The darkest light-mode and lightest dark-mode surfaces text sits on (stone-200 / stone-800, see theme.ts).
  const light: RGB = [231, 229, 228];
  const dark: RGB = [41, 37, 36];
  for (let i = 0; i < 300; i++) {
    const c: RGB = [next(), next(), next()];
    const hex = `#${c.map(n => n.toString(16).padStart(2, '0')).join('')}`;
    const v = brandVariables(hex, hex);
    assert.ok(contrast(rgb(v['--brand-primary-text-light']), light) >= 4.5, `${hex} link text on light pages`);
    assert.ok(contrast(rgb(v['--brand-primary-text-dark']), dark) >= 4.5, `${hex} link text on dark pages`);
    assert.ok(contrast(rgb(v['--brand-secondary-text-light']), light) >= 3, `${hex} icons on light pages`);
    assert.ok(contrast(rgb(v['--brand-on-primary']), rgb(v['--brand-solid'])) >= 4.5, `${hex} button text (WCAG AA)`);
    const tint = c.map((x, k) => Math.round(light[k] + (x - light[k]) * 0.15)) as RGB;
    assert.ok(contrast(rgb(v['--brand-primary-text-light']), tint) >= 4.5, `${hex} text on a brand-tinted badge`);
  }
});

test('page placeholders are filled the same way on the server and in the admin preview', () => {
  const body = 'Welcome to {{siteName}} ({{siteUrl}}). Questions? Contact us through {{contact}}.';
  const settings = { siteName: 'Ink Co', contactEmail: '' };
  assert.equal(fillPageTokens(body, settings, 'https://ink.example'), fillOnServer(body, settings, 'https://ink.example'));
  assert.equal(
    fillOnServer(body, settings, 'https://ink.example'),
    'Welcome to Ink Co (https://ink.example). Questions? Contact us through [our contact form](/contact).',
  );
  assert.match(fillOnServer(body, { ...settings, contactEmail: 'hi@ink.example' }, ''), /\[hi@ink\.example\]\(mailto:hi@ink\.example\)/);
});
