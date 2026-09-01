import mongoose, { Document, Schema } from 'mongoose';

export const DEMO_BOOKING_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
export const DEMO_PAYMENT_STATUSES = ['not_required', 'pending', 'paid'] as const;

export type DemoBookingStatus = (typeof DEMO_BOOKING_STATUSES)[number];
export type DemoPaymentStatus = (typeof DEMO_PAYMENT_STATUSES)[number];

/**
 * A demo class booking made through the WhatsApp AI admissions agent.
 * `feeAmount` is captured at booking time (read from DEMO_FEE_AMOUNT, never
 * hardcoded) so a later change to the configured fee doesn't retroactively
 * alter what a customer was actually quoted.
 */
export interface IDemoBooking extends Document {
  enquiryId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  course: string;
  preferredDate: string; // free-form as agreed in chat, e.g. "2026-08-28"
  preferredTime: string; // e.g. "6:00 PM"
  status: DemoBookingStatus;
  feeAmount: number;
  paymentStatus: DemoPaymentStatus;
  createdVia: 'whatsapp_ai';
  createdAt: Date;
  updatedAt: Date;
}

const demoBookingSchema = new Schema<IDemoBooking>(
  {
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: 'Enquiry',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true, maxlength: 120 },
    preferredDate: { type: String, required: true, trim: true },
    preferredTime: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: DEMO_BOOKING_STATUSES,
      default: 'scheduled',
    },
    feeAmount: { type: Number, required: true, min: 0, default: 0 },
    paymentStatus: {
      type: String,
      enum: DEMO_PAYMENT_STATUSES,
      default: 'not_required',
    },
    createdVia: { type: String, enum: ['whatsapp_ai'], default: 'whatsapp_ai' },
  },
  { timestamps: true }
);

demoBookingSchema.index({ enquiryId: 1 });
// Prevents a duplicate active booking for the same enquiry (e.g. a retried
// AI action or a Meta webhook redelivery that slipped past message-level
// dedupe some other way) — only one non-cancelled booking per enquiry.
demoBookingSchema.index(
  { enquiryId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'scheduled' } }
);

const DemoBooking = mongoose.model<IDemoBooking>('DemoBooking', demoBookingSchema);
export default DemoBooking;
