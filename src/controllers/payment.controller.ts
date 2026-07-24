import { Request, Response } from 'express';
import Payment, { IPayment } from '../models/Payment';
import Installment from '../models/Installment';
import Student, { IStudent } from '../models/Student';
import Counter from '../models/Counter';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotificationService } from '../services/notificationService';
import { generateAndUploadReceipt } from '../utils/generateReceiptPdf';
import { calculateInstallments } from '../utils/helpers';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/apiError';

const assertOwnsStudentRecord = async (req: Request, studentId: string): Promise<void> => {
  if (req.user.role === 'admin') return;

  const student = await Student.findById(studentId).select('userId');
  if (!student) throw new NotFoundError('Student not found');
  if (student.userId.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('You can only view your own records');
  }
};

/**
 * Shared core for "money changes hands": creates the Payment record (with
 * a receipt number + best-effort PDF receipt), updates the student's
 * running balance, and fires the payment-received notification. Used by
 * both direct payment recording and installment settlement so the two
 * flows can't drift out of sync with each other.
 */
const recordPaymentAndNotify = async (params: {
  student: IStudent & { _id: any };
  courseId: any;
  amount: number;
  paymentMode: 'full' | 'emi';
  paymentMethod: string;
  transactionId?: string;
  notes?: string;
  paymentDate?: Date;
  recordedBy: any;
}): Promise<IPayment> => {
  const { student, courseId, amount, paymentMode, paymentMethod, transactionId, notes, paymentDate, recordedBy } = params;

  const receiptNumber = await (Counter as any).getNextReceiptNumber();

  student.totalPaid += amount;
  student.pendingAmount = student.courseFees - student.totalPaid;
  await student.save();

  const courseName = (student.courseId as any)?.title || 'your course';

  const receiptUrl = await generateAndUploadReceipt({
    receiptNumber,
    studentName: student.fullName,
    admissionId: student.admissionId,
    courseName,
    amount,
    paymentMethod,
    transactionId,
    paymentDate: paymentDate || new Date(),
    totalPaid: student.totalPaid,
    pendingAmount: student.pendingAmount,
  });

  const payment = await Payment.create({
    studentId: student._id,
    courseId,
    amount,
    paymentMode,
    paymentMethod,
    transactionId,
    receiptNumber,
    receiptUrl: receiptUrl || undefined,
    notes,
    recordedBy,
    paymentDate: paymentDate || new Date(),
  });

  try {
    await NotificationService.paymentReceived(
      student.email,
      student.studentContactNumber,
      student.fullName,
      amount,
      receiptNumber,
      courseName,
      student.pendingAmount
    );
  } catch (error) {
    console.error('Failed to send payment-received notification:', error);
  }

  return payment;
};

/**
 * When a lump payment is recorded (as opposed to settling one specific
 * installment via markInstallmentPaid), apply it against the student's
 * oldest pending/overdue installments in order, marking each fully paid
 * while the amount covers it. The schema has no concept of a
 * partially-paid installment, so a leftover that doesn't fully cover the
 * next installment is left unapplied at the per-installment level —
 * UNLESS the student's overall balance is now fully settled (their
 * payments just didn't line up evenly with installment boundaries), in
 * which case every remaining installment is marked paid too, since
 * nothing is actually still owed.
 */
const applyPaymentToInstallments = async (
  studentId: any,
  paymentId: any,
  amount: number,
  studentIsFullyPaid: boolean
): Promise<string[]> => {
  const installments = await Installment.find({
    studentId,
    status: { $in: ['pending', 'overdue'] },
  }).sort({ installmentNumber: 1 });

  let remaining = amount;
  const settledIds: string[] = [];

  for (const installment of installments) {
    if (!studentIsFullyPaid && remaining < installment.amount) break;

    installment.status = 'paid';
    installment.paidDate = new Date();
    installment.paymentId = paymentId;
    await installment.save();

    remaining -= installment.amount;
    settledIds.push(installment._id.toString());
  }

  return settledIds;
};

