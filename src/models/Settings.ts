import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  siteName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    siteName: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const Settings = mongoose.model<ISettings>('Settings', settingsSchema);
export default Settings;
