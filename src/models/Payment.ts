import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  studentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  amount: number;
  paymentMode: 'full' | 'emi';
  paymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';
  transactionId?: string;
  receiptUrl?: string;
  notes?: string;
  recordedBy: mongoose.Types.ObjectId;
  paymentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required'],
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course ID is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1'],
    },
    paymentMode: {
      type: String,
      enum: ['full', 'emi'],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'card', 'other'],
      required: [true, 'Payment method is required'],
    },
    transactionId: String,
    receiptUrl: String,
    notes: String,
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ studentId: 1 });
paymentSchema.index({ paymentDate: -1 });

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment;
