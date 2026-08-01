import Razorpay from 'razorpay';
import env from './env';
import { ApiError } from '../utils/apiError';

export const isRazorpayConfigured = (): boolean =>
  Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export const assertRazorpayConfigured = (): void => {
  if (!isRazorpayConfigured()) {
    throw new ApiError(503, 'AutoPay is not configured yet. Please contact support.');
  }
};

// Lazily constructed so an unconfigured environment (no keys) can still boot
// the server — mirrors the Cloudinary config's always-construct-but-may-be-
// empty approach, except the Razorpay SDK throws on missing key_id/key_secret
// at construction time, so this only builds a client once keys exist.
let client: Razorpay | null = null;

export const getRazorpayClient = (): Razorpay => {
  assertRazorpayConfigured();
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
};

export default getRazorpayClient;
