import type { FastifyInstance } from 'fastify';
import { sqlite } from '../db/client.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    try {
      // Quick DB connectivity check
      const result = sqlite.prepare('SELECT 1 AS ok').get() as { ok: number };
      return reply.send({
        status: 'ok',
        db: result.ok === 1 ? 'connected' : 'error',
        uptime: process.uptime(),
      });
    } catch {
      return reply.status(503).send({
        status: 'error',
        db: 'disconnected',
      });
    }
  });
}
