import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export interface IStudent extends Document {
  userId: mongoose.Types.ObjectId;
  admissionId?: string;
  status: 'pending' | 'approved' | 'rejected';

  // Personal Info
  fullName: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  photoUrl: string;
  aadhaarUrl: string;

  // Family Info
  fatherName: string;
  motherName: string;
  parentContactNumber: string;

  // Contact Info
  studentContactNumber: string;
  email: string;
  address: IAddress;

  // Education
  qualification: string;

  // Course
  courseId: mongoose.Types.ObjectId;
  courseFees: number;
  joiningDate: Date;

  // Payment
  paymentMode: 'full' | 'emi';
  totalPaid: number;
  pendingAmount: number;

  // Approval
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;

  // Profile Lock
  isProfileLocked: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    admissionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },

    // Personal Info
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required'],
    },
    photoUrl: {
      type: String,
      default: '',
    },
    aadhaarUrl: {
      type: String,
      default: '',
    },

    // Family Info
    fatherName: {
      type: String,
      required: [true, "Father's name is required"],
      trim: true,
    },
    motherName: {
      type: String,
      required: [true, "Mother's name is required"],
      trim: true,
    },
    parentContactNumber: {
      type: String,
      required: [true, 'Parent contact number is required'],
    },

    // Contact Info
    studentContactNumber: {
      type: String,
      required: [true, 'Student contact number is required'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },

    // Education
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
    },

    // Course
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
    courseFees: {
      type: Number,
      required: [true, 'Course fees is required'],
      min: 0,
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
    },

    // Payment
    paymentMode: {
      type: String,
      enum: ['full', 'emi'],
      required: [true, 'Payment mode is required'],
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Approval
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    rejectionReason: String,

    // Profile Lock
    isProfileLocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (admissionId & userId indexes created automatically via unique:true)
studentSchema.index({ status: 1 });
studentSchema.index({ courseId: 1 });
studentSchema.index({ createdAt: -1 });

// Calculate pending amount before saving
studentSchema.pre('save', function (next) {
  this.pendingAmount = this.courseFees - this.totalPaid;
  next();
});

// `findOneAndUpdate` / `findByIdAndUpdate` bypass the `save` hook above, so
// recompute the derived pendingAmount whenever courseFees or totalPaid is
// changed that way (admin edits, profile updates). Without this, pendingAmount
// silently goes stale and feeds wrong numbers into analytics, the student
// payments dashboard and the payment/installment validation checks.
studentSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as Record<string, any> | null;
  if (!update) return next();

  const set = update.$set ?? update;
  const touchesFees =
    set.courseFees !== undefined || set.totalPaid !== undefined;
  if (!touchesFees) return next();

  const current = await this.model.findOne(this.getQuery()).lean<{
    courseFees?: number;
    totalPaid?: number;
  }>();
  if (!current) return next();

  const courseFees = set.courseFees ?? current.courseFees ?? 0;
  const totalPaid = set.totalPaid ?? current.totalPaid ?? 0;

  if (update.$set) update.$set.pendingAmount = courseFees - totalPaid;
  else update.pendingAmount = courseFees - totalPaid;

  this.setUpdate(update);
  next();
});

const Student = mongoose.model<IStudent>('Student', studentSchema);
export default Student;
