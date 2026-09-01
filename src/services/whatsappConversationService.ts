import mongoose from 'mongoose';
import Enquiry, { IEnquiry } from '../models/Enquiry';
import User from '../models/User';
import WhatsAppMessage, { IWhatsAppMessage } from '../models/WhatsAppMessage';
import env from '../config/env';
import { normalizeIndianMobile } from '../utils/phone';
import { ParsedInboundMessage } from './whatsappInboundParser';
import { getNextAdmissionsAction } from './aiAdmissionsService';
import { sendWhatsAppText } from './whatsappService';
import { createDemoBooking } from './demoBookingService';
import { NotificationService } from './notificationService';

const CONTEXT_WINDOW_SIZE = 20;

// Purely cosmetic — see WHATSAPP_BUSINESS_NUMBER's comment in config/env.ts.
const businessDisplayNumber = (): string => env.WHATSAPP_BUSINESS_NUMBER || env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * The account auto-created WhatsApp enquiries are owned by, and the actor
 * recorded on stage-history entries the automation makes. Resolved from
 * ADMIN_EMAIL (already required config, already the account every other
 * "admin" notification/reporting path in this codebase points at) — no new
 * env var needed. Cached in-process; the admin account doesn't change often
 * enough to justify a DB hit per message.
 */
let cachedOwnerId: mongoose.Types.ObjectId | null = null;
const resolveAutomationOwnerId = async (): Promise<mongoose.Types.ObjectId | null> => {
  if (cachedOwnerId) return cachedOwnerId;
  const admin = await User.findOne({ email: env.ADMIN_EMAIL }).select('_id');
  if (!admin) return null;
  cachedOwnerId = admin._id as mongoose.Types.ObjectId;
  return cachedOwnerId;
};

/**
 * Both JustDial and Google Ads leads currently land on this same WhatsApp
 * number with no distinguishing signal in the message itself (confirmed
 * 2026-08-24) — so this is deliberately the ONE place that decides
 * Enquiry.source for an inbound WhatsApp message. If a distinguishing signal
 * is added later (e.g. per-channel pre-filled wa.me text, or Meta's
 * `referral` object for click-to-WhatsApp ads), it only needs to change here.
 */
const detectEnquirySource = (_message: ParsedInboundMessage): 'whatsapp' => 'whatsapp';

/**
 * Finds an existing active enquiry for this phone number, or creates one —
 * mirrors the exact duplicate-check `createEnquiry` uses in
 * enquiry.controller.ts (`stage not in [admitted, cancelled]`) so a WhatsApp
 * lead can't silently create a second, competing enquiry for a customer who
 * already has one open through another channel.
 */
const findOrCreateEnquiry = async (
  mobile: string,
  profileName: string | undefined,
  message: ParsedInboundMessage
): Promise<IEnquiry | null> => {
  const existing = await Enquiry.findOne({
    mobile,
    stage: { $nin: ['admitted', 'cancelled'] },
  });
  if (existing) return existing;

  const ownerId = await resolveAutomationOwnerId();
  if (!ownerId) {
    console.error('[whatsapp-ai] cannot create Enquiry: no User found for ADMIN_EMAIL');
    return null;
  }

  return Enquiry.create({
    name: profileName || 'WhatsApp Enquiry',
    course: 'Not yet specified',
    mobile,
    source: detectEnquirySource(message),
    stage: 'new_enquiry',
    owner: ownerId,
    createdBy: ownerId,
    enquiryDate: new Date(),
    stageHistory: [
      {
        fromStage: null,
        toStage: 'new_enquiry',
        changedBy: ownerId,
        changedAt: new Date(),
        note: 'Created by WhatsApp AI admissions automation',
      },
    ],
  });
};

