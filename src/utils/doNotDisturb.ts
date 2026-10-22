import Student from '../models/Student';
import User from '../models/User';

/**
 * Regex matching any stored phone string whose last 10 digits are the same
 * as `phone`'s, ignoring spaces/dashes in between ("+91 98765 43210",
 * "919876543210" and "9876543210" all match). null if fewer than 10 digits.
 */
export const phoneSuffixPattern = (phone: string): string | null => {
  const last10 = (phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (last10.length < 10) return null;
  return `${last10.split('').join('\\D*')}\\D*$`;
};

/**
 * Do Not Disturb is absolute: once an admin mutes a student, nothing at all
 * is emailed or WhatsApped to them — reminders, receipts, notices, anything —
 * until they're unmuted. It's enforced here, at the lowest send layer, so no
 * caller can forget to check it.
 */
export const isRecipientMuted = async (
  channel: 'email' | 'whatsapp',
  to: string
): Promise<boolean> => {
  try {
    if (!to) return false;
    if (channel === 'email') {
      const email = to.trim().toLowerCase();
      // Match the profile contact email and the login email (password
      // reset etc. go to the latter), which can differ.
      const user = await User.findOne({ email }).select('_id');
      return !!(await Student.exists({
        notificationsMuted: true,
        $or: [{ email }, ...(user ? [{ userId: user._id }] : [])],
      }));
    }
    // Phone numbers are stored in mixed formats (+91…, 91…, bare 10 digits),
    // so match on the last 10 digits.
    const pattern = phoneSuffixPattern(to);
    if (!pattern) return false;
    return !!(await Student.exists({
      studentContactNumber: { $regex: pattern },
      notificationsMuted: true,
    }));
  } catch (error) {
    console.error('Do Not Disturb lookup failed:', error);
    return false;
  }
};
