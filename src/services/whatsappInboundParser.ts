/**
 * Defensive parsing of Meta's WhatsApp Cloud API webhook payload. Meta sends
 * many event shapes (messages, delivery/read statuses, and others this app
 * doesn't need) through the same POST endpoint — this must never throw on a
 * shape it doesn't recognize; an unrecognized entry is simply skipped.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */

export interface ParsedInboundMessage {
  waMessageId: string;
  fromPhone: string; // raw wa_id as sent by Meta, e.g. "919876543210"
  timestamp: Date;
  messageType: string;
  body: string; // best-effort text extraction; non-text types get a placeholder
  profileName?: string;
}

export interface ParsedStatusUpdate {
  waMessageId: string;
  status: string; // 'sent' | 'delivered' | 'read' | 'failed' | ...
}

export interface ParsedWebhookBatch {
  messages: ParsedInboundMessage[];
  statuses: ParsedStatusUpdate[];
}

const extractText = (message: Record<string, any>): string => {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? '';
    case 'button':
      return message.button?.text ?? '';
    case 'interactive':
      return (
        message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        ''
      );
    case 'image':
      return message.image?.caption ?? '[image]';
    case 'video':
      return message.video?.caption ?? '[video]';
    case 'audio':
      return '[voice note]';
    case 'document':
      return message.document?.caption ?? '[document]';
    case 'sticker':
      return '[sticker]';
    case 'location':
      return '[shared location]';
    case 'contacts':
      return '[shared contact]';
    default:
      return '[unsupported message type]';
  }
};

/**
 * Walks the full entry[].changes[].value tree and pulls out every message
 * and status update it can find. Wraps each entry/change in its own
 * try/catch so one malformed item can't drop the rest of the batch.
 */
export const parseWhatsAppWebhookBody = (body: unknown): ParsedWebhookBatch => {
  const messages: ParsedInboundMessage[] = [];
  const statuses: ParsedStatusUpdate[] = [];

  const entries = (body as Record<string, any>)?.entry;
  if (!Array.isArray(entries)) return { messages, statuses };

  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      try {
        const value = change?.value;
        if (!value) continue;

        const contactsByWaId = new Map<string, string>();
        if (Array.isArray(value.contacts)) {
          for (const contact of value.contacts) {
            if (contact?.wa_id) contactsByWaId.set(contact.wa_id, contact.profile?.name);
          }
        }

        if (Array.isArray(value.messages)) {
          for (const message of value.messages) {
            if (!message?.id || !message?.from) continue; // malformed — skip, don't crash
            messages.push({
              waMessageId: message.id,
              fromPhone: message.from,
              timestamp: message.timestamp
                ? new Date(Number(message.timestamp) * 1000)
                : new Date(),
              messageType: message.type || 'unsupported',
              body: extractText(message),
              profileName: contactsByWaId.get(message.from),
            });
          }
        }

        if (Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            if (!status?.id || !status?.status) continue;
            statuses.push({ waMessageId: status.id, status: status.status });
          }
        }
      } catch (error) {
        console.error('[whatsapp] failed to parse a webhook change entry:', error);
      }
    }
  }

  return { messages, statuses };
};
