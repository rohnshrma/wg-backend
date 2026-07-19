import mongoose, { Document, Schema } from 'mongoose';

export interface ITestimonial extends Document {
  studentName: string;
  courseName: string;
  companyPlaced?: string;
  designation?: string;
  salaryPackage?: string;
  photoUrl?: string;
  videoUrl?: string;
  testimonialText: string;
  rating: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema<ITestimonial>(
  {
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    courseName: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
    },
    companyPlaced: { type: String, trim: true },
    designation: { type: String, trim: true },
    salaryPackage: { type: String, trim: true },
    photoUrl: String,
    videoUrl: String,
    testimonialText: {
      type: String,
      required: [true, 'Testimonial text is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

testimonialSchema.index({ isActive: 1, displayOrder: 1 });

const Testimonial = mongoose.model<ITestimonial>('Testimonial', testimonialSchema);
export default Testimonial;
