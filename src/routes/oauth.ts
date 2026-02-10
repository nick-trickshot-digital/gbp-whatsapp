import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConsentUrl, exchangeCodeForTokens } from '../services/gbp/auth.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('oauth');

export async function oauthRoutes(app: FastifyInstance) {
  // GET /oauth/start?clientId=123 — Generate consent URL for a client
  app.get('/oauth/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { clientId } = request.query as { clientId?: string };

    if (!clientId) {
      return reply.status(400).send({ error: 'clientId query parameter required' });
    }

    const url = getConsentUrl(clientId);
    return reply.redirect(url);
  });

  // GET /oauth/callback — Handle Google OAuth redirect
  app.get('/oauth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) {
      log.error({ error }, 'OAuth consent denied');
      return reply.status(400).send({ error: 'OAuth consent denied', detail: error });
    }

    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state parameter' });
    }

    const clientId = parseInt(state, 10);
    if (isNaN(clientId)) {
      return reply.status(400).send({ error: 'Invalid state parameter' });
    }

    try {
      await exchangeCodeForTokens(clientId, code);
      log.info({ clientId }, 'GBP OAuth completed successfully');
      return reply.redirect('/admin/clients');
    } catch (err) {
      log.error({ err, clientId }, 'Failed to exchange OAuth code');
      return reply.status(500).send({ error: 'Failed to complete OAuth' });
    }
  });
}
