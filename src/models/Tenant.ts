import mongoose, { Document, Schema } from 'mongoose';

export interface ITenantColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface ITenant extends Document {
  slug: string;
  customDomain?: string;
  name: string;
  description?: string;
  logoUrl?: string;
  colors: ITenantColors;
  contactPhone: string;
  contactEmail: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'],
    },
    customDomain: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    colors: {
      // Matches WebiGeeks' actual brand palette (wg-frontend globals.css
      // --color-primary/-secondary/-accent) so the default tenant's theme
      // stays pixel-identical to the site's current look.
      primary: { type: String, default: '#1672B8' },
      secondary: { type: String, default: '#606062' },
      accent: { type: String, default: '#F97316' },
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true,
    },
    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Tenant = mongoose.model<ITenant>('Tenant', tenantSchema);
export default Tenant;
