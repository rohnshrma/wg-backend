import { sendEmail, sendBroadcastEmail } from "./emailService";
import {
  sendWhatsAppText,
  sendWelcomeWhatsApp,
  sendAdmissionApprovedWhatsApp,
  sendPaymentWhatsApp,
  sendInstallmentReminderWhatsApp,
  sendLeadFollowUpWhatsApp,
  sendNewLeadWhatsAppToAdmin,
} from "./whatsappService";
import {
  sendWelcomeEmail,
  sendAdmissionApprovedEmail,
  sendPaymentConfirmationEmail,
  sendPasswordResetEmail,
  sendNewLeadNotification,
  sendInstallmentReminderEmail,
  sendCourseCompletionEmail,
} from "./emailService";

/**
 * Unified notification service — sends via email + WhatsApp in parallel.
 * Each method is fire-and-forget; failures are logged but don't block.
 */
export const NotificationService = {
  // Registration / Welcome
  async welcome(email: string, phone: string, name: string) {
    await Promise.allSettled([
      sendWelcomeEmail(email, name),
      sendWelcomeWhatsApp(phone, name),
    ]);
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
};
