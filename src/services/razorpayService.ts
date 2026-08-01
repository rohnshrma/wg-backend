import crypto from 'crypto';
import { getRazorpayClient } from '../config/razorpay';
import env from '../config/env';

interface CreateMandateParams {
  amount: number; // per-installment amount, in rupees
  totalCount: number;
  period: 'daily' | 'weekly' | 'monthly';
  interval: number;
  studentName: string;
  notes: Record<string, string>;
  // Unix timestamp (seconds) for the first charge. Without this, Razorpay
  // anchors the recurring debit date to whenever the customer happens to
  // finish UPI authentication — which lets a student who delays authorizing
  // silently push their own due date out every cycle. Passing start_at pins
  // every future cycle to the same calendar day regardless of auth timing.
  startAt?: number;
}

interface CreateMandateResult {
  planId: string;
  subscriptionId: string;
  shortUrl?: string;
}

/**
 * Creates a Razorpay Plan + Subscription pair for a student's installment
 * schedule. Subscriptions is the product Razorpay uses to back UPI AutoPay
 * mandates — the customer completes authentication once via the returned
 * short_url (Razorpay's hosted checkout), then each installment auto-debits
 * on schedule and fires the `subscription.charged` webhook.
 */
export const createSubscriptionMandate = async (
  params: CreateMandateParams
): Promise<CreateMandateResult> => {
  const client = getRazorpayClient();

  const plan = await client.plans.create({
    period: params.period,
    interval: params.interval,
    item: {
      name: `WebiGeeks installment — ${params.studentName}`,
      amount: Math.round(params.amount * 100), // Razorpay amounts are in paise
      currency: 'INR',
    },
  } as any);

  const subscription = await client.subscriptions.create({
    plan_id: plan.id,
    total_count: params.totalCount,
    customer_notify: 1,
    notes: params.notes,
    ...(params.startAt ? { start_at: params.startAt } : {}),
  } as any);

  return {
    planId: plan.id,
    subscriptionId: subscription.id,
    shortUrl: (subscription as any).short_url,
  };
};

export const cancelSubscriptionMandate = async (subscriptionId: string): Promise<void> => {
  const client = getRazorpayClient();
  await client.subscriptions.cancel(subscriptionId);
};

/**
 * Verifies a Razorpay webhook delivery's `X-Razorpay-Signature` header.
 * Implemented directly with HMAC-SHA256 per Razorpay's documented webhook
 * verification method, rather than relying on an SDK helper, so this stays
 * correct regardless of SDK version.
 */
export const verifyWebhookSignature = (rawBody: string | Buffer, signature: string): boolean => {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== signatureBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
};
