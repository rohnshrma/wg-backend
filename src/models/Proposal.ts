import mongoose, { Document, Schema } from 'mongoose';

export interface IProposalScope {
  title: string;
  description: string;
  included: boolean;
}

export interface IProposal extends Document {
  proposalNumber: string;
  lead: mongoose.Types.ObjectId;
  project?: mongoose.Types.ObjectId;

  title: string;
  description: string;
  clientName: string;
  clientEmail: string;

  serviceType: 'web-development' | 'product-engineering' | 'ai-automation' | 'design' | 'hybrid';

  scope: IProposalScope[];
  timeline: string;
  deliverables: string[];
  technologies: string[];

  pricing: {
    subtotal: number;
    tax: number;
    total: number;
    currency: 'USD' | 'INR' | 'EUR' | 'GBP';
    paymentTerms?: string;
    breakdown?: {
      item: string;
      amount: number;
    }[];
  };

  validUntil: Date;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  sentAt?: Date;
  viewedAt?: Date;
  respondedAt?: Date;

  notes?: string;
  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const proposalSchema = new Schema<IProposal>(
  {
    proposalNumber: {
      type: String,
      required: true,
      unique: true,
    },
    lead: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    title: {
      type: String,
      required: [true, 'Proposal title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    serviceType: {
      type: String,
      enum: ['web-development', 'product-engineering', 'ai-automation', 'design', 'hybrid'],
      required: true,
    },
    scope: [
      {
        title: { type: String, required: true },
        description: String,
        included: { type: Boolean, default: true },
      },
    ],
    timeline: {
      type: String,
      required: true,
      trim: true,
    },
    deliverables: [String],
    technologies: [String],
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
      currency: {
        type: String,
        enum: ['USD', 'INR', 'EUR', 'GBP'],
        default: 'USD',
      },
      paymentTerms: String,
      breakdown: [
        {
          item: String,
          amount: Number,
        },
      ],
    },
    validUntil: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
      default: 'draft',
    },
    sentAt: Date,
    viewedAt: Date,
    respondedAt: Date,
    notes: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
proposalSchema.index({ lead: 1 });
proposalSchema.index({ status: 1 });
proposalSchema.index({ clientEmail: 1 });
proposalSchema.index({ validUntil: 1 });
proposalSchema.index({ createdAt: -1 });

const Proposal = mongoose.model<IProposal>('Proposal', proposalSchema);
export default Proposal;
