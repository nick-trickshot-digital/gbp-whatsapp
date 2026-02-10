import { config } from '../../config/env.js';
import { WHATSAPP_API_BASE } from '../../config/constants.js';
import { retry } from '../../lib/retry.js';
import { createChildLogger } from '../../lib/logger.js';
import type { Button, SendMessageResponse, MediaUrlResponse } from './types.js';

const log = createChildLogger('whatsapp');

export class WhatsAppService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${WHATSAPP_API_BASE}/${config.WHATSAPP_PHONE_NUMBER_ID}`;
  }

  async sendTextMessage(to: string, text: string): Promise<string> {
    const response = await this.apiCall<SendMessageResponse>('POST', '/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    });
    return response.messages[0].id;
  }

  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Button[],
  ): Promise<string> {
    const response = await this.apiCall<SendMessageResponse>('POST', '/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    });
    return response.messages[0].id;
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    params: string[],
  ): Promise<string> {
    const response = await this.apiCall<SendMessageResponse>('POST', '/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: params.length > 0
          ? [
              {
                type: 'body',
                parameters: params.map((p) => ({ type: 'text', text: p })),
              },
            ]
          : undefined,
      },
    });
    return response.messages[0].id;
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await this.apiCall<MediaUrlResponse>(
      'GET',
      '', // Media endpoint uses a different base
      undefined,
      `${WHATSAPP_API_BASE}/${mediaId}`,
    );
    return response.url;
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    const url = await this.getMediaUrl(mediaId);

    log.debug({ mediaId, url }, 'Downloading media');

    const response = await retry(async () => {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        },
      });
      if (!res.ok) {
        throw new WhatsAppApiError(res.status, await res.text());
      }
      return res;
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async apiCall<T>(
    method: string,
    path: string,
    body?: unknown,
    overrideUrl?: string,
  ): Promise<T> {
    const url = overrideUrl || `${this.baseUrl}${path}`;

    return retry(
      async () => {
        log.debug({ method, url }, 'WhatsApp API call');

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          log.error({ status: response.status, error }, 'WhatsApp API error');
          throw new WhatsAppApiError(response.status, error);
        }

        return (await response.json()) as T;
      },
      { maxAttempts: 3, baseDelay: 1000 },
    );
  }
}

export class WhatsAppApiError extends Error {
  constructor(
    public statusCode: number,
    public apiError: unknown,
  ) {
    super(`WhatsApp API error ${statusCode}`);
    this.name = 'WhatsAppApiError';
  }
}
