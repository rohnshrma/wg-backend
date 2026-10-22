import { z } from 'zod';

export const deletePaymentSchema = z.object({
  reason: z.string().trim().min(1, 'A reason for deleting this payment is required'),
});
