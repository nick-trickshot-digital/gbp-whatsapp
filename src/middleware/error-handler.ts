import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('error-handler');

export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  log.error(
    { err: error, requestId: request.id, url: request.url },
    'Unhandled error',
  );

  // Always return 200 for webhook endpoints to prevent Meta from retrying
  if (request.url.startsWith('/webhook')) {
    return reply.status(200).send({ status: 'error_handled' });
  }

  return reply.status(500).send({ error: 'Internal server error' });
}
