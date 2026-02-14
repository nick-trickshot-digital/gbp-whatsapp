import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/env.js';
import type { WhatsAppWebhookPayload, ParsedMessage } from './types.js';

/**
 * Verify the X-Hub-Signature-256 header from Meta.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
): boolean {
  const expectedSignature = createHmac('sha256', config.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const expected = `sha256=${expectedSignature}`;

  if (expected.length !== signatureHeader.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader),
  );
}

/**
 * Parse a WhatsApp webhook payload into a simplified message object.
 * Returns null if the payload doesn't contain a processable message.
 */
export function parseWebhookPayload(
  body: WhatsAppWebhookPayload,
): ParsedMessage | null {
  const entry = body.entry?.[0];
  if (!entry) return null;

  const change = entry.changes?.[0];
  if (!change || change.field !== 'messages') return null;

  const message = change.value.messages?.[0];
  if (!message) return null;

  switch (message.type) {
    case 'text':
      if (!message.text?.body) return null;
      return {
        type: 'text',
        from: message.from,
        text: message.text.body,
        messageId: message.id,
      };

    case 'image':
      if (!message.image?.id) return null;
      return {
        type: 'image',
        from: message.from,
        imageId: message.image.id,
        caption: message.image.caption,
        messageId: message.id,
      };

    case 'interactive':
      if (message.interactive?.type === 'button_reply' && message.interactive.button_reply) {
        return {
          type: 'button_reply',
          from: message.from,
          buttonId: message.interactive.button_reply.id,
          buttonTitle: message.interactive.button_reply.title,
          messageId: message.id,
        };
      }
      if (message.interactive?.type === 'list_reply' && message.interactive.list_reply) {
        return {
          type: 'list_reply',
          from: message.from,
          listId: message.interactive.list_reply.id,
          listTitle: message.interactive.list_reply.title,
          messageId: message.id,
        };
      }
      return null;

    default:
      return null;
  }
}
