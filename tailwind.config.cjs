/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./client/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        'brand-primary': 'rgb(var(--brand-primary) / <alpha-value>)',
        'brand-secondary': 'rgb(var(--brand-secondary) / <alpha-value>)',
        'brand-dark': '#101014',
        'brand-light': '#F5F5F7',
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
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-up': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-up': 'scale-up 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
