import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import validate from '../middleware/validate.middleware';
import { createMandateSchema } from '../validations/mandate.validation';
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
import { createMandate, getAllMandates, getStudentMandate, cancelMandate } from '../controllers/mandate.controller';

const router = Router();

router.get('/export', protect, authorize('admin'), exportPayments);
router.get('/', protect, authorize('admin'), getAllPayments);
router.get('/student/:id', protect, getStudentPayments);
router.post('/', protect, authorize('admin'), recordPayment);
router.post('/:id/send-receipt', protect, authorize('admin'), sendPaymentReceipt);
router.get('/installments/student/:id', protect, getInstallments);
router.post('/installments/student/:id/generate', protect, authorize('admin'), generateInstallmentPlan);
router.patch('/installments/:id/pay', protect, authorize('admin'), markInstallmentPaid);

// UPI AutoPay e-mandate
router.post('/mandate', protect, authorize('admin'), validate(createMandateSchema), createMandate);
router.get('/mandates', protect, authorize('admin'), getAllMandates);
router.get('/mandate/student/:id', protect, getStudentMandate);
router.patch('/mandate/:id/cancel', protect, authorize('admin'), cancelMandate);

export default router;
