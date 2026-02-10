import { config } from './config/env.js';
import { buildServer } from './server.js';
import { logger } from './lib/logger.js';
import { sqlite } from './db/client.js';
import { registerJobs } from './jobs/scheduler.js';

async function main() {
  const app = await buildServer();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    await app.close();
    sqlite.close();
    logger.info('Server shut down gracefully');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled rejection');
  });

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(`Server running on port ${config.PORT}`);

  // Start cron jobs after server is listening
  registerJobs();
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
