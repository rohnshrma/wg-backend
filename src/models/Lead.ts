import mongoose, { Document, Schema } from 'mongoose';

export interface ILeadNote {
  text: string;
  addedBy: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface ILead extends Document {
  name: string;
  phone: string;
  email: string;
  // Institute-era field — kept for old leads and any course-based inquiry
  // flow. Agency inquiries use projectType/budget/timeline instead; a lead
  // must have at least one of courseInterested or projectType (enforced in
  // the controller, not here, since "at least one of two fields" isn't a
  // single-field schema constraint).
  courseInterested?: string;
  projectType?: string;
  budget?: string;
  timeline?: string;
  company?: string;
  website?: string;
  message?: string;

  source:
    | 'hero_form'
    | 'popup'
    | 'exit_intent'
    | 'contact_page'
    | 'course_page'
    | 'book_demo'
    | 'sticky_cta'
    // Agency site sources (webigeeksdigital.com) — additive, alongside the
    // institute-site sources above.
    | 'website_hero'
    | 'services_page'
    | 'work_page'
    | 'contact_form'
    | 'social'
    | 'referral'
    | 'other';
  status: 'new' | 'contacted' | 'interested' | 'converted' | 'cold' | 'lost';

  notes: ILeadNote[];
  nextFollowUp?: Date;
  assignedTo?: mongoose.Types.ObjectId;

  convertedToStudent?: mongoose.Types.ObjectId;
  convertedAt?: Date;

  adminEmailSent: boolean;
  adminWhatsAppSent: boolean;
  studentConfirmationSent: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    courseInterested: {
      type: String,
      trim: true,
    },
    projectType: {
      type: String,
      trim: true,
    },
    budget: {
      type: String,
      trim: true,
    },
    timeline: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: [
        'hero_form',
        'popup',
        'exit_intent',
        'contact_page',
        'course_page',
        'book_demo',
        'sticky_cta',
        'website_hero',
        'services_page',
        'work_page',
        'contact_form',
        'social',
        'referral',
        'other',
      ],
      default: 'hero_form',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'interested', 'converted', 'cold', 'lost'],
      default: 'new',
    },
    notes: [
      {
        text: { type: String, required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    nextFollowUp: Date,
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    convertedToStudent: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
    },
    convertedAt: Date,

    adminEmailSent: { type: Boolean, default: false },
    adminWhatsAppSent: { type: Boolean, default: false },
    studentConfirmationSent: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
leadSchema.index({ status: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ source: 1 });
leadSchema.index({ nextFollowUp: 1 });

const Lead = mongoose.model<ILead>('Lead', leadSchema);
export default Lead;
