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
  // Unix timestamp (seconds) for the first charge. Omitted by default so
  // Razorpay charges the first installment immediately as part of UPI
  // authentication itself (verified behavior) — only set when the admin
  // explicitly schedules a future start date.
  startAt?: number;
  // Unix timestamp (seconds) after which an unauthenticated subscription
  // auto-expires and can no longer be authorized. This is what actually
  // enforces "student must accept within 24h" — without it, an unauthorized
  // mandate link sits valid indefinitely, and whenever the student finally
  // authorizes becomes their (delayed) first debit date.
  expireBy?: number;
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

  // Razorpay's "monthly" period advances by calendar month (28-31 days,
  // depending on the month) — not a literal 30 days. The business wants an
  // exact 30-day cadence between installments, and the local Installment
  // due-date math already assumes a flat 30 days per "monthly" cycle, so
  // billing Razorpay itself in exact 30-day units keeps the real charge
  // date and the locally-displayed due date from drifting apart.
  const razorpayPeriod = params.period === 'monthly' ? 'daily' : params.period;
  const razorpayInterval =
    params.period === 'monthly' ? 30 * params.interval : params.interval;

  const plan = await client.plans.create({
    period: razorpayPeriod,
    interval: razorpayInterval,
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
    ...(params.expireBy ? { expire_by: params.expireBy } : {}),
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
