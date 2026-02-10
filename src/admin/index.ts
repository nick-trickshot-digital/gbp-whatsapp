import type { FastifyInstance } from 'fastify';
import { requireAdmin } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { activityRoutes } from './routes/activity.js';
import { reviewRoutes } from './routes/reviews.js';

export async function adminRoutes(app: FastifyInstance) {
  // Unauthenticated routes (login/logout)
  await app.register(authRoutes);

  // Authenticated routes — auth guard applied to this scope
  await app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', requireAdmin);

    // Root redirect
    protectedApp.get('/', async (_request, reply) => {
      reply.redirect('/admin/clients');
    });

    await protectedApp.register(clientRoutes);
    await protectedApp.register(activityRoutes);
    await protectedApp.register(reviewRoutes);
  });
}
