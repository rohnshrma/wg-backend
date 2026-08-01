import crypto from 'crypto';
import { Request, Response } from 'express';
import Mandate, { MandateStatus } from '../models/Mandate';
import Installment from '../models/Installment';
import Student from '../models/Student';
import RazorpayWebhookEvent from '../models/RazorpayWebhookEvent';
import asyncHandler from '../utils/asyncHandler';
import { verifyWebhookSignature } from '../services/razorpayService';
import { NotificationService } from '../services/notificationService';
import { recordPaymentAndNotify } from './payment.controller';

type WebhookPayload = {
  event: string;
  payload?: {
    subscription?: { entity?: Record<string, any> };
    payment?: { entity?: Record<string, any> };
  };
};

const resolveSubscriptionId = (body: WebhookPayload): string | undefined =>
  body.payload?.subscription?.entity?.id || body.payload?.payment?.entity?.subscription_id;

const findMandate = (subscriptionId: string | undefined) =>
  subscriptionId ? Mandate.findOne({ razorpaySubscriptionId: subscriptionId }) : null;

/**
 * Marks the next unsettled installment on a mandate as debited, records a
 * Payment, generates a receipt, and sends the success notification. Reuses
 * `recordPaymentAndNotify` so this can't drift from the manual payment path
 * (same student-balance update, same Payment record shape).
 */
const handleSubscriptionCharged = async (body: WebhookPayload): Promise<void> => {
  const paymentEntity = body.payload?.payment?.entity;
  const subscriptionId = resolveSubscriptionId(body);
  if (!paymentEntity || !subscriptionId) return;

  const razorpayPaymentId: string = paymentEntity.id;

  // Defense-in-depth alongside the body-hash dedupe above: never process the
  // same Razorpay payment twice even if two different-looking deliveries
  // somehow reference it.
  const alreadyProcessed = await Installment.findOne({ razorpayPaymentId });
  if (alreadyProcessed) return;

  const mandate = await findMandate(subscriptionId);
  if (!mandate) {
    console.error(`[webhook] subscription.charged for unknown subscription ${subscriptionId}`);
    return;
  }

  if (mandate.status !== 'active') {
    mandate.status = 'active';
    await mandate.save();
  }

  const installment = await Installment.findOne({
    mandateId: mandate._id,
    status: 'pending',
  }).sort({ installmentNumber: 1 });
  if (!installment) {
    console.error(`[webhook] subscription.charged with no pending installment for mandate ${mandate._id}`);
    return;
  }

  const student = await Student.findById(mandate.studentId).populate('courseId', 'title');
  if (!student) return;

  const amount = paymentEntity.amount ? paymentEntity.amount / 100 : installment.amount;

  const payment = await recordPaymentAndNotify({
    student,
    courseId: mandate.courseId || student.courseId,
    amount,
    paymentMode: 'emi',
    paymentMethod: 'upi_autopay',
    transactionId: razorpayPaymentId,
    notes: 'Auto-debited via UPI AutoPay mandate',
    recordedBy: student.userId,
  });

  installment.status = 'paid';
  installment.paidDate = new Date();
  installment.razorpayPaymentId = razorpayPaymentId;
  installment.receiptUrl = payment.receiptUrl;
  installment.paymentId = payment._id as any;
  await installment.save();

  NotificationService.autoDebitSuccess(
    student.email,
    student.studentContactNumber,
    student.fullName,
    amount,
    installment.installmentNumber,
    payment.receiptUrl
  ).catch((error) => console.error('[webhook] autoDebitSuccess notification failed:', error));
};

const handleSubscriptionAuthenticated = async (body: WebhookPayload): Promise<void> => {
  const subscriptionId = resolveSubscriptionId(body);
  const mandate = await findMandate(subscriptionId);
  if (!mandate) return;

  mandate.status = 'active';
  await mandate.save();
};

