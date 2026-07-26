import nodemailer from 'nodemailer';
import env from './env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  // Some hosts (e.g. Render) have no outbound IPv6 route, which makes Gmail's
  // IPv6 SMTP address hang/ENETUNREACH instead of falling back quickly.
  // `family` isn't in @types/nodemailer's Options but is supported at runtime.
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
} as nodemailer.TransportOptions);

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.log('⚠️ Email service not configured:', error.message);
  } else {
    console.log('✅ Email service ready');
  }
});

export default transporter;
