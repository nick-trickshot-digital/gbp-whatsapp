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
import {
  handlePostApproval,
  handlePostEdit,
} from '../workflows/gbp-post.js';
import {
  handleOfferApproval,
  handleOfferEdit,
} from '../workflows/offer-post.js';
import {
  sendMainMenu,
  handleMenuSelection,
  handlePendingMenuAction,
} from '../workflows/menu.js';
import type { WhatsAppWebhookPayload, ParsedMessage } from '../services/whatsapp/types.js';

const log = createChildLogger('webhook');

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
          // Log all unparsed payloads to diagnose missing webhooks
          const entry = payload.entry?.[0];
          const change = entry?.changes?.[0];
          const statuses = change?.value?.statuses;
          if (!statuses) {
            log.info(
              { payload: JSON.stringify(payload).slice(0, 500) },
              'Unparsed webhook payload (not a status update)',
            );
          }
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
 * 1. Check for "awaiting edit" states (post edit, offer edit, review custom reply)
 * 2. Check for pending menu actions (user tapped menu, we're waiting for their input)
 * 3. Route by message type (image → photo pipeline, button → approval, list → menu, text → show menu)
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

  // 2. Check for pending edit states BEFORE checking message type
  if (message.type === 'text') {
    // Post edit takes priority (most recent action)
    const postConsumed = await handlePostEdit(client, message.text);
    if (postConsumed) return;

    // Offer edit
    const offerConsumed = await handleOfferEdit(client, message.text);
    if (offerConsumed) return;

    // Review custom reply
    const reviewConsumed = await handleCustomReply(client, message.text);
    if (reviewConsumed) return;

    // Pending menu action (user selected from menu, we asked for input)
    const menuConsumed = await handlePendingMenuAction(client, message.text, message.from);
    if (menuConsumed) return;
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
      if (message.buttonId.startsWith('post_')) {
        await handlePostApproval(client, message.buttonId);
      } else if (message.buttonId.startsWith('offer_')) {
        await handleOfferApproval(client, message.buttonId);
      } else {
        await handleApprovalResponse(client, message.buttonId);
      }
      break;

    case 'list_reply':
      await handleMenuSelection(client, message.listId, message.from);
      break;

    case 'text':
      // Any unhandled text → show the main menu
      await sendMainMenu(client, message.from);
      break;
  }
}
