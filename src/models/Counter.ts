import mongoose, { Document, Schema } from 'mongoose';

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

/**
 * Get next admission ID atomically
 * Returns format: WEBI2026001, WEBI2026002, etc.
 */
counterSchema.statics.getNextAdmissionId = async function (): Promise<string> {
  const currentYear = new Date().getFullYear();

  const counter = await this.findOneAndUpdate(
    { _id: 'admissionId', year: currentYear },
    { $inc: { sequence: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const paddedSeq = String(counter.sequence).padStart(3, '0');
  return `${counter.prefix}${counter.year}${paddedSeq}`;
};

const Counter = mongoose.model<ICounter>('Counter', counterSchema);
export default Counter;
