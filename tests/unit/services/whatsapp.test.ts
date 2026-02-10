import { describe, it, expect, vi } from 'vitest';

// Mock the config module
vi.mock('../../../src/config/env.js', () => ({
  config: {
    WHATSAPP_APP_SECRET: 'test-app-secret',
  },
}));

import { parseWebhookPayload, verifyWebhookSignature } from '../../../src/services/whatsapp/webhook.js';
import {
  imageMessagePayload,
  textMessagePayload,
  buttonReplyPayload,
  statusUpdatePayload,
  emptyPayload,
} from '../../fixtures/whatsapp-payloads.js';
import { createHmac } from 'node:crypto';

describe('parseWebhookPayload', () => {
  it('should parse an image message', () => {
    const result = parseWebhookPayload(imageMessagePayload);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('image');
    if (result!.type === 'image') {
      expect(result!.from).toBe('353871234567');
      expect(result!.imageId).toBe('media_id_12345');
      expect(result!.caption).toBe('New kitchen fitted today in Guildford');
      expect(result!.messageId).toBe('wamid.HBgLMzUz');
    }
  });

  it('should parse a text message', () => {
    const result = parseWebhookPayload(textMessagePayload);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('text');
    if (result!.type === 'text') {
      expect(result!.from).toBe('353871234567');
      expect(result!.text).toBe('Hello, how does this work?');
    }
  });

  it('should parse a button reply', () => {
    const result = parseWebhookPayload(buttonReplyPayload);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('button_reply');
    if (result!.type === 'button_reply') {
      expect(result!.from).toBe('353871234567');
      expect(result!.buttonId).toBe('approve_accounts/123/locations/456/reviews/789');
      expect(result!.buttonTitle).toBe('Post Reply');
    }
  });

  it('should return null for status update payloads (no messages)', () => {
    const result = parseWebhookPayload(statusUpdatePayload);
    expect(result).toBeNull();
  });

  it('should return null for empty payloads', () => {
    const result = parseWebhookPayload(emptyPayload);
    expect(result).toBeNull();
  });
});

describe('verifyWebhookSignature', () => {
  const appSecret = 'test-app-secret';

  it('should verify a valid signature', () => {
    const body = Buffer.from('{"test":"payload"}');
    const expectedHash = createHmac('sha256', appSecret)
      .update(body)
      .digest('hex');
    const signature = `sha256=${expectedHash}`;

    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('should reject an invalid signature', () => {
    const body = Buffer.from('{"test":"payload"}');
    const signature = 'sha256=invalid-hash-value-that-is-definitely-wrong-0000';

    expect(verifyWebhookSignature(body, signature)).toBe(false);
  });

  it('should reject a signature with wrong prefix', () => {
    const body = Buffer.from('{"test":"payload"}');
    const signature = 'md5=some-hash';

    expect(verifyWebhookSignature(body, signature)).toBe(false);
  });
});
