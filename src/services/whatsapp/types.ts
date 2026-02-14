export interface WhatsAppWebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: WebhookMessage[];
  statuses?: Array<{
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
  }>;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  interactive?: {
    type: string;
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
}

export type ParsedMessage =
  | {
      type: 'text';
      from: string;
      text: string;
      messageId: string;
    }
  | {
      type: 'image';
      from: string;
      imageId: string;
      caption: string | undefined;
      messageId: string;
    }
  | {
      type: 'button_reply';
      from: string;
      buttonId: string;
      buttonTitle: string;
      messageId: string;
    }
  | {
      type: 'list_reply';
      from: string;
      listId: string;
      listTitle: string;
      messageId: string;
    };

export interface Button {
  id: string;
  title: string;
}

export interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface MediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
  messaging_product: string;
}
