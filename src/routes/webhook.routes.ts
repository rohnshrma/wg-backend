import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/webhook.controller';

const router = Router();

// No `protect` — Razorpay calls this server-to-server. Authenticity is
// verified via HMAC signature inside the handler, not session/JWT auth.
router.post('/razorpay', handleRazorpayWebhook);

export default router;
