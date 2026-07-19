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
  },
  {
    timestamps: true,
  }
);

installmentSchema.index({ studentId: 1 });
installmentSchema.index({ dueDate: 1, status: 1 });

const Installment = mongoose.model<IInstallment>('Installment', installmentSchema);
export default Installment;
