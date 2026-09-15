import mongoose, { Document, Schema } from 'mongoose';

export interface ICurriculumModule {
  moduleTitle: string;
  topics: string[];
}

export interface ICourseProject {
  title: string;
  description: string;
}

export interface ICourseFAQ {
  question: string;
  answer: string;
}

export interface ICourse extends Document {
  tenantId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  thumbnailUrl: string;
  logoUrl?: string;
  bannerUrl?: string;

  duration: string;
  mode: 'online' | 'offline' | 'hybrid';
  level: 'beginner' | 'intermediate' | 'advanced';
  fees: number;

  technologies: string[];
  curriculum: ICurriculumModule[];
  projects: ICourseProject[];
  careerOpportunities: string[];

  faqs: ICourseFAQ[];
  curriculumPdfUrl?: string;

  metaTitle?: string;
  metaDescription?: string;

  isFeatured: boolean;
  isActive: boolean;
  displayOrder: number;

  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      maxlength: [200, 'Short description cannot exceed 200 characters'],
    },
    fullDescription: {
      type: String,
      required: [true, 'Full description is required'],
    },
    thumbnailUrl: {
      type: String,
      required: [true, 'Thumbnail is required'],
    },
    logoUrl: String,
    bannerUrl: String,

    duration: {
      type: String,
      required: [true, 'Duration is required'],
    },
    mode: {
      type: String,
      enum: ['online', 'offline', 'hybrid'],
      default: 'hybrid',
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    fees: {
      type: Number,
      required: [true, 'Fees is required'],
      min: 0,
    },

    technologies: [{ type: String, trim: true }],
    curriculum: [
      {
        moduleTitle: { type: String, required: true },
        topics: [{ type: String }],
      },
    ],
    projects: [
      {
        title: { type: String, required: true },
        description: { type: String, required: true },
      },
    ],
    careerOpportunities: [{ type: String }],

    faqs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],
    curriculumPdfUrl: String,

    metaTitle: String,
    metaDescription: String,

    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Slug is unique per tenant, not globally — two different institutes can
// each run their own "python-course" slug.
courseSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
courseSchema.index({ isFeatured: 1, isActive: 1 });
courseSchema.index({ displayOrder: 1 });

const Course = mongoose.model<ICourse>('Course', courseSchema);
export default Course;
