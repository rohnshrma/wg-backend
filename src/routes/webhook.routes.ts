import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/webhook.controller';
import { verifyWhatsAppWebhook, receiveWhatsAppWebhook } from '../controllers/whatsappWebhook.controller';

const router = Router();

// No `protect` — Razorpay calls this server-to-server. Authenticity is
// verified via HMAC signature inside the handler, not session/JWT auth.
router.post('/razorpay', handleRazorpayWebhook);

// No `protect` — Meta calls these directly. GET verification is checked via
// the shared verify token; POST deliveries are verified via
// X-Hub-Signature-256 inside the handler.
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', receiveWhatsAppWebhook);

export default router;
