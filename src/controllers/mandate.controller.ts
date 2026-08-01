import { Request, Response } from 'express';
import Mandate from '../models/Mandate';
import Installment from '../models/Installment';
import Student from '../models/Student';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/apiError';
import { assertRazorpayConfigured } from '../config/razorpay';
import { createSubscriptionMandate, cancelSubscriptionMandate } from '../services/razorpayService';

const assertOwnsStudentRecord = async (req: Request, studentId: string): Promise<void> => {
  if (req.user!.role === 'admin') return;

  const student = await Student.findById(studentId).select('userId');
  if (!student) throw new NotFoundError('Student not found');
  if (student.userId.toString() !== req.user!._id.toString()) {
    throw new ForbiddenError('You can only view your own records');
  }
};

const cycleLengthDays = (period: 'daily' | 'weekly' | 'monthly', interval: number): number => {
  const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  return days * interval;
};

// Razorpay needs runway between mandate creation and the first charge for
// the student to actually complete UPI authentication — too tight a window
// risks the first cycle firing (and failing) before they've authorized.
const MIN_AUTH_LEAD_DAYS = 2;

// Business rule: the student must complete UPI authentication the same day
// as admission, or within 24h at the latest — enforced via Razorpay's own
// expire_by (the subscription becomes unauthorizable after this), not just
// a UI reminder. Without this, an unauthorized mandate link stays valid
// indefinitely, and whenever the student eventually authorizes becomes
// their (arbitrarily delayed) first debit date, undermining the fixed
// cadence entirely.
const MANDATE_AUTH_EXPIRY_HOURS = 24;

/**
 * @desc    Create a Razorpay Subscription (UPI AutoPay e-mandate) covering
 *          a student's remaining balance in equal installments, and the
 *          matching local Installment records for tracking/display.
 * @route   POST /api/payments/mandate
 * @access  Admin
 */
