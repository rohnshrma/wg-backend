import mongoose, { Document, Schema } from 'mongoose';

export interface IGallery extends Document {
  imageUrl: string;
  thumbnailUrl: string;
  caption?: string;
  category: 'classroom' | 'events' | 'activities' | 'campus' | 'placements';
  displayOrder: number;
  isActive: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const gallerySchema = new Schema<IGallery>(
  {
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    thumbnailUrl: {
      type: String,
      required: [true, 'Thumbnail URL is required'],
    },
    caption: { type: String, trim: true },
    category: {
      type: String,
      enum: ['classroom', 'events', 'activities', 'campus', 'placements'],
      required: [true, 'Category is required'],
    },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

gallerySchema.index({ category: 1, isActive: 1 });
gallerySchema.index({ displayOrder: 1 });

const Gallery = mongoose.model<IGallery>('Gallery', gallerySchema);
export default Gallery;
