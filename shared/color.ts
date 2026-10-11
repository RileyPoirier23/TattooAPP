// Color math shared by the site (brand colors in the browser) and the server (email buttons).

export type RGB = [number, number, number];

export const WHITE: RGB = [255, 255, 255];
export const BLACK: RGB = [0, 0, 0];
export const INK: RGB = [16, 16, 20];

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = (c: RGB) => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;

/** WCAG relative luminance and contrast ratio. */
function luminance([r, g, b]: RGB) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;

/**
 * A solid brand-colored background with text on it (buttons, badges, chat bubbles), readable at normal text size
 * (WCAG AA, 4.5:1). White text when the color allows it — if needed on a slightly deeper shade (up to 20% darker).
 * Brighter colors (yellows, oranges, sky blues, pastels) keep their color and get dark text instead.
 */
export function solid(color: RGB): { bg: RGB; fg: RGB } {
  for (let t = 0; t <= 0.20001; t += 0.05) {
    const bg = mix(color, BLACK, t);
    if (contrast(WHITE, bg) >= 4.5) return { bg, fg: WHITE };
  }
  return { bg: color, fg: INK };
}
