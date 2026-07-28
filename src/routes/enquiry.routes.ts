import { Router } from 'express';
import {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiry,
  moveEnquiryStage,
  deleteEnquiry,
  getEnquiryStats,
} from '../controllers/enquiry.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import validate from '../middleware/validate.middleware';
import {
  createEnquirySchema,
  updateEnquirySchema,
  moveStageSchema,
} from '../validations/enquiry.validation';

const router = Router();

// Every CRM route requires a logged-in admin or counsellor.
router.use(protect, authorize('admin', 'counsellor'));

router.get('/stats', getEnquiryStats);

router
  .route('/')
  .get(getEnquiries)
  .post(validate(createEnquirySchema), createEnquiry);

router
  .route('/:id')
  .get(getEnquiryById)
  .put(validate(updateEnquirySchema), updateEnquiry)
  .delete(authorize('admin'), deleteEnquiry);

router.patch('/:id/stage', validate(moveStageSchema), moveEnquiryStage);

export default router;
