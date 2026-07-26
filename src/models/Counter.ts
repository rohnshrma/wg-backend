import mongoose, { Schema } from 'mongoose';

export interface ICounter {
  _id: string;
  prefix: string;
  year: number;
  sequence: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  prefix: { type: String, required: true, default: 'WEBI' },
  year: { type: Number, required: true },
  sequence: { type: Number, required: true, default: 0 },
});

const getNextSequence = async (
  model: mongoose.Model<ICounter>,
  key: string,
  prefix: string
): Promise<string> => {
  const currentYear = new Date().getFullYear();
  // The _id is scoped to the year so a year rollover starts a fresh
  // document instead of colliding with (and failing to match) last
  // year's counter under the same fixed _id.
  const counter = await model.findOneAndUpdate(
    { _id: `${key}-${currentYear}` },
    { $inc: { sequence: 1 }, $setOnInsert: { prefix, year: currentYear } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const paddedSeq = String(counter.sequence).padStart(3, '0');
  return `${counter.prefix}${counter.year}${paddedSeq}`;
};

/**
 * Get next admission ID atomically
 * Returns format: WEBI2026001, WEBI2026002, etc.
 */
counterSchema.statics.getNextAdmissionId = function (): Promise<string> {
  return getNextSequence(this, 'admissionId', 'WEBI');
};

/**
 * Get next receipt number atomically
 * Returns format: RCPT2026001, RCPT2026002, etc.
 */
counterSchema.statics.getNextReceiptNumber = function (): Promise<string> {
  return getNextSequence(this, 'receiptNumber', 'RCPT');
};

const Counter = mongoose.model<ICounter>('Counter', counterSchema);
export default Counter;
