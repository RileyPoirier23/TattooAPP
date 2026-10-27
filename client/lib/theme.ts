// Applies admin-chosen brand colors and the light/dark theme to the page.
import type { SiteSettings } from '../../shared/types';
import { BLACK, INK, WHITE, contrast, mix, parseHex, solid, type RGB } from '../../shared/color';

const css = (c: RGB) => c.join(' ');

const LIGHT_SURFACE: RGB = [231, 229, 228]; // the darkest light-mode background text sits on (stone-200)
const DARK_SURFACE: RGB = [41, 37, 36]; // the lightest dark-mode background text sits on (stone-800)

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
  // Phone status bar / browser chrome follows the theme (the header's background colour).
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#14120F' : '#F2EEE6';
}
