import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { inquiryLimiter } from '../middleware/rateLimiter';
import {
  submitInquiry,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  addNote,
  convertLead,
} from '../controllers/lead.controller';

const router = Router();

// Public
router.post('/', inquiryLimiter, submitInquiry);

// Admin
router.get('/', protect, authorize('admin'), getAllLeads);
router.get('/:id', protect, authorize('admin'), getLeadById);
router.put('/:id', protect, authorize('admin'), updateLead);
router.delete('/:id', protect, authorize('admin'), deleteLead);
router.post('/:id/notes', protect, authorize('admin'), addNote);
router.patch('/:id/convert', protect, authorize('admin'), convertLead);

export default router;
