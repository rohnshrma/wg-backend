import mongoose, { Document, Schema } from 'mongoose';

// Audit trail for payments an admin deleted (e.g. recorded by mistake). The
// live Payment row is removed so every total, listing and export stays
// correct without filtering; the full original document is kept here along
// with why, by whom and when, and which installments were reopened.
export interface IDeletedPayment extends Document {
  originalPaymentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  receiptNumber: string;
  amount: number;
  snapshot: Record<string, unknown>;
  reason: string;
  deletedBy: mongoose.Types.ObjectId;
  reopenedInstallmentIds: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const deletedPaymentSchema = new Schema<IDeletedPayment>(
  {
    originalPaymentId: { type: Schema.Types.ObjectId, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    receiptNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    reason: { type: String, required: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reopenedInstallmentIds: [{ type: Schema.Types.ObjectId, ref: 'Installment' }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const DeletedPayment = mongoose.model<IDeletedPayment>('DeletedPayment', deletedPaymentSchema);
export default DeletedPayment;
