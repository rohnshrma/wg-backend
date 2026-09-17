import mongoose, { Document, Schema } from 'mongoose';

export interface IProjectMilestone {
  title: string;
  description?: string;
  dueDate: Date;
  completedDate?: Date;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface IProjectActivity {
  type: 'status_change' | 'note_added' | 'file_uploaded' | 'milestone_completed' | 'proposal_sent';
  description: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IProject extends Document {
  name: string;
  description: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  clientWebsite?: string;

  serviceType: 'web-development' | 'product-engineering' | 'ai-automation' | 'design' | 'hybrid';
  status: 'lead' | 'proposal' | 'active' | 'completed' | 'on-hold' | 'cancelled';

  budget: number;
  budgetCurrency: 'USD' | 'INR' | 'EUR' | 'GBP';
  budgetStatus: 'quoted' | 'accepted' | 'invoiced' | 'paid';

  startDate?: Date;
  endDate?: Date;
  expectedDelivery?: Date;
  actualDelivery?: Date;

  technologies: string[];
  teamMembers: mongoose.Types.ObjectId[];
  projectManager: mongoose.Types.ObjectId;

  milestones: IProjectMilestone[];
  activities: IProjectActivity[];

  attachments?: {
    name: string;
    url: string;
    uploadedAt: Date;
  }[];

  notes: string;
  relatedLead?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
    },
    clientName: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },
    clientEmail: {
      type: String,
      required: [true, 'Client email is required'],
      lowercase: true,
      trim: true,
    },
    clientPhone: {
      type: String,
      required: [true, 'Client phone is required'],
      trim: true,
    },
    clientCompany: {
      type: String,
      trim: true,
    },
    clientWebsite: {
      type: String,
      trim: true,
    },
    serviceType: {
      type: String,
      enum: ['web-development', 'product-engineering', 'ai-automation', 'design', 'hybrid'],
      required: true,
    },
    status: {
      type: String,
      enum: ['lead', 'proposal', 'active', 'completed', 'on-hold', 'cancelled'],
      default: 'lead',
    },
    budget: {
      type: Number,
      required: [true, 'Budget is required'],
      min: 0,
    },
    budgetCurrency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP'],
      default: 'USD',
    },
    budgetStatus: {
      type: String,
      enum: ['quoted', 'accepted', 'invoiced', 'paid'],
      default: 'quoted',
    },
    startDate: Date,
    endDate: Date,
    expectedDelivery: Date,
    actualDelivery: Date,
    technologies: [
      {
        type: String,
        trim: true,
      },
    ],
    teamMembers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    projectManager: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    milestones: [
      {
        title: { type: String, required: true },
        description: String,
        dueDate: { type: Date, required: true },
        completedDate: Date,
        status: {
          type: String,
          enum: ['pending', 'in-progress', 'completed'],
          default: 'pending',
        },
      },
    ],
    activities: [
      {
        type: {
          type: String,
          enum: ['status_change', 'note_added', 'file_uploaded', 'milestone_completed', 'proposal_sent'],
        },
        description: String,
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    attachments: [
      {
        name: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    relatedLead: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
projectSchema.index({ status: 1 });
projectSchema.index({ serviceType: 1 });
projectSchema.index({ projectManager: 1 });
projectSchema.index({ clientEmail: 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ expectedDelivery: 1 });
projectSchema.index({ budgetStatus: 1 });

const Project = mongoose.model<IProject>('Project', projectSchema);
export default Project;
