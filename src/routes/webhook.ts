import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env.js';
import { parseWebhookPayload } from '../services/whatsapp/webhook.js';
import { validateSignature } from '../middleware/signature-validation.js';
import { lookupClientByPhone } from '../lib/phone.js';
import { createChildLogger } from '../lib/logger.js';
import { executePhotoPipeline } from '../workflows/photo-pipeline.js';
import {
  handleApprovalResponse,
  handleCustomReply,
} from '../workflows/review-response.js';
import { executeGbpPost } from '../workflows/gbp-post.js';
import { WhatsAppService } from '../services/whatsapp/client.js';
import type { WhatsAppWebhookPayload, ParsedMessage } from '../services/whatsapp/types.js';

const log = createChildLogger('webhook');
const whatsapp = new WhatsAppService();

export async function webhookRoutes(app: FastifyInstance) {
  // Register a custom content type parser to capture raw body for signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      try {
        // Store the actual raw bytes for HMAC signature verification
        (req as FastifyRequest & { rawBody?: Buffer }).rawBody = body as Buffer;
        const json = JSON.parse(body.toString());
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // GET /webhook — Meta verification endpoint
  app.get('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
      log.info('Webhook verification successful');
      return reply.status(200).send(challenge);
    }

    log.warn({ mode, token }, 'Webhook verification failed');
    return reply.status(403).send({ error: 'Verification failed' });
  });

  // POST /webhook — Inbound message handler
  app.post(
    '/webhook',
    { preHandler: validateSignature },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Always respond 200 immediately to prevent Meta retries
      reply.status(200).send({ status: 'received' });

      try {
        const payload = request.body as WhatsAppWebhookPayload;
        const message = parseWebhookPayload(payload);

        if (!message) {
          log.debug('No processable message in webhook payload');
          return;
        }

        log.info(
          { type: message.type, from: message.from },
          'Processing inbound message',
        );

        await handleInboundMessage(message);
      } catch (err) {
        log.error({ err }, 'Error processing webhook');
      }
    },
  );
}

/**
 * Central message router.
 * Routes inbound WhatsApp messages to the correct workflow
 * based on message type and conversation state.
 *
 * Priority order:
 * 1. Check for "awaiting custom reply" state (review edit flow)
 * 2. Route by message type (image → photo pipeline, button → review, text → help)
 */
async function handleInboundMessage(message: ParsedMessage): Promise<void> {
  // 1. Identify client by phone number
  const client = await lookupClientByPhone(message.from);
  if (!client) {
    log.warn({ from: message.from }, 'Message from unknown number, ignoring');
    return;
  }

  if (client.status !== 'active') {
    log.info(
      { clientId: client.id, status: client.status },
      'Message from inactive client, ignoring',
    );
    return;
  }

  // 2. Check for pending custom reply BEFORE checking message type
  if (message.type === 'text') {
    const consumed = await handleCustomReply(client, message.text);
    if (consumed) return;
  }

  // 3. Route by message type
  switch (message.type) {
    case 'image':
      await executePhotoPipeline(client, {
        from: message.from,
        imageId: message.imageId,
        caption: message.caption,
        messageId: message.messageId,
      });
      break;

    case 'button_reply':
      await handleApprovalResponse(client, message.buttonId);
      break;

    case 'text': {
      // Check for "post" command
      const postMatch = message.text.match(/^post\s+(.+)/is);
      if (postMatch) {
        await executeGbpPost(client, postMatch[1].trim(), message.from);
      } else {
        await whatsapp.sendTextMessage(
          message.from,
          'Send a photo with a caption to post it to your Google profile and website!\n\nOr start a message with "post" to publish a text update to your Google profile.',
        );
      }
      break;
    }
  }
}
