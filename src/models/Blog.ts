import mongoose, { Document, Schema } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentType: "html" | "plain";
  coverImageUrl: string;
  author: mongoose.Types.ObjectId;
  category: string;
  tags: string[];
  relatedPosts?: mongoose.Types.ObjectId[];
  isPublished: boolean;
  publishedAt?: Date;
  metaTitle?: string;
  metaDescription?: string;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const blogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: [true, 'Blog title is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      maxlength: [300, 'Excerpt cannot exceed 300 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    contentType: {
      type: String,
      enum: ['html', 'plain'],
      default: 'html',
    },
    coverImageUrl: {
      type: String,
      required: [true, 'Cover image is required'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    tags: [{ type: String, trim: true }],
    relatedPosts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Blog',
      },
    ],
    isPublished: { type: Boolean, default: false },
    publishedAt: Date,
    metaTitle: String,
    metaDescription: String,
    viewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Note: slug index created automatically via unique:true
blogSchema.index({ isPublished: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });

const Blog = mongoose.model<IBlog>('Blog', blogSchema);
export default Blog;
