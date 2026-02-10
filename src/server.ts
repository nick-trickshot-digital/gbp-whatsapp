import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './lib/logger.js';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhook.js';
import { oauthRoutes } from './routes/oauth.js';
import { globalErrorHandler } from './middleware/error-handler.js';

export async function buildServer() {
  const app = Fastify({
    logger: logger,
  });

  app.setErrorHandler(globalErrorHandler);

  await app.register(cors);

  // Routes
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(oauthRoutes);

  return app;
}