export const createMandate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  assertRazorpayConfigured();

  const { studentId, numberOfInstallments, startDate, period, interval } = req.body;

  const student = await Student.findById(studentId).populate('courseId', 'title');
  if (!student) throw new NotFoundError('Student not found');

  if (student.pendingAmount <= 0) {
    throw new BadRequestError('Student has no pending balance to schedule');
  }

  const existingInstallments = await Installment.countDocuments({ studentId: student._id });
  if (existingInstallments > 0) {
    throw new BadRequestError('An installment plan already exists for this student');
  }

  const existingMandate = await Mandate.findOne({
    studentId: student._id,
    status: { $in: ['created', 'authenticated', 'active', 'paused'] },
  });
  if (existingMandate) {
    throw new BadRequestError('An AutoPay mandate already exists for this student');
  }

  // Razorpay Subscriptions charge one fixed amount per cycle — unlike the
  // manual installment plan (which puts an uneven remainder on the first
  // installment), AutoPay can't vary the per-cycle amount, so the balance
  // must split evenly. Surfacing this up front is better than silently
  // under-collecting the last installment.
  if (student.pendingAmount % numberOfInstallments !== 0) {
    throw new BadRequestError(
      `Pending balance ₹${student.pendingAmount.toLocaleString('en-IN')} does not split evenly into ${numberOfInstallments} installments. AutoPay requires an equal amount per cycle — adjust the installment count, or use the manual installment plan instead.`
    );
  }
  const amountPerInstallment = student.pendingAmount / numberOfInstallments;

  // Default: no explicit start date — first installment auto-debits
  // immediately as part of UPI authentication itself (Razorpay's native
  // behavior, verified), and each subsequent cycle follows at a fixed
  // interval from there (30 days for "monthly" — see razorpayService).
  // An explicit startDate is still honored for the rare admin-scheduled
  // case, requiring enough runway for the student to authenticate first.
  let firstDueDate: Date | undefined;
  if (startDate) {
    firstDueDate = new Date(startDate);
    const minDate = new Date(Date.now() + MIN_AUTH_LEAD_DAYS * 24 * 60 * 60 * 1000);
    if (firstDueDate < minDate) {
      throw new BadRequestError(
        `startDate must be at least ${MIN_AUTH_LEAD_DAYS} days out, to give the student time to complete UPI authentication before the first charge.`
      );
    }
  }

  // expire_by: if a future startDate was given, authentication must happen
  // before that scheduled first charge; otherwise the student has the
  // standard 24h window from mandate creation (right at admission).
  const expireBy = firstDueDate
    ? Math.floor(firstDueDate.getTime() / 1000)
    : Math.floor((Date.now() + MANDATE_AUTH_EXPIRY_HOURS * 60 * 60 * 1000) / 1000);

  const { planId, subscriptionId, shortUrl } = await createSubscriptionMandate({
    amount: amountPerInstallment,
    totalCount: numberOfInstallments,
    period,
    interval,
    studentName: student.fullName,
    notes: {
      studentId: student._id.toString(),
      admissionId: student.admissionId || '',
    },
    startAt: firstDueDate ? Math.floor(firstDueDate.getTime() / 1000) : undefined,
    expireBy,
  });

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

  const mandate = await Mandate.create({
    studentId: student._id,
    courseId: student.courseId,
    razorpayPlanId: planId,
    razorpaySubscriptionId: subscriptionId,
    status: 'created',
    amount: amountPerInstallment,
    totalCount: numberOfInstallments,
    period,
    interval,
    shortUrl,
    consent: {
      acceptedAt: new Date(),
      ip,
    },
  });

  const cycleDays = cycleLengthDays(period, interval);
  // Local due-date display: if no startDate was given, installment #1 is
  // "now" — matching Razorpay's immediate first-debit-on-authentication
  // behavior — with each later cycle cycleDays after that.
  const scheduleAnchor = firstDueDate ?? new Date();

  const installments = await Installment.insertMany(
    Array.from({ length: numberOfInstallments }, (_, i) => ({
      studentId: student._id,
      installmentNumber: i + 1,
      amount: amountPerInstallment,
      dueDate: new Date(scheduleAnchor.getTime() + i * cycleDays * 24 * 60 * 60 * 1000),
      status: 'pending',
      mandateId: mandate._id,
      collectionMethod: 'autopay',
    }))
  );

  sendResponse(res, {
    statusCode: 201,
    message: 'AutoPay mandate created — student must complete UPI authentication to activate it',
    data: { mandate, installments, shortUrl },
  });
});

/**
 * @desc    List all AutoPay mandates, most recent first — powers the admin
 *          payments view's per-student mandate status column.
 * @route   GET /api/payments/mandates
 * @access  Admin
 */
export const getAllMandates = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const mandates = await Mandate.find()
    .populate('studentId', 'fullName admissionId')
    .sort({ createdAt: -1 });

  sendResponse(res, { message: 'Mandates fetched', data: mandates });
});

/**
 * @desc    Fetch the AutoPay mandate (if any) for a student
 * @route   GET /api/payments/mandate/student/:id
 * @access  Admin, or the student themself
 */
export const getStudentMandate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await assertOwnsStudentRecord(req, req.params.id as string);

  const mandate = await Mandate.findOne({ studentId: req.params.id }).sort({ createdAt: -1 });

  sendResponse(res, { message: 'Mandate fetched', data: mandate });
});

/**
 * @desc    Cancel an active/paused AutoPay mandate
 * @route   PATCH /api/payments/mandate/:id/cancel
 * @access  Admin
 */
export const cancelMandate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const mandate = await Mandate.findById(req.params.id);
  if (!mandate) throw new NotFoundError('Mandate not found');

  if (mandate.status === 'cancelled') {
    throw new BadRequestError('Mandate is already cancelled');
  }

  await cancelSubscriptionMandate(mandate.razorpaySubscriptionId);
  mandate.status = 'cancelled';
  await mandate.save();

  sendResponse(res, { message: 'Mandate cancelled', data: mandate });
});