const handlePaymentFailedOrPending = async (body: WebhookPayload): Promise<void> => {
  const paymentEntity = body.payload?.payment?.entity;
  const subscriptionId = resolveSubscriptionId(body);
  const mandate = await findMandate(subscriptionId);
  if (!mandate) return;

  const installment = await Installment.findOne({
    mandateId: mandate._id,
    status: 'pending',
  }).sort({ installmentNumber: 1 });
  if (!installment) return;

  installment.autoDebitFailedAt = new Date();
  installment.autoDebitFailureReason = paymentEntity?.error_description || 'Auto-debit attempt failed';
  await installment.save();

  const student = await Student.findById(mandate.studentId);
  if (!student) return;

  NotificationService.autoDebitFailed(
    student.email,
    student.studentContactNumber,
    student.fullName,
    student.admissionId,
    installment.amount,
    installment.installmentNumber
  ).catch((error) => console.error('[webhook] autoDebitFailed notification failed:', error));
};

const handleSubscriptionHaltedOrCancelled = async (body: WebhookPayload, status: MandateStatus): Promise<void> => {
  const subscriptionId = resolveSubscriptionId(body);
  const mandate = await findMandate(subscriptionId);
  if (!mandate) return;

  mandate.status = status;
  await mandate.save();

  const student = await Student.findById(mandate.studentId);
  NotificationService.mandateNeedsAttention(
    student?.fullName || 'Unknown student',
    student?.admissionId,
    `Mandate ${body.event === 'subscription.cancelled' ? 'cancelled' : 'halted'} by Razorpay — needs manual follow-up`
  ).catch((error) => console.error('[webhook] mandateNeedsAttention notification failed:', error));
};

/**
 * @desc    Razorpay webhook receiver — subscription/payment lifecycle events
 *          driving the AutoPay e-mandate flow.
 * @route   POST /api/webhooks/razorpay
 * @access  Public (verified via HMAC signature, not auth middleware)
 */
export const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.headers['x-razorpay-signature'] as string | undefined;

  if (!rawBody || !signature || !verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    return;
  }

  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  let dedupeEventId: unknown;
  try {
    const dedupeEvent = await RazorpayWebhookEvent.create({ bodyHash, event: req.body.event });
    dedupeEventId = dedupeEvent._id;
  } catch (error: any) {
    if (error?.code === 11000) {
      // Already processed this exact delivery — ack without reprocessing.
      res.status(200).json({ success: true, message: 'Already processed' });
      return;
    }
    throw error;
  }

  const body = req.body as WebhookPayload;

  // The dedupe row above is inserted before processing so two concurrent
  // deliveries of the same payload can't both process it. But that means a
  // failure *during* processing (e.g. a bad downstream record) would
  // otherwise leave this delivery permanently marked "handled" — Razorpay's
  // automatic retry would just be silently swallowed by the dedupe check
  // above, and the event (a real charge that happened) would never actually
  // get applied. Roll the dedupe row back on failure so a retry can
  // reprocess it, and respond with an error so Razorpay knows to retry.
  try {
    switch (body.event) {
      case 'subscription.authenticated':
      case 'subscription.activated':
        await handleSubscriptionAuthenticated(body);
        break;
      case 'subscription.charged':
        await handleSubscriptionCharged(body);
        break;
      case 'subscription.pending':
      case 'payment.failed':
        await handlePaymentFailedOrPending(body);
        break;
      case 'subscription.halted':
        await handleSubscriptionHaltedOrCancelled(body, 'paused');
        break;
      case 'subscription.cancelled':
        await handleSubscriptionHaltedOrCancelled(body, 'cancelled');
        break;
      default:
        console.log(`[webhook] unhandled event: ${body.event}`);
    }
  } catch (error) {
    await RazorpayWebhookEvent.deleteOne({ _id: dedupeEventId });
    console.error(`[webhook] processing ${body.event} failed, dedupe rolled back for retry:`, error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
    return;
  }

  res.status(200).json({ success: true });
});
