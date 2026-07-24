import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getOverview,
  getMonthlyAdmissions,
  getMonthlyRevenue,
  getRevenueByPaymentMethod,
  getLeadAnalytics,
  getCoursePopularity,
  getStudentAnalytics,
} from '../controllers/analytics.controller';

const router = Router();

router.use(protect, authorize('admin'));

router.get('/overview', getOverview);
router.get('/admissions', getMonthlyAdmissions);
router.get('/revenue', getMonthlyRevenue);
router.get('/revenue/payment-methods', getRevenueByPaymentMethod);
router.get('/leads', getLeadAnalytics);
router.get('/courses', getCoursePopularity);
router.get('/students', getStudentAnalytics);

export default router;
