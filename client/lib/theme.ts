// Applies admin-chosen brand colors and the light/dark theme to the page.
import type { SiteSettings } from '../../shared/types';

function hexToRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function applyBranding(s: SiteSettings) {
  const root = document.documentElement.style;
  const p = hexToRgb(s.primaryColor);
  const sec = hexToRgb(s.secondaryColor);
  if (p) root.setProperty('--brand-primary', p);
  if (sec) root.setProperty('--brand-secondary', sec);
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