const logMessage = async (params: {
  enquiryId: mongoose.Types.ObjectId;
  waMessageId?: string;
  direction: 'inbound' | 'outbound';
  fromPhone: string;
  toPhone: string;
  messageType?: string;
  body: string;
  timestamp?: Date;
  actor: 'customer' | 'ai' | 'system';
  intent?: string;
  confidence?: number;
}): Promise<void> => {
  try {
    await WhatsAppMessage.create({
      enquiryId: params.enquiryId,
      waMessageId: params.waMessageId,
      direction: params.direction,
      fromPhone: params.fromPhone,
      toPhone: params.toPhone,
      messageType: params.messageType || 'text',
      body: params.body,
      timestamp: params.timestamp || new Date(),
      actor: params.actor,
      processingStatus: 'processed',
      intent: params.intent,
      confidence: params.confidence,
    });
  } catch (error: any) {
    // A duplicate waMessageId here means this exact inbound message was
    // already logged by a redelivered webhook that slipped past the
    // WhatsAppWebhookEvent dedupe some other way — safe to ignore.
    if (error?.code !== 11000) console.error('[whatsapp-ai] failed to log message:', error);
  }
};

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const LOW_CONFIDENCE_STREAK_TO_ESCALATE = 2;

/**
 * Catches the case a single-message confidence floor can't: no one AI turn
 * was ever confident enough to be individually escalated (the hard floor in
 * aiAdmissionsService is 0.4), but the conversation has clearly been
 * drifting — several turns in a row where the model wasn't really sure. On
 * its own that's the "repeated misunderstanding" escalation trigger the
 * brief calls for; without it, a wishy-washy-but-technically-above-the-floor
 * AI could keep guessing indefinitely instead of handing off.
 */
const hasRepeatedLowConfidence = (history: IWhatsAppMessage[], currentConfidence: number): boolean => {
  const recentAiConfidences = history
    .filter((m) => m.actor === 'ai' && typeof m.confidence === 'number')
    .slice(-LOW_CONFIDENCE_STREAK_TO_ESCALATE)
    .map((m) => m.confidence as number);

  if (recentAiConfidences.length < LOW_CONFIDENCE_STREAK_TO_ESCALATE) return false;

  return [...recentAiConfidences, currentConfidence].every((c) => c < LOW_CONFIDENCE_THRESHOLD);
};

const escalate = async (enquiry: IEnquiry, reason: string): Promise<void> => {
  enquiry.requiresHumanFollowUp = true;
  enquiry.humanFollowUpReason = reason;
  enquiry.humanFollowUpAt = new Date();
  await enquiry.save();

  NotificationService.whatsappEscalation({
    name: enquiry.name,
    phone: enquiry.mobile,
    reason,
    enquiryRef: String(enquiry._id),
  }).catch((error) => console.error('[whatsapp-ai] escalation notification failed:', error));
};

/**
 * The full pipeline for one inbound WhatsApp message: normalize -> link to
 * an Enquiry -> log -> ask the AI -> validate its structured output
 * server-side -> execute exactly one of a small set of allowed actions.
 * Called fire-and-forget from the webhook controller AFTER it has already
 * acknowledged Meta (see whatsappWebhook.controller.ts) — errors here are
 * logged and escalated, never thrown back to an HTTP response nobody is
 * waiting on anymore.
 */
