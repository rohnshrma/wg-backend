import { Request, Response } from 'express';
import Payment from '../models/Payment';
import Installment from '../models/Installment';
import Student from '../models/Student';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/apiError';

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

export const getStudentPayments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const payments = await Payment.find({ studentId: req.params.id })
    .populate('courseId', 'title')
    .sort({ paymentDate: -1 });

  sendResponse(res, { message: 'Student payments fetched', data: payments });
});

export const recordPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studentId, courseId, amount, paymentMode, paymentMethod, transactionId, notes, paymentDate } = req.body;

  const student = await Student.findById(studentId);
  if (!student) throw new NotFoundError('Student not found');

  const payment = await Payment.create({
    studentId,
    courseId: courseId || student.courseId,
    amount,
    paymentMode: paymentMode || student.paymentMode,
    paymentMethod,
    transactionId,
    notes,
    recordedBy: req.user._id,
    paymentDate: paymentDate || new Date(),
  });

  // Update student's totalPaid
  student.totalPaid += amount;
  student.pendingAmount = student.courseFees - student.totalPaid;
  await student.save();

  sendResponse(res, { statusCode: 201, message: 'Payment recorded', data: payment });
});

export const getInstallments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const installments = await Installment.find({ studentId: req.params.id })
    .sort({ installmentNumber: 1 });

  sendResponse(res, { message: 'Installments fetched', data: installments });
});

export const markInstallmentPaid = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const installment = await Installment.findById(req.params.id);
  if (!installment) throw new NotFoundError('Installment not found');

  if (installment.status === 'paid') {
    throw new BadRequestError('Installment is already paid');
  }

  installment.status = 'paid';
  installment.paidDate = new Date();
  if (req.body.paymentId) installment.paymentId = req.body.paymentId;
  await installment.save();

  sendResponse(res, { message: 'Installment marked as paid', data: installment });
});
