// Runs before the test framework loads any application module (Jest
// `setupFiles`), so `src/config/env.ts` sees these values the first time
// it's required. Dummy but well-formed enough for the mandate-creation
// endpoint's `assertRazorpayConfigured()` check and for the webhook
// signature tests to compute a real, matching HMAC.
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy0000000000';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_test_webhook_secret';
