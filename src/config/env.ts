import dotenv from 'dotenv';
dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5001', 10),

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_COOKIE_EXPIRES_IN: parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '7', 10),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  // Email
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'WebiGeeks <noreply@webigeeks.com>',
  FROM_NAME: process.env.FROM_NAME || 'WebiGeeks',
  FROM_EMAIL: process.env.FROM_EMAIL || '',

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  WHATSAPP_ADMIN_PHONE: process.env.WHATSAPP_ADMIN_PHONE || '',
  ADMIN_WHATSAPP: process.env.ADMIN_WHATSAPP || '',

  // Site
  SITE_URL: process.env.SITE_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Contact
  CONTACT_PHONE: process.env.CONTACT_PHONE || '+91 8766367815',
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'webigeeksofficial@gmail.com',

  // Admin
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'webigeeksofficial@gmail.com',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123',
};

export { env };
export default env;
