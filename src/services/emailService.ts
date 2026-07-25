import { env } from "../config/env";
import transporter from "../config/email";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    await transporter.sendMail({
      from: `"${env.FROM_NAME || "WebiGeeks"}" <${env.FROM_EMAIL || env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });
    console.log(`✉️  Email sent to ${options.to}`);
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
};

// ─── Email Templates ────────────────────────────────────────

const baseTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f6fb; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1672B8 0%, #606062 100%); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 24px; font-weight: 800; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.7); font-size: 14px; }
    .body { padding: 32px 24px; }
    .body h2 { color: #0F172A; font-size: 20px; margin: 0 0 16px; }
    .body p { color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1672B8 0%, #606062 100%); color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 8px 0; }
    .btn-accent { background: linear-gradient(135deg, #F97316 0%, #EAB308 100%); }
    .info-box { background: #E3EEF6; border-left: 4px solid #1672B8; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .info-box p { margin: 4px 0; color: #475569; font-size: 14px; }
    .info-box strong { color: #0F172A; }
    .footer { background: #0F172A; padding: 24px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.4); font-size: 12px; margin: 4px 0; }
    .footer a { color: #1672B8; text-decoration: none; }
    .divider { border: none; border-top: 1px solid #E2E8F0; margin: 24px 0; }
  </style>
</head>
<body>
  <div style="padding: 20px;">
    <div class="container">
      <div class="header">
        <h1>🎓 WebiGeeks</h1>
        <p>Your AI Skill Partner</p>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>WebiGeeks — Your AI Skill Partner</p>
        <p>📞 ${env.CONTACT_PHONE || "+91 8766367815"} | ✉️ ${env.CONTACT_EMAIL || "webigeeksofficial@gmail.com"}</p>
        <p style="margin-top: 8px;"><a href="${env.SITE_URL || "https://webigeeks.com"}">Visit Website</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// 1. Welcome / Registration Email
export const sendWelcomeEmail = (to: string, name: string) =>
  sendEmail({
    to,
    subject: "Welcome to WebiGeeks! 🎉",
    html: baseTemplate(
      `
      <h2>Welcome, ${name}! 👋</h2>
      <p>Thank you for registering with <strong>WebiGeeks</strong>, your AI skill partner. We're excited to have you on board!</p>
      <p>Your account has been created successfully. Here's what you need to do next:</p>
      <div class="info-box">
        <p><strong>Step 1:</strong> Complete your profile with all required details</p>
        <p><strong>Step 2:</strong> Upload necessary documents</p>
        <p><strong>Step 3:</strong> Wait for admin approval</p>
      </div>
      <p style="text-align: center;">
        <a href="${env.SITE_URL || "https://webigeeks.com"}/dashboard/profile" class="btn">Complete Your Profile</a>
      </p>
      <p>If you have any questions, feel free to reach out to us.</p>
      `,
      "Welcome to WebiGeeks"
    ),
  });

// 2. Admission Approved Email
export const sendAdmissionApprovedEmail = (
  to: string,
  name: string,
  admissionId: string,
  courseName: string
) =>
  sendEmail({
    to,
    subject: `Admission Approved — ${admissionId} 🎓`,
    html: baseTemplate(
      `
      <h2>Congratulations, ${name}! 🎉</h2>
      <p>Your admission has been <strong style="color: #22C55E;">approved</strong>. Welcome to the WebiGeeks family!</p>
      <div class="info-box">
        <p><strong>Admission ID:</strong> ${admissionId}</p>
        <p><strong>Course:</strong> ${courseName}</p>
        <p><strong>Status:</strong> ✅ Approved</p>
      </div>
      <p>Please login to your dashboard to view your course details and make the fee payment.</p>
      <p style="text-align: center;">
        <a href="${env.SITE_URL || "https://webigeeks.com"}/dashboard" class="btn">Go to Dashboard</a>
      </p>
      `,
      "Admission Approved"
    ),
  });

// 2b. Admission Rejected Email
export const sendAdmissionRejectedEmail = (
  to: string,
  name: string,
  reason: string
) =>
  sendEmail({
    to,
    subject: "Update on Your Admission — WebiGeeks",
    html: baseTemplate(
      `
      <h2>Hi ${name},</h2>
      <p>Thank you for your interest in WebiGeeks. After reviewing your registration, we're unable to approve it at this time.</p>
      <div class="info-box">
        <p><strong>Reason:</strong> ${reason}</p>
      </div>
      <p>If you believe this is a mistake or would like to discuss further, please contact our support team.</p>
      <p style="text-align: center;">
        <a href="${env.SITE_URL || "https://webigeeks.com"}/contact" class="btn">Contact Support</a>
      </p>
      `,
      "Admission Update"
    ),
  });

// 3. Payment Confirmation Email
export const sendPaymentConfirmationEmail = (
  to: string,
  name: string,
  amount: number,
  receiptNumber: string,
  courseName: string,
  pendingAmount: number
) =>
  sendEmail({
    to,
    subject: `Payment Received — ₹${amount.toLocaleString("en-IN")} ✅`,
    html: baseTemplate(
      `
      <h2>Payment Received, ${name} ✅</h2>
      <p>We've received your payment. Here are the details:</p>
      <div class="info-box">
        <p><strong>Receipt #:</strong> ${receiptNumber}</p>
        <p><strong>Amount:</strong> ₹${amount.toLocaleString("en-IN")}</p>
        <p><strong>Course:</strong> ${courseName}</p>
        <p><strong>Remaining Balance:</strong> ₹${pendingAmount.toLocaleString("en-IN")}</p>
      </div>
      ${pendingAmount > 0 ? `<p>Your next installment will be due soon. Check your dashboard for details.</p>` : `<p style="color: #22C55E; font-weight: bold;">🎉 Your fees are fully paid!</p>`}
      <p style="text-align: center;">
        <a href="${env.SITE_URL || "https://webigeeks.com"}/dashboard/payments" class="btn">View Payment History</a>
      </p>
      `,
      "Payment Confirmation"
    ),
  });

// 3b. Payment Receipt (explicit send/resend, includes the actual PDF link)
export const sendPaymentReceiptEmail = (
  to: string,
  name: string,
  receiptNumber: string,
  receiptUrl: string,
  courseName: string,
  amount: number
) =>
  sendEmail({
    to,
    subject: `Your Payment Receipt — ${receiptNumber} 🧾`,
    html: baseTemplate(
      `
      <h2>Hi ${name},</h2>
      <p>Here's your payment receipt, as requested.</p>
      <div class="info-box">
        <p><strong>Receipt #:</strong> ${receiptNumber}</p>
        <p><strong>Amount:</strong> ₹${amount.toLocaleString("en-IN")}</p>
        <p><strong>Course:</strong> ${courseName}</p>
      </div>
      <p style="text-align: center;">
        <a href="${receiptUrl}" class="btn">Download Receipt PDF</a>
      </p>
      `,
      "Payment Receipt"
    ),
  });

// 4. Password Reset Email
export const sendPasswordResetEmail = (to: string, resetUrl: string) =>
  sendEmail({
    to,
    subject: "Reset Your Password — WebiGeeks",
    html: baseTemplate(
      `
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="btn btn-accent">Reset Password</a>
      </p>
      <p>This link will expire in <strong>30 minutes</strong>.</p>
      <hr class="divider">
      <p style="font-size: 13px; color: #94A3B8;">If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
      `,
      "Reset Password"
    ),
  });

// 5. New Lead Notification (to Admin)
export const sendNewLeadNotification = (
  name: string,
  phone: string,
  email: string,
  course: string,
  source: string
) =>
  sendEmail({
    to: env.ADMIN_EMAIL || env.CONTACT_EMAIL || "webigeeksofficial@gmail.com",
    subject: `🔔 New Lead: ${name} — ${course}`,
    html: baseTemplate(
      `
      <h2>New Inquiry Received 🔔</h2>
      <p>A new lead has been captured from the website.</p>
      <div class="info-box">
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Course Interested:</strong> ${course}</p>
        <p><strong>Source:</strong> ${source}</p>
      </div>
      <p style="text-align: center;">
        <a href="${env.SITE_URL || "https://webigeeks.com"}/admin/leads" class="btn btn-accent">View in Dashboard</a>
      </p>
      `,
      "New Lead"
    ),
  });

// 6. Installment Due Reminder
export const sendInstallmentReminderEmail = (
  to: string,
  name: string,
  amount: number,
  dueDate: string,
  installmentNumber: number
) =>
  sendEmail({
    to,
    subject: `⏰ Installment #${installmentNumber} Due — ₹${amount.toLocaleString("en-IN")}`,
    html: baseTemplate(
      `
      <h2>Payment Reminder, ${name} ⏰</h2>
      <p>This is a friendly reminder that your installment payment is due.</p>
      <div class="info-box">
        <p><strong>Installment #:</strong> ${installmentNumber}</p>
        <p><strong>Amount:</strong> ₹${amount.toLocaleString("en-IN")}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
      </div>
      <p>Please make the payment at the earliest to avoid any issues.</p>
      <p style="text-align: center;">
        <a href="${env.SITE_URL || "https://webigeeks.com"}/dashboard/payments" class="btn">Make Payment</a>
      </p>
      `,
      "Payment Reminder"
    ),
  });

