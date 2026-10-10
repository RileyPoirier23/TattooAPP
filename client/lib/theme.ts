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

const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;

/**
 * The brand color, darkened or lightened just enough to be readable as text on the given backgrounds
 * (the page itself and light brand-tinted boxes like badges and selected items).
 */
function readable(color: RGB, surface: RGB, towards: RGB, min: number): RGB {
  const backgrounds = [surface, mix(surface, color, 0.15)];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(color, towards, t);
    if (backgrounds.every(bg => contrast(c, bg) >= min)) return c;
  }
  return towards;
}

/**
 * A solid brand-colored background with text on it (buttons, badges, chat bubbles), readable at normal text size
 * (WCAG AA, 4.5:1). White text when the color allows it — if needed on a slightly deeper shade (up to 20% darker).
 * Brighter colors (yellows, oranges, sky blues, pastels) keep their color and get dark text instead.
 */
function solid(color: RGB): { bg: RGB; fg: RGB } {
  for (let t = 0; t <= 0.20001; t += 0.05) {
    const bg = mix(color, BLACK, t);
    if (contrast(WHITE, bg) >= 4.5) return { bg, fg: WHITE };
  }
  return { bg: color, fg: INK };
}

/** One text color for a gradient between two solid backgrounds: whichever reads better at its worst point. */
const onGradient = (a: RGB, b: RGB) => (Math.min(contrast(WHITE, a), contrast(WHITE, b)) >= Math.min(contrast(INK, a), contrast(INK, b)) ? WHITE : INK);

/** All brand CSS variables for a pair of brand colors (also used by the live preview in Admin → Customize). */
export function brandVariables(primaryHex: string, secondaryHex: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const p = parseHex(primaryHex);
  const sec = parseHex(secondaryHex);
  if (p) {
    const s = solid(p);
    vars['--brand-primary'] = css(p);
    vars['--brand-solid'] = css(s.bg);
    vars['--brand-on-primary'] = css(s.fg);
    vars['--brand-primary-text-light'] = css(readable(p, LIGHT_SURFACE, BLACK, 4.5));
    vars['--brand-primary-text-dark'] = css(readable(p, DARK_SURFACE, WHITE, 4.5));
  }
  if (sec) {
    const s = solid(sec);
    vars['--brand-secondary'] = css(sec);
    vars['--brand-secondary-solid'] = css(s.bg);
    vars['--brand-on-secondary'] = css(s.fg);
    // Mostly icons and badges, which need 3:1.
    vars['--brand-secondary-text-light'] = css(readable(sec, LIGHT_SURFACE, BLACK, 3));
    vars['--brand-secondary-text-dark'] = css(readable(sec, DARK_SURFACE, WHITE, 3));
  }
  if (p && sec) vars['--brand-on-gradient'] = css(onGradient(solid(p).bg, solid(sec).bg));
  return vars;
}

/** How buttons in this color will look: as chosen, a slightly deeper shade (for white text), or with dark text. */
export function buttonStyle(hex: string): 'as-is' | 'deeper' | 'dark-text' | null {
  const c = parseHex(hex);
  if (!c) return null;
  const s = solid(c);
  return s.fg === INK ? 'dark-text' : s.bg.every((v, i) => v === c[i]) ? 'as-is' : 'deeper';
}

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
