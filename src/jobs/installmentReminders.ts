import Installment from '../models/Installment';
import { NotificationService } from '../services/notificationService';

// Also serves as the AutoPay pre-debit notice window. RBI's e-mandate rules
// require pre-debit notification (commonly cited minimum ~24h); 3 days
// comfortably clears that, but the exact current minimum wasn't re-verified
// against live Razorpay/NPCI docs in this session — worth confirming.
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
      // AutoPay installments get an informational "this will be auto-debited"
      // notice (RBI-mandated pre-debit notification for e-mandates) rather
      // than the manual-plan "please make a payment" copy — the student
      // already authorized the recurring debit at mandate setup, so asking
      // them to pay would be confusing and wrong.
      if (installment.collectionMethod === 'autopay') {
        await NotificationService.autoDebitReminder(
          student.email,
          student.studentContactNumber,
          student.fullName,
          installment.amount,
          installment.dueDate.toLocaleDateString('en-IN'),
          installment.installmentNumber
        );
      } else {
        await NotificationService.installmentReminder(
          student.email,
          student.studentContactNumber,
          student.fullName,
          installment.amount,
          installment.dueDate.toLocaleDateString('en-IN'),
          installment.installmentNumber
        );
      }
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
