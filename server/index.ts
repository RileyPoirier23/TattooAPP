// Entry point: open the database, seed defaults, start background jobs and the web server.
import { config } from './config';
import { getDb } from './db';
import { seedDefaults } from './settings';
import { ensureAdminFromEnv } from './auth';
import { createApp } from './app';
import { startJobs, stopJobs } from './jobs';
import { closeAllStreams } from './events';
import { locationCurrency, paymentsReady } from './square';

async function main() {
  getDb();
  seedDefaults();
  await ensureAdminFromEnv();
  if (!config.disableJobs) startJobs();
  // Make sure prices are shown in the same currency Square charges in.
  if (paymentsReady()) locationCurrency().catch(() => {});
  if (config.isProduction && config.appUrlMissing) {
    console.warn('[setup] APP_URL is not set — links in emails will point to localhost. Set APP_URL to your site address.');
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`InkSpace running at ${config.appUrl} (port ${config.port}, data in ${config.dataDir})`);
  });

  // Hosts send SIGTERM before replacing the app (e.g. on every deploy): finish what's in progress, then exit.
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[server] ${signal} received, shutting down…`);
    const exit = () => {
      try {
        getDb().close();
      } catch {
        /* already closed */
      }
      process.exit(0);
    };
    setTimeout(exit, 8000).unref(); // never hang longer than most hosts wait
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    closeAllStreams();
    server.closeIdleConnections();
    await Promise.all([closed, stopJobs()]);
    exit();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
