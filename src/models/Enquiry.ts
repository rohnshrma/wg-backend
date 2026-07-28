import mongoose, { Document, Schema } from 'mongoose';

export const ENQUIRY_STAGES = [
  'new_enquiry',
  'follow_up',
  'demo_scheduled',
  'demo_done',
  'admitted',
  'cancelled',
] as const;

export const ENQUIRY_SOURCES = [
  'justdial',
  'offline_marketing',
  'website',
  'google_maps',
] as const;

export const WORKING_STATUSES = ['student', 'working', 'fresher', 'other'] as const;

export type EnquiryStage = (typeof ENQUIRY_STAGES)[number];
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];
export type WorkingStatus = (typeof WORKING_STATUSES)[number];

export interface IStageHistoryEntry {
  fromStage: EnquiryStage | null;
  toStage: EnquiryStage;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  note?: string;
}

export interface IEnquiry extends Document {
  name: string;
  course: string;
  education?: string;
  workingStatus?: WorkingStatus;
  mobile: string;
  email?: string;
  remarks?: string;
  enquiryDate: Date;
  source: EnquirySource;
  stage: EnquiryStage;
  stageHistory: IStageHistoryEntry[];
  owner: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    course: {
      type: String,
      required: [true, 'Course is required'],
      trim: true,
      maxlength: [120, 'Course cannot exceed 120 characters'],
    },
    education: {
      type: String,
      trim: true,
      maxlength: [120, 'Education cannot exceed 120 characters'],
    },
    workingStatus: {
      type: String,
      enum: WORKING_STATUSES,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [2000, 'Remarks cannot exceed 2000 characters'],
    },
    enquiryDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    source: {
      type: String,
      enum: ENQUIRY_SOURCES,
      required: [true, 'Source is required'],
    },
    stage: {
      type: String,
      enum: ENQUIRY_STAGES,
      default: 'new_enquiry',
      required: true,
    },
    stageHistory: [
      {
        _id: false,
        fromStage: { type: String, enum: [...ENQUIRY_STAGES, null], default: null },
        toStage: { type: String, enum: ENQUIRY_STAGES, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, trim: true, maxlength: 500 },
      },
    ],
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

enquirySchema.index({ stage: 1, updatedAt: -1 });
enquirySchema.index({ owner: 1, stage: 1 });
enquirySchema.index({ mobile: 1 });
enquirySchema.index({ source: 1 });
enquirySchema.index({ enquiryDate: -1 });
enquirySchema.index({ createdAt: -1 });
// Powers the name/mobile/course search box. A text index ranks by relevance,
// but partial-word matching ("rah" → "Rahul") is the common CRM expectation,
// so the controller uses regex and this compound index just keeps the
// non-search filter paths fast.
enquirySchema.index({ name: 1, course: 1 });

const Enquiry = mongoose.model<IEnquiry>('Enquiry', enquirySchema);
export default Enquiry;
