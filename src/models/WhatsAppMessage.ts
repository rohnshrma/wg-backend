import mongoose, { Document, Schema } from 'mongoose';

export const WHATSAPP_MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export const WHATSAPP_MESSAGE_ACTORS = ['customer', 'ai', 'system', 'counsellor'] as const;
export const WHATSAPP_MESSAGE_PROCESSING_STATUSES = [
  'received',
  'processed',
  'failed',
  'skipped',
] as const;

export type WhatsAppMessageDirection = (typeof WHATSAPP_MESSAGE_DIRECTIONS)[number];
export type WhatsAppMessageActor = (typeof WHATSAPP_MESSAGE_ACTORS)[number];
export type WhatsAppMessageProcessingStatus = (typeof WHATSAPP_MESSAGE_PROCESSING_STATUSES)[number];

/**
 * The full conversation log for the WhatsApp AI admissions automation —
 * every inbound customer message and every outbound AI/system reply,
 * attached to the Enquiry it belongs to. This is the audit trail the AIM
 * brief requires ("every WhatsApp interaction must be attached to the
 * relevant Enquiry") and the bounded context window the AI reads from.
 */
export interface IWhatsAppMessage extends Document {
  enquiryId: mongoose.Types.ObjectId;
  waMessageId?: string; // absent for outbound messages sent before Meta's send-API returns an id
  direction: WhatsAppMessageDirection;
  fromPhone: string;
  toPhone: string;
  messageType: string; // 'text' | 'image' | 'audio' | 'document' | 'sticker' | 'location' | 'unsupported' | ...
  body: string;
  timestamp: Date;
  actor: WhatsAppMessageActor;
  processingStatus: WhatsAppMessageProcessingStatus;
  intent?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppMessageSchema = new Schema<IWhatsAppMessage>(
  {
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: 'Enquiry',
      required: true,
    },
    waMessageId: {
      type: String,
      // sparse+unique: many outbound rows may have no id yet, but any two
      // rows that DO have one must be genuinely distinct messages.
      unique: true,
      sparse: true,
    },
    direction: {
      type: String,
      enum: WHATSAPP_MESSAGE_DIRECTIONS,
      required: true,
    },
    fromPhone: { type: String, required: true, trim: true },
    toPhone: { type: String, required: true, trim: true },
    messageType: { type: String, required: true, default: 'text' },
    body: { type: String, required: true, trim: true, maxlength: 4096 },
    timestamp: { type: Date, required: true, default: Date.now },
    actor: {
      type: String,
      enum: WHATSAPP_MESSAGE_ACTORS,
      required: true,
    },
    processingStatus: {
      type: String,
      enum: WHATSAPP_MESSAGE_PROCESSING_STATUSES,
      default: 'received',
    },
    intent: { type: String, trim: true, maxlength: 100 },
    confidence: { type: Number, min: 0, max: 1 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Powers "fetch this enquiry's conversation, chronologically" — the AI's
// bounded context window and the CRM's conversation-thread view both use it.
whatsAppMessageSchema.index({ enquiryId: 1, timestamp: 1 });

const WhatsAppMessage = mongoose.model<IWhatsAppMessage>('WhatsAppMessage', whatsAppMessageSchema);
export default WhatsAppMessage;
