// Loads Square's Web Payments SDK on demand.
// https://developer.squareup.com/docs/web-payments/overview

declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments };
  }
}

export interface SquareCard {
  attach: (selector: string | HTMLElement) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => Promise<boolean>;
}
export interface SquarePayments {
  card: (options?: Record<string, unknown>) => Promise<SquareCard>;
}

let loading: Promise<void> | null = null;
let loadedEnv: string | null = null;

export function loadSquare(environment: 'sandbox' | 'production'): Promise<void> {
  if (window.Square && loadedEnv === environment) return Promise.resolve();
  if (loading && loadedEnv === environment) return loading;
  loadedEnv = environment;
  const src = environment === 'production' ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js';
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load the payment form. Check your connection or disable ad blockers and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
