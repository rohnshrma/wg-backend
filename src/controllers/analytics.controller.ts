import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import * as analyticsService from '../services/analyticsService';

const resolveYear = (req: Request): number => parseInt(req.query.year as string) || new Date().getFullYear();

/**
 * @desc    Overview stats (students, leads, revenue, pending fees, course-wise students)
 * @route   GET /api/analytics/overview
 * @access  Admin
 */
export const getOverview = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getOverview();
  sendResponse(res, { message: 'Analytics overview', data });
});

/**
 * @desc    Monthly admissions chart
 * @route   GET /api/analytics/admissions
 * @access  Admin
 */
export const getMonthlyAdmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getMonthlyAdmissions(resolveYear(req));
  sendResponse(res, { message: 'Monthly admissions', data });
});

/**
 * @desc    Monthly revenue chart with payment-method breakdown
 * @route   GET /api/analytics/revenue
 * @access  Admin
 */
export const getMonthlyRevenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getMonthlyRevenue(resolveYear(req));
  sendResponse(res, { message: 'Monthly revenue', data });
});

/**
 * @desc    Lead conversion analytics (overall, by source, monthly trend)
 * @route   GET /api/analytics/leads
 * @access  Admin
 */
export const getLeadAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getLeadAnalytics(resolveYear(req));
  sendResponse(res, { message: 'Lead analytics', data });
});

/**
 * @desc    Course popularity by inquiry count
 * @route   GET /api/analytics/courses
 * @access  Admin
 */
export const getCoursePopularity = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getCoursePopularity();
  sendResponse(res, { message: 'Course popularity', data });
});

/**
 * @desc    Student analytics (status/payment/gender breakdown, dues, enrollment trend)
 * @route   GET /api/analytics/students
 * @access  Admin
 */
export const getStudentAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getStudentAnalytics(resolveYear(req));
  sendResponse(res, { message: 'Student analytics', data });
});
