import cron from 'node-cron';
import { runInstallmentReminders } from './installmentReminders';

/**
 * Registers all scheduled jobs. Called once at server startup.
 */
export const registerJobs = (): void => {
  // Every day at 9:00 AM server time
  cron.schedule('0 9 * * *', () => {
    runInstallmentReminders().catch((error) => {
      console.error('[jobs] installmentReminders failed:', error);
    });
  });

  console.log('⏰ Scheduled jobs registered (installment reminders — daily 9:00 AM)');
};
