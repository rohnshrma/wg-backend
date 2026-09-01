import mongoose, { Document, Schema } from 'mongoose';

// Unlike Razorpay, WhatsApp Cloud API deliveries carry a stable message ID
// (`wamid...`) per message, and Meta redelivers the same webhook payload on
// timeout/non-200 responses. Idempotency is enforced by inserting this row
// BEFORE any processing — a unique-index violation on a redelivered message
// lets the handler ack and skip without reprocessing (no duplicate Enquiry,
// no duplicate AI reply, no duplicate demo booking).
export interface IWhatsAppWebhookEvent extends Document {
  waMessageId: string;
  eventType: 'message' | 'status';
  receivedAt: Date;
}

const whatsAppWebhookEventSchema = new Schema<IWhatsAppWebhookEvent>({
  waMessageId: {
    type: String,
    required: true,
    unique: true,
  },
  eventType: {
    type: String,
    enum: ['message', 'status'],
    required: true,
  },
  receivedAt: {
    type: Date,
    default: Date.now,
  },
});

const WhatsAppWebhookEvent = mongoose.model<IWhatsAppWebhookEvent>(
  'WhatsAppWebhookEvent',
  whatsAppWebhookEventSchema
);
export default WhatsAppWebhookEvent;
