import mongoose, { Document, Schema } from 'mongoose';

export interface IInstallment extends Document {
  studentId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  installmentNumber: number;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: Date;
  reminderSent: boolean;
  reminderSentAt?: Date;
  // UPI AutoPay e-mandate fields. `status`/`paidDate` stay the single
  // source of truth for "is this settled" (existing code — payment
  // application, admin UI, the reminders job — already keys off them);
  // these fields only add how/whether an auto-debit was involved, so a
  // failed autopay attempt doesn't invent a 4th `status` value that every
  // consumer above would need to learn about.
  mandateId?: mongoose.Types.ObjectId;
  collectionMethod: 'manual' | 'autopay';
  razorpayPaymentId?: string;
  receiptUrl?: string;
  autoDebitFailedAt?: Date;
  autoDebitFailureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const installmentSchema = new Schema<IInstallment>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },
    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending',
    },
    paidDate: Date,
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentAt: Date,
    mandateId: {
      type: Schema.Types.ObjectId,
      ref: 'Mandate',
    },
    collectionMethod: {
      type: String,
      enum: ['manual', 'autopay'],
      default: 'manual',
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    receiptUrl: String,
    autoDebitFailedAt: Date,
    autoDebitFailureReason: String,
  },
  {
    timestamps: true,
  }
);

installmentSchema.index({ studentId: 1 });
installmentSchema.index({ dueDate: 1, status: 1 });
installmentSchema.index({ mandateId: 1 });

const Installment = mongoose.model<IInstallment>('Installment', installmentSchema);
export default Installment;
