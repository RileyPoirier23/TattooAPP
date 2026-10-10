// Environment configuration. Everything here can also be left unset for local development.
import path from 'node:path';

const env = process.env;
const dataDir = path.resolve(env.DATA_DIR || './data');
// Railway provides RAILWAY_PUBLIC_DOMAIN automatically, so links in emails work even if APP_URL wasn't set.
const appUrl = (
  env.APP_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${env.PORT || 3000}`)
).replace(/\/$/, '');

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
  // How many proxies sit in front of the app (Railway/Render/Fly: 1). Used for correct client IPs in rate limits.
  trustProxy: env.TRUST_PROXY !== undefined ? Number(env.TRUST_PROXY) : 1,
  disableJobs: env.DISABLE_JOBS === 'true',
};
