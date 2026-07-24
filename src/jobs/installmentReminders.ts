import Installment from '../models/Installment';
import { NotificationService } from '../services/notificationService';

const REMINDER_WINDOW_DAYS = 3;

/**
 * Runs daily: flips overdue installments to 'overdue', then sends a
 * reminder (email + WhatsApp) for anything due within the next few days
 * or already overdue, at most once every 24h per installment.
 */
export const runInstallmentReminders = async (): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reminderCutoff = new Date(startOfToday);
  reminderCutoff.setDate(reminderCutoff.getDate() + REMINDER_WINDOW_DAYS);

  const overdueResult = await Installment.updateMany(
    { status: 'pending', dueDate: { $lt: startOfToday } },
    { $set: { status: 'overdue' } }
  );
  if (overdueResult.modifiedCount > 0) {
    console.log(`[installmentReminders] marked ${overdueResult.modifiedCount} installment(s) overdue`);
  }

  const dueSoon = await Installment.find({
    status: { $in: ['pending', 'overdue'] },
    dueDate: { $lt: reminderCutoff },
    $or: [
      { reminderSent: false },
      { reminderSentAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    ],
  }).populate('studentId', 'fullName email studentContactNumber');

  let sent = 0;
  for (const installment of dueSoon) {
    const student = installment.studentId as any;
    if (!student?.email) continue;

    try {
      await NotificationService.installmentReminder(
        student.email,
        student.studentContactNumber,
        student.fullName,
        installment.amount,
        installment.dueDate.toLocaleDateString('en-IN'),
        installment.installmentNumber
      );
      installment.reminderSent = true;
      installment.reminderSentAt = now;
      await installment.save();
      sent += 1;
    } catch (error) {
      console.error(`[installmentReminders] failed for installment ${installment._id}:`, error);
    }
  }

  if (sent > 0) {
    console.log(`[installmentReminders] sent ${sent} reminder(s)`);
  }
};
