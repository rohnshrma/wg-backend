import mongoose, { Document, Schema } from 'mongoose';

// One row per outbound email / WhatsApp attempt. Written by the low-level
// senders in emailService/whatsappService, so every message — automated or
// admin-triggered — leaves a record of what went to whom and whether it was
// delivered to the provider. Lets an admin show exactly what a student was
// sent, which in-app Notifications alone can't (they don't cover email or
// WhatsApp at all).
export interface IMessageLog extends Document {
  channel: 'email' | 'whatsapp';
  to: string;
  subject?: string;
  preview: string;
  status: 'sent' | 'failed' | 'suppressed';
  error?: string;
  createdAt: Date;
}

const messageLogSchema = new Schema<IMessageLog>(
  {
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    to: { type: String, required: true, lowercase: true, trim: true },
    subject: String,
    preview: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'failed', 'suppressed'], required: true },
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageLogSchema.index({ to: 1, createdAt: -1 });

const MessageLog = mongoose.model<IMessageLog>('MessageLog', messageLogSchema);
export default MessageLog;

/**
 * Best-effort write — a logging failure must never turn a delivered message
 * into a reported failure, so errors are swallowed here.
 */
export const logMessage = async (entry: {
  channel: IMessageLog['channel'];
  to: string;
  subject?: string;
  preview: string;
  status: IMessageLog['status'];
  error?: string;
}): Promise<void> => {
  try {
    await MessageLog.create({ ...entry, preview: entry.preview.slice(0, 1000) });
  } catch (error) {
    console.error('Failed to write message log:', error);
  }
};

// Strip an HTML email body down to readable text for the log preview.
export const htmlToPreview = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8377;|&#x20b9;/gi, '₹')
    .replace(/\s+/g, ' ')
    .trim();
