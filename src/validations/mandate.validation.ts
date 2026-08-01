import { z } from 'zod';

export const createMandateSchema = z.object({
  studentId: z.string().trim().min(1, 'studentId is required'),
  numberOfInstallments: z.coerce.number().int().min(1).max(24),
  startDate: z.union([z.string(), z.date()]).optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
  interval: z.coerce.number().int().min(1).default(1),
  // RBI requires explicit, informed consent to recurring auto-debit before a
  // mandate is created — the frontend must display the consent text and
  // capture an affirmative checkbox tick before this request is sent.
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Student consent to recurring auto-debit is required' }),
  }),
});
