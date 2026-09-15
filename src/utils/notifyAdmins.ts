import User from '../models/User';
import Notification from '../models/Notification';

/**
 * Creates an in-app Notification for every active admin user in the given
 * tenant. Used for events admins need to act on (new lead, new
 * registration) — separate from NotificationService, which handles
 * email/WhatsApp delivery. Scoped to `tenantId` so one tenant's activity
 * never surfaces as a notification for another tenant's admins.
 */
export const notifyAdmins = async (
  tenantId: string,
  title: string,
  message: string,
  link?: string
): Promise<void> => {
  const admins = await User.find({ tenantId, role: 'admin', isActive: true }).select('_id');
  if (admins.length === 0) return;

  await Notification.insertMany(
    admins.map((admin) => ({
      tenantId,
      recipientId: admin._id,
      title,
      message,
      type: 'general',
      link,
    }))
  );
};