export const handleInboundMessage = async (message: ParsedInboundMessage): Promise<void> => {
  const mobile = normalizeIndianMobile(message.fromPhone);
  if (!mobile) {
    console.error(`[whatsapp-ai] unparseable phone number, cannot link to CRM: ${message.fromPhone}`);
    return;
  }

  const enquiry = await findOrCreateEnquiry(mobile, message.profileName, message);
  if (!enquiry) return; // already logged inside findOrCreateEnquiry

  await logMessage({
    enquiryId: enquiry._id as mongoose.Types.ObjectId,
    waMessageId: message.waMessageId,
    direction: 'inbound',
    fromPhone: message.fromPhone,
    toPhone: businessDisplayNumber(),
    messageType: message.messageType,
    body: message.body,
    timestamp: message.timestamp,
    actor: 'customer',
  });

  // Once a conversation has been flagged for human follow-up, the AI stops
  // talking on it entirely — no more auto-replies layered on top of what a
  // counsellor is now expected to handle. The message is still logged above
  // so a human sees the full thread; a counsellor clears
  // `requiresHumanFollowUp` (via the existing enquiry edit endpoint) once
  // they've actually taken over, which lets the AI resume on this Enquiry.
  if (enquiry.requiresHumanFollowUp) return;

  if (message.messageType !== 'text' && message.messageType !== 'button' && message.messageType !== 'interactive') {
    // Non-text content (image/audio/document/sticker/location/...) is logged
    // for the conversation thread but not handed to the AI — nothing in the
    // brief asks the AI to interpret media, and guessing at it risks acting
    // on a misread. A short, honest reply beats silence.
    await sendWhatsAppText(
      message.fromPhone,
      "Thanks for sending that! For now, please describe what you're looking for in text and I'll help right away."
    ).catch((error) => console.error('[whatsapp-ai] send failed:', error));
    return;
  }

  const history: IWhatsAppMessage[] = await WhatsAppMessage.find({ enquiryId: enquiry._id })
    .sort({ timestamp: -1 })
    .limit(CONTEXT_WINDOW_SIZE)
    .then((rows) => rows.reverse());

  const result = await getNextAdmissionsAction(message.body, history);

  // A run of borderline-confident turns is treated as a stuck conversation
  // even though no single turn tripped the hard per-message floor.
  if (result.action !== 'escalate' && hasRepeatedLowConfidence(history, result.confidence)) {
    result.action = 'escalate';
    result.escalationReason = 'Repeated low-confidence responses across the conversation';
  }

  // Keep qualification data the AI extracted, but only overwrite the
  // enquiry's course once we actually know it — never blank out a
  // previously-known value because this particular message didn't restate it.
  if (result.course && enquiry.course !== result.course) {
    enquiry.course = result.course;
    await enquiry.save();
  }

  switch (result.action) {
    case 'escalate': {
      await escalate(enquiry, result.escalationReason || 'AI escalation (unspecified reason)');
      await sendWhatsAppText(message.fromPhone, result.replyMessage).catch((error) =>
        console.error('[whatsapp-ai] send failed:', error)
      );
      break;
    }

    case 'book_demo': {
      if (!result.demoBooking?.preferredDate || !result.demoBooking?.preferredTime) {
        await escalate(enquiry, 'AI attempted to book a demo without a date/time');
        await sendWhatsAppText(
          message.fromPhone,
          "Let's lock in a date and time for your demo — which day and time works best for you?"
        ).catch((error) => console.error('[whatsapp-ai] send failed:', error));
        break;
      }

      const ownerId = await resolveAutomationOwnerId();
      const bookingResult = ownerId
        ? await createDemoBooking({
            enquiryId: enquiry._id as mongoose.Types.ObjectId,
            name: enquiry.name,
            phone: mobile,
            course: enquiry.course,
            preferredDate: result.demoBooking.preferredDate,
            preferredTime: result.demoBooking.preferredTime,
            changedBy: ownerId,
          })
        : ({ ok: false, reason: 'error' } as const);

      // The confirmation text is composed here from verified DB state, never
      // from the AI's own claim — per the brief, the customer is never told
      // "your demo is booked" until the backend has actually booked it.
      let confirmationText: string;
      if (bookingResult.ok) {
        confirmationText = `You're all set! Your demo for *${enquiry.course}* is confirmed for ${result.demoBooking.preferredDate} at ${result.demoBooking.preferredTime}. Our counsellor will reach out if anything needs to change. See you then! 🎓`;
      } else if (bookingResult.reason === 'duplicate') {
        confirmationText = "You already have a demo scheduled — our counsellor will confirm the details with you shortly.";
      } else {
        confirmationText = "I'm having a little trouble confirming that slot right now — our counsellor will follow up shortly to lock it in.";
        await escalate(enquiry, 'Demo booking failed after AI attempted to book');
      }

      await sendWhatsAppText(message.fromPhone, confirmationText).catch((error) =>
        console.error('[whatsapp-ai] send failed:', error)
      );
      await logMessage({
        enquiryId: enquiry._id as mongoose.Types.ObjectId,
        direction: 'outbound',
        fromPhone: businessDisplayNumber(),
        toPhone: message.fromPhone,
        body: confirmationText,
        actor: 'system',
      });
      return; // confirmation already logged above; skip the generic log below
    }

    case 'reply':
    case 'ask_demo_preference':
    default: {
      await sendWhatsAppText(message.fromPhone, result.replyMessage).catch((error) =>
        console.error('[whatsapp-ai] send failed:', error)
      );
      break;
    }
  }

  await logMessage({
    enquiryId: enquiry._id as mongoose.Types.ObjectId,
    direction: 'outbound',
    fromPhone: businessDisplayNumber(),
    toPhone: message.fromPhone,
    body: result.replyMessage,
    actor: 'ai',
    intent: result.intent,
    confidence: result.confidence,
  });
};
