import mongoose, { Document, Schema } from 'mongoose';

// Razorpay webhook deliveries carry no stable top-level event ID and are
// retried verbatim on delivery failure, so idempotency is enforced by
// hashing the raw request body — a unique-index violation on the second
// delivery of the same payload lets the handler short-circuit without
// reprocessing (e.g. double-crediting a payment or double-sending email).
export interface IRazorpayWebhookEvent extends Document {
  bodyHash: string;
  event: string;
  receivedAt: Date;
}

const razorpayWebhookEventSchema = new Schema<IRazorpayWebhookEvent>({
  bodyHash: {
    type: String,
    required: true,
    unique: true,
  },
  event: {
    type: String,
    required: true,
  },
  receivedAt: {
    type: Date,
    default: Date.now,
  },
});

const RazorpayWebhookEvent = mongoose.model<IRazorpayWebhookEvent>(
  'RazorpayWebhookEvent',
  razorpayWebhookEventSchema
);
export default RazorpayWebhookEvent;
