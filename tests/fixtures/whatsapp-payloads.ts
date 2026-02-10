import type { WhatsAppWebhookPayload } from '../../src/services/whatsapp/types.js';

export const imageMessagePayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '353861234567',
              phone_number_id: '111222333',
            },
            contacts: [
              {
                profile: { name: 'John Smith' },
                wa_id: '353871234567',
              },
            ],
            messages: [
              {
                from: '353871234567',
                id: 'wamid.HBgLMzUz',
                timestamp: '1707580800',
                type: 'image',
                image: {
                  id: 'media_id_12345',
                  mime_type: 'image/jpeg',
                  sha256: 'abc123',
                  caption: 'New kitchen fitted today in Guildford',
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

export const textMessagePayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '353861234567',
              phone_number_id: '111222333',
            },
            contacts: [
              {
                profile: { name: 'John Smith' },
                wa_id: '353871234567',
              },
            ],
            messages: [
              {
                from: '353871234567',
                id: 'wamid.HBgLMzUz',
                timestamp: '1707580800',
                type: 'text',
                text: {
                  body: 'Hello, how does this work?',
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

export const buttonReplyPayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '353861234567',
              phone_number_id: '111222333',
            },
            contacts: [
              {
                profile: { name: 'John Smith' },
                wa_id: '353871234567',
              },
            ],
            messages: [
              {
                from: '353871234567',
                id: 'wamid.HBgLMzUz',
                timestamp: '1707580800',
                type: 'interactive',
                interactive: {
                  type: 'button_reply',
                  button_reply: {
                    id: 'approve_accounts/123/locations/456/reviews/789',
                    title: 'Post Reply',
                  },
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

export const statusUpdatePayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '353861234567',
              phone_number_id: '111222333',
            },
            statuses: [
              {
                id: 'wamid.HBgLMzUz',
                status: 'delivered',
                timestamp: '1707580800',
                recipient_id: '353871234567',
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

export const emptyPayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [],
};
