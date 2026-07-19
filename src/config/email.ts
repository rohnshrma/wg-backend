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
});

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.log('⚠️ Email service not configured:', error.message);
  } else {
    console.log('✅ Email service ready');
  }
});

export default transporter;