export const getAllPayments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const total = await Payment.countDocuments();
  const payments = await Payment.find()
    .populate('studentId', 'fullName admissionId')
    .populate('courseId', 'title')
    .populate('recordedBy', 'email')
    .sort({ paymentDate: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  sendResponse(res, {
    message: 'Payments fetched',
    data: payments,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * @desc    Export all payments as CSV
 * @route   GET /api/payments/export
 * @access  Admin
 */
export const exportPayments = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const payments = await Payment.find()
    .populate('studentId', 'fullName admissionId')
    .populate('courseId', 'title')
    .sort({ paymentDate: -1 });

  const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

  const header = ['Receipt #', 'Student', 'Admission ID', 'Course', 'Amount', 'Method', 'Transaction ID', 'Date'];
  const rows = payments.map((p) => {
    const student = p.studentId as any;
    const course = p.courseId as any;
    return [
      p.receiptNumber,
      student?.fullName || '',
      student?.admissionId || '',
      course?.title || '',
      p.amount,
      p.paymentMethod,
      p.transactionId || '',
      p.paymentDate.toISOString().slice(0, 10),
    ]
      .map((v) => escapeCsv(String(v)))
      .join(',');
  });

  const csv = [header.map(escapeCsv).join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

export const getStudentPayments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await assertOwnsStudentRecord(req, req.params.id as string);

  const payments = await Payment.find({ studentId: req.params.id })
    .populate('courseId', 'title')
    .sort({ paymentDate: -1 });

  sendResponse(res, { message: 'Student payments fetched', data: payments });
});

export const recordPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studentId, courseId, amount, paymentMode, paymentMethod, transactionId, notes, paymentDate } = req.body;

  if (!amount || amount <= 0) throw new BadRequestError('Amount must be greater than 0');
  if (!paymentMethod) throw new BadRequestError('Payment method is required');

  const student = await Student.findById(studentId).populate('courseId', 'title');
  if (!student) throw new NotFoundError('Student not found');

  if (amount > student.pendingAmount) {
    throw new BadRequestError(
      `Amount exceeds the pending balance of ₹${student.pendingAmount.toLocaleString('en-IN')}`
    );
  }

  const payment = await recordPaymentAndNotify({
    student,
    courseId: courseId || student.courseId,
    amount,
    paymentMode: paymentMode || student.paymentMode,
    paymentMethod,
    transactionId,
    notes,
    paymentDate: paymentDate ? new Date(paymentDate) : undefined,
    recordedBy: req.user._id,
  });

  const settledInstallmentIds = await applyPaymentToInstallments(
    student._id,
    payment._id,
    amount,
    student.pendingAmount <= 0
  );

  sendResponse(res, {
    statusCode: 201,
    message: settledInstallmentIds.length
      ? `Payment recorded and ${settledInstallmentIds.length} installment(s) marked paid`
      : 'Payment recorded',
    data: { ...payment.toObject(), settledInstallmentIds },
  });
});

/**
 * @desc    Send (or regenerate + send) a payment's receipt via email or WhatsApp
 * @route   POST /api/payments/:id/send-receipt
 * @access  Admin
 */
export const sendPaymentReceipt = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { channel } = req.body;
  if (channel !== 'email' && channel !== 'whatsapp') {
    throw new BadRequestError('channel must be "email" or "whatsapp"');
  }

  const payment = await Payment.findById(req.params.id)
    .populate('studentId', 'fullName email studentContactNumber')
    .populate('courseId', 'title');
  if (!payment) throw new NotFoundError('Payment not found');

  const student = payment.studentId as any;
  const course = payment.courseId as any;
  const courseName = course?.title || 'your course';

  if (channel === 'email' && !student?.email) {
    throw new BadRequestError('This student has no email on file');
  }
  if (channel === 'whatsapp' && !student?.studentContactNumber) {
    throw new BadRequestError('This student has no phone number on file');
  }

  let receiptUrl: string | undefined = payment.receiptUrl;
  if (!receiptUrl) {
    const studentDoc = await Student.findById(student._id);
    const generatedUrl = await generateAndUploadReceipt({
      receiptNumber: payment.receiptNumber,
      studentName: student.fullName,
      admissionId: studentDoc?.admissionId,
      courseName,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      paymentDate: payment.paymentDate,
      totalPaid: studentDoc?.totalPaid ?? payment.amount,
      pendingAmount: studentDoc?.pendingAmount ?? 0,
    });
    if (!generatedUrl) {
      throw new BadRequestError('Could not generate the receipt PDF. Please try again.');
    }
    receiptUrl = generatedUrl;
    payment.receiptUrl = receiptUrl;
    await payment.save();
  }

  const sent = await NotificationService.sendReceipt(
    channel,
    student.email,
    student.studentContactNumber,
    student.fullName,
    payment.receiptNumber,
    receiptUrl,
    courseName,
    payment.amount
  );

  if (!sent) {
    throw new BadRequestError(
      `Failed to send the receipt via ${channel === 'email' ? 'email' : 'WhatsApp'}. Check that it's configured correctly and try again.`
    );
  }

  sendResponse(res, { message: `Receipt sent via ${channel === 'email' ? 'email' : 'WhatsApp'}` });
});

