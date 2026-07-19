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
