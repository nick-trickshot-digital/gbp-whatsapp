import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import { config } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhook.js';
import { oauthRoutes } from './routes/oauth.js';
import { adminRoutes } from './admin/index.js';
import { globalErrorHandler } from './middleware/error-handler.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : {}),
    },
  });

  app.setErrorHandler(globalErrorHandler);

  await app.register(cors);
  await app.register(cookie);
  await app.register(formbody);

  // Routes
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(oauthRoutes);
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}
