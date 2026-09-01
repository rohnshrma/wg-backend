/**
 * Normalizes any of the formats a WhatsApp `wa_id` or a customer-typed number
 * can arrive in (+91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX, "+91 XXXXXXXXXX",
 * with spaces/dashes) down to the bare 10-digit form `Enquiry.mobile` already
 * validates against (`/^[6-9]\d{9}$/`). Returns null when the result isn't a
 * valid 10-digit Indian mobile number, rather than guessing — callers must
 * treat that as "can't safely link to an Enquiry" and escalate/log, not crash.
 */
export const normalizeIndianMobile = (raw: string): string | null => {
  const digits = raw.replace(/[^0-9]/g, '');

  let candidate = digits;
  if (candidate.length === 12 && candidate.startsWith('91')) {
    candidate = candidate.slice(2);
  } else if (candidate.length === 11 && candidate.startsWith('0')) {
    candidate = candidate.slice(1);
  }

  if (/^[6-9]\d{9}$/.test(candidate)) return candidate;
  return null;
};

/** WhatsApp's Cloud API wants numbers as 91XXXXXXXXXX with no `+`/spaces. */
export const toWhatsAppFormat = (mobile10Digit: string): string => `91${mobile10Digit}`;
