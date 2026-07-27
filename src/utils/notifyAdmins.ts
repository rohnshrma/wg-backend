import User from '../models/User';
import Notification from '../models/Notification';

/**
 * Creates an in-app Notification for every active admin user. Used for
 * events admins need to act on (new lead, new registration) — separate
 * from NotificationService, which handles email/WhatsApp delivery.
 */
export const notifyAdmins = async (title: string, message: string, link?: string): Promise<void> => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (admins.length === 0) return;

  await Notification.insertMany(
    admins.map((admin) => ({
      recipientId: admin._id,
      title,
      message,
      type: 'general',
      link,
    }))
  );
};
