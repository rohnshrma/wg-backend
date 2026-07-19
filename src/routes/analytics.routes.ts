import { Router, Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import Student from '../models/Student';
import Lead from '../models/Lead';
import Payment from '../models/Payment';
import Course from '../models/Course';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';

const router = Router();

// Overview stats
router.get('/overview', protect, authorize('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalStudents,
    totalLeads,
    pendingAdmissions,
    totalCourses,
  ] = await Promise.all([
    Student.countDocuments({ status: 'approved' }),
    Lead.countDocuments(),
    Student.countDocuments({ status: 'pending' }),
    Course.countDocuments({ isActive: true }),
  ]);

  // Revenue calculations
  const revenueResult = await Payment.aggregate([
    { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
  ]);
  const totalRevenue = revenueResult[0]?.totalRevenue || 0;

  // Pending fees
  const pendingFeesResult = await Student.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: null, totalPending: { $sum: '$pendingAmount' } } },
  ]);
  const pendingFees = pendingFeesResult[0]?.totalPending || 0;

  // Course-wise student count
  const courseWiseStudents = await Student.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$courseId', count: { $sum: 1 } } },
    {
      $lookup: {
        from: 'courses',
        localField: '_id',
        foreignField: '_id',
        as: 'course',
      },
    },
    { $unwind: '$course' },
    {
      $project: {
        courseName: '$course.title',
        count: 1,
      },
    },
    { $sort: { count: -1 } },
  ]);

  sendResponse(res, {
    message: 'Analytics overview',
    data: {
      totalStudents,
      totalLeads,
      pendingAdmissions,
      totalCourses,
      totalRevenue,
      pendingFees,
      courseWiseStudents,
    },
  });
}));

// Monthly admissions chart
router.get('/admissions', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const data = await Student.aggregate([
    {
      $match: {
        status: 'approved',
        approvedAt: {
          $gte: new Date(`${year}-01-01`),
          $lt: new Date(`${year + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$approvedAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in all 12 months
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: data.find((d: any) => d._id === i + 1)?.count || 0,
  }));

  sendResponse(res, { message: 'Monthly admissions', data: months });
}));

// Revenue chart
router.get('/revenue', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const data = await Payment.aggregate([
    {
      $match: {
        paymentDate: {
          $gte: new Date(`${year}-01-01`),
          $lt: new Date(`${year + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$paymentDate' },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    total: data.find((d: any) => d._id === i + 1)?.total || 0,
  }));

  sendResponse(res, { message: 'Monthly revenue', data: months });
}));

// Lead conversion rate
router.get('/leads', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const [total, converted, bySource] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ status: 'converted' }),
    Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  sendResponse(res, {
    message: 'Lead analytics',
    data: {
      total,
      converted,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : 0,
      bySource,
    },
  });
}));

// Course popularity
router.get('/courses', protect, authorize('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const data = await Lead.aggregate([
    { $group: { _id: '$courseInterested', inquiries: { $sum: 1 } } },
    { $sort: { inquiries: -1 } },
    { $limit: 10 },
  ]);

  sendResponse(res, { message: 'Course popularity', data });
}));

export default router;
