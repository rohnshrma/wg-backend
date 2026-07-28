import { z } from 'zod';
import { ENQUIRY_SOURCES, ENQUIRY_STAGES, WORKING_STATUSES } from '../models/Enquiry';

const mobile = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please provide a valid email')
  .optional()
  .or(z.literal(''));

export const createEnquirySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  course: z.string().trim().min(1, 'Course is required').max(120),
  education: z.string().trim().max(120).optional().or(z.literal('')),
  workingStatus: z.enum(WORKING_STATUSES).optional(),
  mobile,
  email: optionalEmail,
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
  // Defaulted to "now" server-side so the client never has to send it, but
  // accepted when present so a back-dated enquiry can be recorded.
  enquiryDate: z.coerce.date().optional(),
  source: z.enum(ENQUIRY_SOURCES, {
    errorMap: () => ({ message: 'Select a valid source' }),
  }),
  // Admins may assign an enquiry to a counsellor at creation time.
  owner: z.string().trim().length(24, 'Invalid owner id').optional(),
});

export const updateEnquirySchema = createEnquirySchema.partial().extend({
  stage: z.enum(ENQUIRY_STAGES).optional(),
});

export const moveStageSchema = z.object({
  stage: z.enum(ENQUIRY_STAGES, {
    errorMap: () => ({ message: 'Select a valid stage' }),
  }),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});
