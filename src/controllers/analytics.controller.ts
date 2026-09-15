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
export const getOverview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getOverview(req.tenantId as string);
  sendResponse(res, { message: 'Analytics overview', data });
});

/**
 * @desc    Monthly admissions chart
 * @route   GET /api/analytics/admissions
 * @access  Admin
 */
export const getMonthlyAdmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getMonthlyAdmissions(req.tenantId as string, resolveYear(req));
  sendResponse(res, { message: 'Monthly admissions', data });
});

/**
 * @desc    Monthly revenue chart
 * @route   GET /api/analytics/revenue
 * @access  Admin
 */
export const getMonthlyRevenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getMonthlyRevenue(req.tenantId as string, resolveYear(req));
  sendResponse(res, { message: 'Monthly revenue', data });
});

/**
 * @desc    Revenue breakdown by payment method
 * @route   GET /api/analytics/revenue/payment-methods
 * @access  Admin
 */
export const getRevenueByPaymentMethod = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getRevenueByPaymentMethod(req.tenantId as string, resolveYear(req));
  sendResponse(res, { message: 'Revenue by payment method', data });
});

/**
 * @desc    Lead conversion analytics (overall, by source, monthly trend)
 * @route   GET /api/analytics/leads
 * @access  Admin
 */
export const getLeadAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getLeadAnalytics(req.tenantId as string, resolveYear(req));
  sendResponse(res, { message: 'Lead analytics', data });
});

/**
 * @desc    Course popularity by inquiry count
 * @route   GET /api/analytics/courses
 * @access  Admin
 */
export const getCoursePopularity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getCoursePopularity(req.tenantId as string);
  sendResponse(res, { message: 'Course popularity', data });
});

/**
 * @desc    Student analytics (status/payment/gender breakdown, dues, enrollment trend)
 * @route   GET /api/analytics/students
 * @access  Admin
 */
export const getStudentAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await analyticsService.getStudentAnalytics(req.tenantId as string, resolveYear(req));
  sendResponse(res, { message: 'Student analytics', data });
});
