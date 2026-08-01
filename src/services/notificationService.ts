import { sendBroadcastEmail } from "./emailService";
import {
  sendWelcomeWhatsApp,
  sendAdmissionApprovedWhatsApp,
  sendAdmissionRejectedWhatsApp,
  sendPaymentWhatsApp,
  sendPaymentReceiptWhatsApp,
  sendInstallmentReminderWhatsApp,
  sendLeadFollowUpWhatsApp,
  sendNewLeadWhatsAppToAdmin,
  sendWhatsAppText,
} from "./whatsappService";
import {
  sendWelcomeEmail,
  sendAdmissionApprovedEmail,
  sendAdmissionRejectedEmail,
  sendPaymentConfirmationEmail,
  sendPaymentReceiptEmail,
  sendPasswordResetEmail,
  sendNewLeadNotification,
  sendInstallmentReminderEmail,
  sendCourseCompletionEmail,
  sendAutoDebitReminderEmail,
  sendAutoDebitSuccessEmail,
  sendAutoDebitFailedEmail,
  sendMandateAlertEmail,
} from "./emailService";

/**
 * Unified notification service — sends via email + WhatsApp in parallel.
 * Each method is fire-and-forget; failures are logged but don't block.
 */
export const NotificationService = {
  // Registration / Welcome. Phone is optional — at account-creation time
  // (before profile completion) there's no phone number on file yet.
  async welcome(email: string, name: string, phone?: string) {
    const tasks = [sendWelcomeEmail(email, name)];
    if (phone) tasks.push(sendWelcomeWhatsApp(phone, name));
    await Promise.allSettled(tasks);
  },

  // Admission approved
  async admissionApproved(
    email: string,
    phone: string,
    name: string,
    admissionId: string,
    courseName: string
  ) {
    await Promise.allSettled([
      sendAdmissionApprovedEmail(email, name, admissionId, courseName),
      sendAdmissionApprovedWhatsApp(phone, name, admissionId, courseName),
    ]);
  },

  // Payment received
  async paymentReceived(
    email: string,
    phone: string,
    name: string,
    amount: number,
    receiptNumber: string,
    courseName: string,
    pendingAmount: number
  ) {
    await Promise.allSettled([
      sendPaymentConfirmationEmail(email, name, amount, receiptNumber, courseName, pendingAmount),
      sendPaymentWhatsApp(phone, name, amount, receiptNumber),
    ]);
  },

  // Explicit "send receipt" action (admin-triggered, on demand). Unlike the
  // other methods here this isn't fire-and-forget: the admin is waiting on
  // the result, so it returns whether the send actually succeeded.
  async sendReceipt(
    channel: 'email' | 'whatsapp',
    email: string,
    phone: string,
    name: string,
    receiptNumber: string,
    receiptUrl: string,
    courseName: string,
    amount: number
  ): Promise<boolean> {
    if (channel === 'email') {
      return sendPaymentReceiptEmail(email, name, receiptNumber, receiptUrl, courseName, amount);
    }
    return sendPaymentReceiptWhatsApp(phone, name, receiptNumber, receiptUrl, amount);
  },

  // Admission rejected
  async admissionRejected(email: string, phone: string, name: string, reason: string) {
    await Promise.allSettled([
      sendAdmissionRejectedEmail(email, name, reason),
      sendAdmissionRejectedWhatsApp(phone, name, reason),
    ]);
  },

  // Password reset
  async passwordReset(email: string, resetUrl: string) {
    await sendPasswordResetEmail(email, resetUrl);
  },

  // New lead captured
  async newLead(name: string, phone: string, email: string, course: string, source: string) {
    await Promise.allSettled([
      sendNewLeadNotification(name, phone, email, course, source),
      sendNewLeadWhatsAppToAdmin(name, phone, course, source),
    ]);
  },

  // Installment reminder
  async installmentReminder(
    email: string,
    phone: string,
    name: string,
    amount: number,
    dueDate: string,
    installmentNumber: number
  ) {
    await Promise.allSettled([
      sendInstallmentReminderEmail(email, name, amount, dueDate, installmentNumber),
      sendInstallmentReminderWhatsApp(phone, name, amount, dueDate),
    ]);
  },

  // Course completion
  async courseCompleted(email: string, name: string, courseName: string) {
    await sendCourseCompletionEmail(email, name, courseName);
  },

  // Lead follow-up (admin-triggered)
  async followUpLead(phone: string, name: string, courseName: string) {
    await sendLeadFollowUpWhatsApp(phone, name, courseName);
  },

  // Broadcast to all
  async broadcast(emails: string[], subject: string, message: string) {
    const promises = emails.map((email) => sendBroadcastEmail(email, subject, message));
    await Promise.allSettled(promises);
  },

  // AutoPay — pre-debit reminder (informational; student already authorized
  // recurring auto-debit, this isn't a request to pay manually)
  async autoDebitReminder(
    email: string,
    phone: string,
    name: string,
    amount: number,
    dueDate: string,
    installmentNumber: number
  ) {
    const tasks = [sendAutoDebitReminderEmail(email, name, amount, dueDate, installmentNumber)];
    if (phone) {
      tasks.push(
        sendWhatsAppText(
          phone,
          `Hi ${name}, your AutoPay installment #${installmentNumber} of ₹${amount.toLocaleString("en-IN")} will be auto-debited on ${dueDate}. No action needed — just ensure sufficient balance is available.`
        )
      );
    }
    await Promise.allSettled(tasks);
  },

  // AutoPay — debit succeeded
  async autoDebitSuccess(
    email: string,
    phone: string,
    name: string,
    amount: number,
    installmentNumber: number,
    receiptUrl?: string
  ) {
    const tasks = [sendAutoDebitSuccessEmail(email, name, amount, installmentNumber, receiptUrl)];
    if (phone) {
      tasks.push(
        sendWhatsAppText(
          phone,
          `Hi ${name}, your AutoPay installment #${installmentNumber} of ₹${amount.toLocaleString("en-IN")} was debited successfully.${receiptUrl ? ` Receipt: ${receiptUrl}` : ""}`
        )
      );
    }
    await Promise.allSettled(tasks);
  },

  // AutoPay — debit failed (student + admin alert)
  async autoDebitFailed(
    email: string,
    phone: string,
    name: string,
    admissionId: string | undefined,
    amount: number,
    installmentNumber: number
  ) {
    const tasks = [
      sendAutoDebitFailedEmail(email, name, amount, installmentNumber),
      sendMandateAlertEmail(name, admissionId, `Installment #${installmentNumber} auto-debit failed`),
    ];
    if (phone) {
      tasks.push(
        sendWhatsAppText(
          phone,
          `Hi ${name}, we couldn't auto-debit your AutoPay installment #${installmentNumber} of ₹${amount.toLocaleString("en-IN")}. Our team will reach out — you can also pay manually from your dashboard.`
        )
      );
    }
    await Promise.allSettled(tasks);
  },

  // AutoPay — mandate needs manual follow-up (halted/cancelled)
  async mandateNeedsAttention(studentName: string, admissionId: string | undefined, reason: string) {
    await sendMandateAlertEmail(studentName, admissionId, reason);
  },
};
