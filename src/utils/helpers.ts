import slugify from 'slugify';

/**
 * Generate a URL-friendly slug from a string
 */
export const generateSlug = (text: string): string => {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  });
};

/**
 * Normalize `page`/`limit` query params into safe, positive values.
 * Guards against negative/NaN pages producing a negative `skip` (which makes
 * MongoDB throw) and against unbounded `limit` values.
 */
export const getPagination = (
  page: unknown,
  limit: unknown,
  defaultLimit = 10,
  maxLimit = 100
): { page: number; limit: number; skip: number } => {
  const parsedPage = parseInt(page as string, 10);
  const parsedLimit = parseInt(limit as string, 10);

  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, maxLimit)
      : defaultLimit;

  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

/**
 * Generate a slug that is unique for the given mongoose model, appending a
 * numeric suffix on collision (my-post, my-post-2, my-post-3, ...).
 * `excludeId` lets an update keep its own slug.
 */
export const generateUniqueSlug = async (
  model: { exists: (filter: Record<string, unknown>) => Promise<unknown> },
  text: string,
  excludeId?: string
): Promise<string> => {
  const base = generateSlug(text) || 'untitled';
  let slug = base;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const filter: Record<string, unknown> = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    const clash = await model.exists(filter);
    if (!clash) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
};

/**
 * Generate admission ID in format: WEBI2026001
 */
export const generateAdmissionId = (year: number, sequence: number): string => {
  const paddedSeq = String(sequence).padStart(3, '0');
  return `WEBI${year}${paddedSeq}`;
};

/**
 * Calculate installment amounts
 */
export const calculateInstallments = (
  totalAmount: number,
  numberOfInstallments: number
): number[] => {
  const baseAmount = Math.floor(totalAmount / numberOfInstallments);
  const remainder = totalAmount - baseAmount * numberOfInstallments;

  const installments: number[] = [];
  for (let i = 0; i < numberOfInstallments; i++) {
    // Add remainder to the first installment
    installments.push(i === 0 ? baseAmount + remainder : baseAmount);
  }

  return installments;
};

/**
 * Format currency in INR
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Sanitize phone number (add +91 if not present)
 */
export const sanitizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
};
