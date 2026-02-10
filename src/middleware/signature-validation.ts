import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyWebhookSignature } from '../services/whatsapp/webhook.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('signature');

export async function validateSignature(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const signature = request.headers['x-hub-signature-256'] as string | undefined;

  if (!signature) {
    log.warn('Missing X-Hub-Signature-256 header');
    return reply.status(401).send({ error: 'Missing signature' });
  }

  const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    log.warn('Missing raw body for signature verification');
    return reply.status(400).send({ error: 'Missing body' });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    log.warn('Invalid webhook signature');
    return reply.status(401).send({ error: 'Invalid signature' });
  }
}
