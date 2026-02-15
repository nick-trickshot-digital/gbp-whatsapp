import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { config } from '../config/env.js';
import { parseWebhookPayload } from '../services/whatsapp/webhook.js';
import { validateSignature } from '../middleware/signature-validation.js';
import { lookupClientByPhone } from '../lib/phone.js';
import { createChildLogger } from '../lib/logger.js';
import { db } from '../db/client.js';
import { clients, pendingPosts, pendingReviews, processedWebhooks } from '../db/schema.js';
import { executePhotoPipeline } from '../workflows/photo-pipeline.js';
import {
  handleApprovalResponse,
  handleCustomReply,
} from '../workflows/review-response.js';
import {
  handlePostApproval,
  handlePostEdit,
  handlePostPhoto,
} from '../workflows/gbp-post.js';
import {
  handleOfferApproval,
  handleOfferEdit,
  handleOfferPhoto,
} from '../workflows/offer-post.js';
import {
  sendMainMenu,
  handleMenuSelection,
  handlePendingMenuAction,
} from '../workflows/menu.js';
import type { WhatsAppWebhookPayload, ParsedMessage } from '../services/whatsapp/types.js';
import type { InferSelectModel } from 'drizzle-orm';

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
      const startTime = Date.now();

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

        // Idempotency check - deduplicate by messageId
        const isDuplicate = await db
          .select()
          .from(processedWebhooks)
          .where(eq(processedWebhooks.messageId, message.messageId))
          .limit(1)
          .then((r) => r.length > 0);

        if (isDuplicate) {
          log.info({ messageId: message.messageId }, 'Duplicate webhook ignored (already processed)');
          return;
        }

        // Record this message as processed
        await db.insert(processedWebhooks).values({
          messageId: message.messageId,
        });

        const responseTime = Date.now() - startTime;
        log.info(
          { type: message.type, from: message.from, responseTime },
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
 * Handle text-based approvals as fallback for button webhook failures.
 * Checks for pending posts/offers/reviews and matches "yes", "approve", "post it", etc.
 */
async function handleTextApproval(
  client: InferSelectModel<typeof clients>,
  text: string,
): Promise<boolean> {
  const normalizedText = text.toLowerCase().trim();

  // Match approval keywords
  if (!['yes', 'approve', 'post it', 'post', 'ok', 'send it', 'send'].includes(normalizedText)) {
    return false;
  }

  // Check for pending standard post
  const pendingPost = await db
    .select()
    .from(pendingPosts)
    .where(
      and(
        eq(pendingPosts.clientId, client.id),
        eq(pendingPosts.status, 'pending'),
        eq(pendingPosts.postType, 'standard'),
      ),
    )
    .orderBy(desc(pendingPosts.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (pendingPost) {
    await handlePostApproval(client, `post_approve_${pendingPost.id}`);
    return true;
  }

  // Check for pending offer post
  const pendingOffer = await db
    .select()
    .from(pendingPosts)
    .where(
      and(
        eq(pendingPosts.clientId, client.id),
        eq(pendingPosts.status, 'pending'),
        eq(pendingPosts.postType, 'offer'),
      ),
    )
    .orderBy(desc(pendingPosts.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (pendingOffer) {
    await handleOfferApproval(client, `offer_approve_${pendingOffer.id}`);
    return true;
  }

  // Check for pending review response
  const pendingReview = await db
    .select()
    .from(pendingReviews)
    .where(
      and(
        eq(pendingReviews.clientId, client.id),
        eq(pendingReviews.status, 'pending'),
      ),
    )
    .orderBy(desc(pendingReviews.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (pendingReview) {
    await handleApprovalResponse(client, `approve_${pendingReview.id}`);
    return true;
  }

  return false;
}

/**
 * Central message router.
 * Routes inbound WhatsApp messages to the correct workflow
 * based on message type and conversation state.
 *
 * Priority order:
 * 1. Check for "awaiting edit" states (post edit, offer edit, review custom reply)
 * 2. Check for text-based approvals (fallback for button webhook failures)
 * 3. Check for pending menu actions (user tapped menu, we're waiting for their input)
 * 4. Route by message type (image → photo pipeline, button → approval, list → menu, text → show menu)
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

    // Text-based approval fallback for button webhook failures
    const approvalConsumed = await handleTextApproval(client, message.text);
    if (approvalConsumed) return;

    // Pending menu action (user selected from menu, we asked for input)
    const menuConsumed = await handlePendingMenuAction(client, message.text, message.from);
    if (menuConsumed) return;
  }

  // 3. Route by message type
  switch (message.type) {
    case 'image': {
      // Check if this is a photo for a pending post/offer
      const postPhotoConsumed = await handlePostPhoto(client, message.imageId);
      if (postPhotoConsumed) break;

      const offerPhotoConsumed = await handleOfferPhoto(client, message.imageId);
      if (offerPhotoConsumed) break;

      // Otherwise, run the normal photo pipeline
      await executePhotoPipeline(client, {
        from: message.from,
        imageId: message.imageId,
        caption: message.caption,
        messageId: message.messageId,
      });
      break;
    }

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
