// Applies admin-chosen brand colors and the light/dark theme to the page.
import type { SiteSettings } from '../../shared/types';

type RGB = [number, number, number];

function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const css = (c: RGB) => c.join(' ');

/** WCAG relative luminance and contrast ratio. */
function luminance([r, g, b]: RGB) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const INK: RGB = [16, 16, 20];
const LIGHT_SURFACE: RGB = [243, 244, 246]; // the darkest light-mode background text sits on
const DARK_SURFACE: RGB = [31, 41, 55]; // the lightest dark-mode background text sits on

/** The brand color, darkened or lightened just enough to be readable as text on the given background. */
function readable(color: RGB, background: RGB, towards: RGB, min: number): RGB {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = color.map((v, i) => Math.round(v + (towards[i] - v) * t)) as RGB;
    if (contrast(c, background) >= min) return c;
  }
  return towards;
}

/** Text on a colored button: white, unless the color is so light that white would be hard to read. */
const onColor = (...backgrounds: RGB[]) => (backgrounds.every(bg => contrast(WHITE, bg) >= 3) ? WHITE : INK);

/** All brand CSS variables for a pair of brand colors (also used by the live preview in Admin → Customize). */
export function brandVariables(primaryHex: string, secondaryHex: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const p = parseHex(primaryHex);
  const sec = parseHex(secondaryHex);
  if (p) {
    vars['--brand-primary'] = css(p);
    vars['--brand-on-primary'] = css(onColor(p));
    vars['--brand-primary-text-light'] = css(readable(p, LIGHT_SURFACE, BLACK, 4.5));
    vars['--brand-primary-text-dark'] = css(readable(p, DARK_SURFACE, WHITE, 4.5));
  }
  if (sec) {
    vars['--brand-secondary'] = css(sec);
    vars['--brand-on-secondary'] = css(onColor(sec));
    // Mostly icons and badges, which need 3:1.
    vars['--brand-secondary-text-light'] = css(readable(sec, LIGHT_SURFACE, BLACK, 3));
    vars['--brand-secondary-text-dark'] = css(readable(sec, DARK_SURFACE, WHITE, 3));
  }
  if (p && sec) vars['--brand-on-gradient'] = css(onColor(p, sec));
  return vars;
}

/** True when white text on this color would be hard to read, so buttons switch to dark text. */
export const needsDarkText = (hex: string) => {
  const c = parseHex(hex);
  return !!c && onColor(c) === INK;
};

export function applyBranding(s: SiteSettings) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(brandVariables(s.primaryColor, s.secondaryColor))) root.setProperty(k, v);
  document.title = s.siteName;
  if (s.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = s.faviconUrl;
  }
}

export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
