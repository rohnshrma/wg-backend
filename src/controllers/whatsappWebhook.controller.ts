import crypto from 'crypto';
import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import env from '../config/env';
import { isWhatsAppAutomationEnabled, hasWhatsAppAppSecret } from '../config/whatsappAutomation';
import WhatsAppWebhookEvent from '../models/WhatsAppWebhookEvent';
import { parseWhatsAppWebhookBody } from '../services/whatsappInboundParser';
import { handleInboundMessage } from '../services/whatsappConversationService';

/**
 * @desc    Meta webhook verification handshake — registering the webhook
 *          URL in the Meta App Dashboard calls this once with a challenge.
 *          Works regardless of WHATSAPP_AUTOMATION_ENABLED: the webhook must
 *          be verifiable before automation is ever turned on (per the
 *          brief's own activation sequence — verify first, enable later).
 * @route   GET /api/webhooks/whatsapp
 * @access  Public (Meta calls this directly)
 */
export const verifyWhatsAppWebhook = (req: Request, res: Response): void => {
  // Meta's verification handshake requires the literal dotted param names
  // `hub.mode` / `hub.verify_token` / `hub.challenge` — this app's global
  // `express-mongo-sanitize()` middleware (app.ts) strips `.` from every
  // req.query key on every route to block NoSQL-injection-style keys, which
  // would otherwise silently break this one handshake. Reading the raw query
  // string directly here sidesteps that without loosening mongoSanitize for
  // any other route.
  const rawQuery = req.originalUrl.split('?')[1] || '';
  const params = new URLSearchParams(rawQuery);
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token !== null &&
    env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    res.status(200).send(challenge ?? '');
    return;
  }

  res.sendStatus(403);
};

const verifySignature = (rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean => {
  if (!hasWhatsAppAppSecret()) return false;
  if (!rawBody || !signatureHeader) return false;

  const expected = crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
};

/**
 * @desc    Inbound WhatsApp events (messages + delivery/read statuses).
 *          Acknowledges Meta immediately after validating + persisting a
 *          dedupe row per message, then processes each message
 *          fire-and-forget — Meta should never wait on AI/DB work (per the
 *          brief's webhook-performance rule), and this codebase has no
 *          queue infrastructure to defer to, so in-process async is the
 *          right-sized approach here.
 * @route   POST /api/webhooks/whatsapp
 * @access  Public (verified via X-Hub-Signature-256, not auth middleware)
 */
export const receiveWhatsAppWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // The flag is the first and final word: disabled means no persistence, no
  // AI, no CRM mutation, no notification — full stop, ack and return.
  if (!isWhatsAppAutomationEnabled()) {
    res.sendStatus(200);
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;

  if (!verifySignature(rawBody, signatureHeader)) {
    res.sendStatus(403);
    return;
  }

  const { messages, statuses } = parseWhatsAppWebhookBody(req.body);

  // Status updates (delivered/read) aren't business events — the brief is
  // explicit it doesn't want a notification or CRM mutation per delivery
  // receipt. Just don't crash on them.
  for (const status of statuses) {
    console.log(`[whatsapp] status update ${status.status} for ${status.waMessageId}`);
  }

  for (const message of messages) {
    try {
      await WhatsAppWebhookEvent.create({ waMessageId: message.waMessageId, eventType: 'message' });
    } catch (error: any) {
      if (error?.code === 11000) continue; // redelivery of a message already handled — skip
      console.error('[whatsapp] failed to persist dedupe row:', error);
      continue;
    }

    // Fire-and-forget: Meta gets its 200 below without waiting on the AI
    // call or any DB writes this triggers. Failures are logged and the
    // Enquiry is flagged for human follow-up inside the handler itself —
    // there is no HTTP response left to report an error to.
    handleInboundMessage(message).catch((error) => {
      console.error(`[whatsapp] processing message ${message.waMessageId} failed:`, error);
    });
  }

  res.sendStatus(200);
});
