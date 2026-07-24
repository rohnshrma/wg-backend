import axios from "axios";
import { env } from "../config/env";
import whatsappConfig from "../config/whatsapp";

const sendWhatsAppRequest = async (data: any): Promise<boolean> => {
  try {
    await axios.post(whatsappConfig.apiUrl, data, {
      headers: {
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    console.log("📱 WhatsApp message sent");
    return true;
  } catch (error: any) {
    console.error("WhatsApp send failed:", error.response?.data || error.message);
    return false;
  }
};

// Format phone number to WhatsApp format (91XXXXXXXXXX)
const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return cleaned;
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
};

// 1. Send text message
export const sendWhatsAppText = (to: string, body: string) =>
  sendWhatsAppRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatPhone(to),
    type: "text",
    text: { preview_url: false, body },
  });

// 2. Welcome message
export const sendWelcomeWhatsApp = (to: string, name: string) =>
  sendWhatsAppText(
    to,
    `🎓 *Welcome to WebiGeeks, ${name}!*\n\nThank you for registering. Your account has been created.\n\n📋 Next steps:\n1. Complete your profile\n2. Upload documents\n3. Wait for approval\n\nLogin: ${env.SITE_URL || "https://webigeeks.com"}/login\n\nNeed help? Reply to this message or call us. 📞`
  );

// 3. Admission approved message
export const sendAdmissionApprovedWhatsApp = (
  to: string,
  name: string,
  admissionId: string,
  courseName: string
) =>
  sendWhatsAppText(
    to,
    `🎉 *Congratulations, ${name}!*\n\nYour admission has been *APPROVED*.\n\n📋 Details:\n• Admission ID: ${admissionId}\n• Course: ${courseName}\n• Status: ✅ Approved\n\nLogin to your dashboard to view course details and make payment.\n🔗 ${env.SITE_URL || "https://webigeeks.com"}/dashboard`
  );

// 3b. Admission rejected message
export const sendAdmissionRejectedWhatsApp = (
  to: string,
  name: string,
  reason: string
) =>
  sendWhatsAppText(
    to,
    `Hi ${name},\n\nThank you for your interest in WebiGeeks. After reviewing your registration, we're unable to approve it at this time.\n\n📋 Reason: ${reason}\n\nContact us if you'd like to discuss further.`
  );

// 4. Payment received message
export const sendPaymentWhatsApp = (
  to: string,
  name: string,
  amount: number,
  receiptNumber: string
) =>
  sendWhatsAppText(
    to,
    `✅ *Payment Received, ${name}!*\n\n💰 Amount: ₹${amount.toLocaleString("en-IN")}\n🧾 Receipt: ${receiptNumber}\n\nView history: ${env.SITE_URL || "https://webigeeks.com"}/dashboard/payments\n\nThank you! 🙏`
  );

// 4b. Payment receipt (explicit send/resend, includes the actual PDF link)
export const sendPaymentReceiptWhatsApp = (
  to: string,
  name: string,
  receiptNumber: string,
  receiptUrl: string,
  amount: number
) =>
  sendWhatsAppText(
    to,
    `🧾 *Your Payment Receipt, ${name}*\n\n💰 Amount: ₹${amount.toLocaleString("en-IN")}\n🧾 Receipt: ${receiptNumber}\n\n📄 Download: ${receiptUrl}\n\nThank you! 🙏`
  );

// 5. Installment reminder
export const sendInstallmentReminderWhatsApp = (
  to: string,
  name: string,
  amount: number,
  dueDate: string
) =>
  sendWhatsAppText(
    to,
    `⏰ *Payment Reminder, ${name}*\n\nYour installment of ₹${amount.toLocaleString("en-IN")} is due on ${dueDate}.\n\nPlease make the payment at the earliest.\n🔗 ${env.SITE_URL || "https://webigeeks.com"}/dashboard/payments`
  );

// 6. Lead follow-up (admin-triggered)
export const sendLeadFollowUpWhatsApp = (
  to: string,
  name: string,
  courseName: string
) =>
  sendWhatsAppText(
    to,
    `Hi ${name}! 👋\n\nThank you for your interest in *${courseName}* at WebiGeeks.\n\nWe'd love to help you get started! Here's what we offer:\n✅ 100% Practical Training\n✅ AI-Integrated Curriculum\n✅ Placement Assistance\n✅ Flexible Timings\n\n📞 Call us or reply to this message to book a FREE demo class!\n\n🔗 ${env.SITE_URL || "https://webigeeks.com"}/courses`
  );

// 7. New lead notification (to admin)
export const sendNewLeadWhatsAppToAdmin = (
  name: string,
  phone: string,
  course: string,
  source: string
) => {
  const adminPhone = env.ADMIN_WHATSAPP;
  if (!adminPhone) return Promise.resolve(false);
  return sendWhatsAppText(
    adminPhone,
    `🔔 *New Lead Received!*\n\n👤 Name: ${name}\n📞 Phone: ${phone}\n📚 Course: ${course}\n📍 Source: ${source}\n\nFollow up ASAP! 🚀`
  );
};
