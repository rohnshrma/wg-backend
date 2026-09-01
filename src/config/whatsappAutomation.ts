import env from './env';

/**
 * The single kill-switch for the entire WhatsApp AI admissions automation.
 * Checked at the very top of the webhook handler — when this returns false,
 * the AI must not reply, the CRM must not be mutated, no bookings/payments/
 * notifications may be created. Flipping WHATSAPP_AUTOMATION_ENABLED=false
 * and restarting the process is enough to disable it instantly.
 *
 * Also requires the credentials the automation actually needs at runtime —
 * a flag set to true with blank credentials would otherwise crash on every
 * inbound message instead of failing safe.
 */
export const hasWhatsAppAppSecret = (): boolean => Boolean(env.WHATSAPP_APP_SECRET);

// WHATSAPP_APP_SECRET is included here (not just checked separately) so a
// misconfiguration — flag flipped on but the app secret forgotten — fails
// as "automation not enabled" (safe, visible: every message gets acked and
// ignored) rather than "enabled but every real webhook 403s" (looks broken,
// silently drops every lead). The GET verification handshake doesn't call
// this at all, so it still works before the app secret is ever set.
export const isWhatsAppAutomationEnabled = (): boolean =>
  env.WHATSAPP_AUTOMATION_ENABLED &&
  Boolean(env.WHATSAPP_PHONE_NUMBER_ID) &&
  Boolean(env.WHATSAPP_ACCESS_TOKEN) &&
  Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) &&
  Boolean(env.ANTHROPIC_API_KEY) &&
  hasWhatsAppAppSecret();
