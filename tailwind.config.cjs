/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  content: ['./client/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  // `hover:` only applies on devices that can really hover (no stuck hover states after a tap on phones).
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      // Body text in IBM Plex Sans; large headings in Young Serif (sign-painter warmth that suits tattoo shops).
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Young Serif"', 'Georgia', 'serif'],
      },
      // Tighter corners than Tailwind's defaults: cards 8px, buttons and fields 6px.
      borderRadius: { lg: '0.375rem', xl: '0.5rem', '2xl': '0.5rem', '3xl': '0.75rem' },
      colors: {
        // Warm neutrals (paper and ink) instead of Tailwind's blue-tinted grays.
        gray: colors.stone,
        'brand-primary': 'rgb(var(--brand-primary) / <alpha-value>)',
        'brand-secondary': 'rgb(var(--brand-secondary) / <alpha-value>)',
        'brand-dark': '#14120F', // ink
        'brand-light': '#F2EEE6', // paper
        // Secondary text: darker in light mode, lighter in dark mode, so it stays readable (WCAG AA) in both.
        'brand-gray': 'rgb(var(--brand-gray) / <alpha-value>)',
        // Brand-colored backgrounds that carry text (a deeper shade when needed), and the text on them.
        'brand-solid': 'rgb(var(--brand-solid) / <alpha-value>)',
        'brand-secondary-solid': 'rgb(var(--brand-secondary-solid) / <alpha-value>)',
        'on-primary': 'rgb(var(--brand-on-primary) / <alpha-value>)',
        // Brand colors as readable text (for gradient text, which can't use text-* colors).
        'brand-primary-text': 'rgb(var(--brand-primary-text) / <alpha-value>)',
        'brand-secondary-text': 'rgb(var(--brand-secondary-text) / <alpha-value>)',
        'on-secondary': 'rgb(var(--brand-on-secondary) / <alpha-value>)',
        'on-gradient': 'rgb(var(--brand-on-gradient) / <alpha-value>)',
      },
      // As text, brand colors use shades adjusted for contrast against the page (see client/lib/theme.ts).
      textColor: {
        'brand-primary': 'rgb(var(--brand-primary-text) / <alpha-value>)',
        'brand-secondary': 'rgb(var(--brand-secondary-text) / <alpha-value>)',
      },
      // Motion: a strong ease-out for things appearing (moves at once, settles gently) and an iOS-like
      // curve for bottom sheets. Under prefers-reduced-motion these all become a plain fade (styles.css).
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-up': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'toast-out': { to: { opacity: '0', transform: 'translateY(8px) scale(0.98)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        // Pop-ups centered on a large screen.
        'scale-up': 'scale-up 200ms cubic-bezier(0.23, 1, 0.32, 1)',
        // Dropdown menus; pair with an origin-* class so they grow from their button.
        'pop-in': 'scale-up 150ms cubic-bezier(0.23, 1, 0.32, 1)',
        'slide-up': 'slide-up 250ms cubic-bezier(0.23, 1, 0.32, 1)',
        // Pop-ups on phones, which sit at the bottom of the screen.
        'sheet-up': 'sheet-up 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        // Toasts leave faster than they arrive, back the way they came.
        'toast-out': 'toast-out 150ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
        // A quicker spinner makes waiting feel shorter.
        spin: 'spin 0.75s linear infinite',
      },
    },
  },
  plugins: [],
};
