// Runs before the test framework loads any application module (Jest
// `setupFiles`), so `src/config/env.ts` sees these values the first time
// it's required. Dummy but well-formed enough for the mandate-creation
// endpoint's `assertRazorpayConfigured()` check and for the webhook
// signature tests to compute a real, matching HMAC.
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy0000000000';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_test_webhook_secret';

// WhatsApp AI admissions automation — dummy but well-formed so
// isWhatsAppAutomationEnabled() can be exercised as both true and false
// across tests, and so signature verification tests can compute a real,
// matching HMAC against a known secret.
process.env.WHATSAPP_AUTOMATION_ENABLED = process.env.WHATSAPP_AUTOMATION_ENABLED || 'true';
process.env.WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || 'dummy_phone_number_id';
process.env.WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'dummy_access_token';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'dummy_verify_token';
process.env.WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || 'dummy_app_secret';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'dummy_anthropic_key';
