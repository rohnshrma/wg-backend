import { z } from 'zod';

export const createStaffUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  role: z.enum(['admin', 'counsellor'], {
    errorMap: () => ({ message: 'Role must be admin or counsellor' }),
  }),
});

export const updateStaffUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['admin', 'counsellor']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});