export const getInstallments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await assertOwnsStudentRecord(req, req.params.id as string);

  const installments = await Installment.find({ studentId: req.params.id })
    .sort({ installmentNumber: 1 });

  sendResponse(res, { message: 'Installments fetched', data: installments });
});

/**
 * @desc    Generate an installment plan for a student's remaining balance
 * @route   POST /api/payments/installments/student/:id/generate
 * @access  Admin
 */
export const generateInstallmentPlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { numberOfInstallments, startDate, intervalDays } = req.body;

  if (!numberOfInstallments || numberOfInstallments < 1) {
    throw new BadRequestError('numberOfInstallments must be at least 1');
  }

  const student = await Student.findById(req.params.id);
  if (!student) throw new NotFoundError('Student not found');

  const existing = await Installment.countDocuments({ studentId: student._id });
  if (existing > 0) {
    throw new BadRequestError('An installment plan already exists for this student');
  }

  if (student.pendingAmount <= 0) {
    throw new BadRequestError('Student has no pending balance to schedule');
  }

  const amounts = calculateInstallments(student.pendingAmount, numberOfInstallments);
  const firstDueDate = startDate ? new Date(startDate) : new Date();
  const interval = intervalDays || 30;

  const installments = await Installment.insertMany(
    amounts.map((amount, i) => ({
      studentId: student._id,
      installmentNumber: i + 1,
      amount,
      dueDate: new Date(firstDueDate.getTime() + i * interval * 24 * 60 * 60 * 1000),
      status: 'pending',
    }))
  );

  sendResponse(res, { statusCode: 201, message: 'Installment plan generated', data: installments });
});

export const markInstallmentPaid = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { paymentMethod, transactionId } = req.body;
  if (!paymentMethod) throw new BadRequestError('Payment method is required');

  const installment = await Installment.findById(req.params.id);
  if (!installment) throw new NotFoundError('Installment not found');

  if (installment.status === 'paid') {
    throw new BadRequestError('Installment is already paid');
  }

  const student = await Student.findById(installment.studentId).populate('courseId', 'title');
  if (!student) throw new NotFoundError('Student not found');

  // An out-of-band payment (e.g. a lump sum recorded directly) can already
  // have settled some or all of this installment's face-value amount
  // without that payment lining up on installment boundaries. Never collect
  // more than what's actually still owed.
  if (student.pendingAmount <= 0) {
    installment.status = 'paid';
    installment.paidDate = new Date();
    await installment.save();

    sendResponse(res, {
      message: 'Installment marked as paid (already settled by an earlier payment)',
      data: { installment },
    });
    return;
  }

  const amountToCollect = Math.min(installment.amount, student.pendingAmount);

  const payment = await recordPaymentAndNotify({
    student,
    courseId: student.courseId,
    amount: amountToCollect,
    paymentMode: 'emi',
    paymentMethod,
    transactionId,
    recordedBy: req.user._id,
  });

  installment.status = 'paid';
  installment.paidDate = new Date();
  installment.paymentId = payment._id as any;
  await installment.save();

  sendResponse(res, { message: 'Installment marked as paid', data: { installment, payment } });
});
