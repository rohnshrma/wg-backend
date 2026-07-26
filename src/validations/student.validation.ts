import { z } from 'zod';

// Accepts every field/alias name the controller reads (fullName vs
// firstName/lastName/name, parentContactNumber vs parentPhone, etc.) so
// existing frontend payloads keep working; adds real type/format checks
// where mongoose previously would have only failed at save time.
export const studentProfileSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  name: z.string().trim().optional(),
  dateOfBirth: z.union([z.string(), z.date()]).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  photoUrl: z.string().trim().optional(),
  aadhaarUrl: z.string().trim().optional(),
  fatherName: z.string().trim().optional(),
  motherName: z.string().trim().optional(),
  parentName: z.string().trim().optional(),
  parentContactNumber: z.string().trim().optional(),
  parentPhone: z.string().trim().optional(),
  studentContactNumber: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email('Please provide a valid email').optional(),
  address: z
    .union([
      z.string(),
      z.object({
        street: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        pincode: z.string().trim().optional(),
      }),
    ])
    .optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  qualification: z.string().trim().optional(),
  courseId: z.string().trim().optional(),
  courseFees: z.coerce.number().min(0).optional(),
  joiningDate: z.union([z.string(), z.date()]).optional(),
  paymentMode: z.enum(['full', 'emi']).optional(),
});
