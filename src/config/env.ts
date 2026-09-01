import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(5001),

    // MongoDB
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    // JWT
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters')
      .refine((v) => v !== 'fallback-secret-change-in-production', {
        message: 'JWT_SECRET must not use the insecure placeholder value',
      }),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_COOKIE_EXPIRES_IN: z.coerce.number().default(7),

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: z.string().default(''),
    CLOUDINARY_API_KEY: z.string().default(''),
    CLOUDINARY_API_SECRET: z.string().default(''),

    // Email
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
    EMAIL_FROM: z.string().default('WebiGeeks <noreply@webigeeks.com>'),
    FROM_NAME: z.string().default('WebiGeeks'),
    FROM_EMAIL: z.string().default(''),

    // Razorpay (Subscriptions / UPI AutoPay e-mandate) — optional, same
    // graceful-degradation pattern as Cloudinary: absent in dev is fine,
    // mandate-creation routes 503 until real keys are set.
    RAZORPAY_KEY_ID: z.string().default(''),
    RAZORPAY_KEY_SECRET: z.string().default(''),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

    // WhatsApp
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
    WHATSAPP_ACCESS_TOKEN: z.string().default(''),
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(''),
    WHATSAPP_ADMIN_PHONE: z.string().default(''),
    ADMIN_WHATSAPP: z.string().default(''),

    // WhatsApp AI Admissions Automation — everything here is optional and the
    // whole feature defaults OFF (see config/whatsappAutomation.ts). Absent in
    // dev is fine, same graceful-degradation pattern as Razorpay/Cloudinary.
    WHATSAPP_AUTOMATION_ENABLED: z.coerce.boolean().default(false),
    // Cosmetic only — the actual send/receive API calls use
    // WHATSAPP_PHONE_NUMBER_ID (Meta's internal resource id, not a real
    // phone number). This is purely what the CRM conversation log displays
    // as "our" number in a thread.
    WHATSAPP_BUSINESS_NUMBER: z.string().default(''),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().default(''),
    // Meta App Secret (not the access token) — used to verify the
    // X-Hub-Signature-256 header on inbound webhook deliveries.
    WHATSAPP_APP_SECRET: z.string().default(''),
    ANTHROPIC_API_KEY: z.string().default(''),
    ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
    // Rupees. 0 = free demo. Never hardcoded elsewhere — read at booking time.
    DEMO_FEE_AMOUNT: z.coerce.number().default(0),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5001/api/auth/google/callback'),

    // Site
    SITE_URL: z.string().default('http://localhost:3000'),
    FRONTEND_URL: z.string().default('http://localhost:3000'),

    // Contact
    CONTACT_PHONE: z.string().default('+91 8766367815'),
    CONTACT_EMAIL: z.string().default('webigeeksofficial@gmail.com'),

    // Admin
    ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
    ADMIN_DEFAULT_PASSWORD: z
      .string()
      .min(8, 'ADMIN_DEFAULT_PASSWORD must be at least 8 characters'),
  })
  .refine(
    (data) => data.NODE_ENV !== 'production' || data.ADMIN_DEFAULT_PASSWORD !== 'Admin@123',
    {
      message:
        'ADMIN_DEFAULT_PASSWORD must not be the well-known default "Admin@123" in production',
      path: ['ADMIN_DEFAULT_PASSWORD'],
    }
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nFix the environment variables above (see .env.example) and restart.\n');
  process.exit(1);
}

const env = parsed.data;

export { env };
export default env;
