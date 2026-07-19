import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getAllPayments,
  getStudentPayments,
  recordPayment,
  getInstallments,
  markInstallmentPaid,
} from '../controllers/payment.controller';

const router = Router();

router.get('/', protect, authorize('admin'), getAllPayments);
router.get('/student/:id', protect, getStudentPayments);
router.post('/', protect, authorize('admin'), recordPayment);
router.get('/installments/student/:id', protect, getInstallments);
router.patch('/installments/:id/pay', protect, authorize('admin'), markInstallmentPaid);

export default router;
