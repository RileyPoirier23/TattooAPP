// Environment configuration. Everything here can also be left unset for local development.
import path from 'node:path';

const env = process.env;
const dataDir = path.resolve(env.DATA_DIR || './data');
// Railway provides RAILWAY_PUBLIC_DOMAIN automatically, so links in emails work even if APP_URL wasn't set.
const appUrl = (
  env.APP_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${env.PORT || 3000}`)
).replace(/\/$/, '');

const onKnownPlatform = !!(
  env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID || env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME ||
  env.RENDER || env.FLY_APP_NAME || env.DYNO
);

/** TRUST_PROXY: a hop count ("1"), "true"/"false", or addresses/names Express understands ("loopback, 10.0.0.0/8"). */
function parseTrustProxy(value: string | undefined): number | boolean | string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
}

export const config = {
  port: Number(env.PORT || 3000),
  isProduction: env.NODE_ENV === 'production',
  appUrl,
  dataDir,
  databaseFile: env.DATABASE_FILE || path.join(dataDir, 'inkspace.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  publicDir: path.resolve(env.PUBLIC_DIR || './dist/public'),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : appUrl.startsWith('https://'),
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  adminResetPassword: env.ADMIN_RESET_PASSWORD === 'true',
  // Optional overrides for settings that can also be managed in the admin panel.
  squareAccessToken: env.SQUARE_ACCESS_TOKEN || '',
  squareApplicationId: env.SQUARE_APPLICATION_ID || '',
  squareLocationId: env.SQUARE_LOCATION_ID || '',
  squareEnvironment: env.SQUARE_ENVIRONMENT as 'sandbox' | 'production' | undefined,
  squareApiBase: env.SQUARE_API_BASE || '', // tests point this at a mock server
  smtpUrl: env.SMTP_URL || '',
  smtpFrom: env.SMTP_FROM || '',
  resendApiKey: env.RESEND_API_KEY || '',
  appUrlMissing: !env.APP_URL && !env.RAILWAY_PUBLIC_DOMAIN,
  // Which proxies to believe about the visitor's real IP (used by the rate limits). Railway, Render, Fly and
  // Heroku put exactly one proxy in front of the app; anywhere else only a proxy on the same machine (e.g. nginx)
  // is trusted, so visitors can't fake their IP with an X-Forwarded-For header. Override with TRUST_PROXY.
  trustProxy: parseTrustProxy(env.TRUST_PROXY) ?? (onKnownPlatform ? 1 : 'loopback'),
  disableJobs: env.DISABLE_JOBS === 'true',
};
