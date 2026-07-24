import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getAllPayments,
  exportPayments,
  getStudentPayments,
  recordPayment,
  sendPaymentReceipt,
  getInstallments,
  generateInstallmentPlan,
  markInstallmentPaid,
} from '../controllers/payment.controller';

const router = Router();

router.get('/export', protect, authorize('admin'), exportPayments);
router.get('/', protect, authorize('admin'), getAllPayments);
router.get('/student/:id', protect, getStudentPayments);
router.post('/', protect, authorize('admin'), recordPayment);
router.post('/:id/send-receipt', protect, authorize('admin'), sendPaymentReceipt);
router.get('/installments/student/:id', protect, getInstallments);
router.post('/installments/student/:id/generate', protect, authorize('admin'), generateInstallmentPlan);
router.patch('/installments/:id/pay', protect, authorize('admin'), markInstallmentPaid);

export default router;
