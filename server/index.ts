// Entry point: open the database, seed defaults, start background jobs and the web server.
import { config } from './config';
import { getDb } from './db';
import { seedDefaults } from './settings';
import { ensureAdminFromEnv } from './auth';
import { createApp } from './app';
import { startJobs } from './jobs';
import { locationCurrency, paymentsReady } from './square';

async function main() {
  getDb();
  seedDefaults();
  await ensureAdminFromEnv();
  if (!config.disableJobs) startJobs();
  // Make sure prices are shown in the same currency Square charges in.
  if (paymentsReady()) locationCurrency().catch(() => {});

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`InkSpace running at ${config.appUrl} (port ${config.port}, data in ${config.dataDir})`);
  });

  const shutdown = () => {
    server.close(() => {
      getDb().close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