// 7. Course Completion Certificate Email
export const sendCourseCompletionEmail = (
  to: string,
  name: string,
  courseName: string
) =>
  sendEmail({
    to,
    subject: `🎓 Congratulations! You've Completed ${courseName}`,
    html: baseTemplate(
      `
      <h2>Congratulations, ${name}! 🎓🎉</h2>
      <p>You have successfully completed the <strong>${courseName}</strong> course at WebiGeeks!</p>
      <p>We're incredibly proud of your dedication and hard work. You're now equipped with industry-ready skills.</p>
      <div class="info-box">
        <p><strong>Course:</strong> ${courseName}</p>
        <p><strong>Status:</strong> ✅ Completed</p>
      </div>
      <p>Your certificate will be available for download in your dashboard soon.</p>
      <p style="text-align: center;">
        <a href="${env.SITE_URL || "https://webigeeks.com"}/dashboard/documents" class="btn">View Certificate</a>
      </p>
      <p>Keep learning, keep growing! 🚀</p>
      `,
      "Course Completed"
    ),
  });

// 8. General Broadcast / Announcement Email
export const sendBroadcastEmail = (
  to: string,
  subject: string,
  message: string
) =>
  sendEmail({
    to,
    subject: `📢 ${subject}`,
    html: baseTemplate(
      `
      <h2>${subject}</h2>
      <p>${message}</p>
      <hr class="divider">
      <p style="font-size: 13px; color: #94A3B8;">This is a broadcast message from WebiGeeks. If you have questions, reply to this email.</p>
      `,
      subject
    ),
  });
