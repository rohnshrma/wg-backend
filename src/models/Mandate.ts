import mongoose, { Document, Schema } from 'mongoose';

export type MandateStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'failed';

export interface IMandate extends Document {
  studentId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  razorpayPlanId: string;
  razorpaySubscriptionId: string;
  status: MandateStatus;
  amount: number;
  totalCount: number;
  period: 'daily' | 'weekly' | 'monthly';
  interval: number;
  shortUrl?: string;
  consent: {
    acceptedAt: Date;
    ip: string;
  };
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const mandateSchema = new Schema<IMandate>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
    razorpayPlanId: {
      type: String,
      required: true,
    },
    razorpaySubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['created', 'authenticated', 'active', 'paused', 'cancelled', 'failed'],
      default: 'created',
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    totalCount: {
      type: Number,
      required: true,
      min: 1,
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'monthly',
    },
    interval: {
      type: Number,
      default: 1,
      min: 1,
    },
    shortUrl: String,
    // RBI requires explicit, logged consent for recurring auto-debit — not
    // just intent to pay in installments. Captured once at mandate creation
    // from the admission form's consent checkbox.
    consent: {
      acceptedAt: { type: Date, required: true },
      ip: { type: String, required: true },
    },
    failureReason: String,
  },
  {
    timestamps: true,
  }
);

mandateSchema.index({ studentId: 1 });
mandateSchema.index({ status: 1 });

const Mandate = mongoose.model<IMandate>('Mandate', mandateSchema);
export default Mandate;
