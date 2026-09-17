import { Router } from 'express';
import {
  createProposal,
  getProposals,
  getProposal,
  updateProposal,
  sendProposal,
  markProposalViewed,
  respondToProposal,
  getProposalStats,
} from '../controllers/proposal.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// Admin routes (protected)
router.post('/', protect, authorize('admin'), createProposal);
router.get('/', protect, getProposals);
router.get('/stats/dashboard', protect, getProposalStats);
router.get('/:id', protect, getProposal);
router.put('/:id', protect, authorize('admin'), updateProposal);
router.post('/:id/send', protect, authorize('admin'), sendProposal);

// Public routes (for client interaction)
router.post('/:id/view', markProposalViewed);
router.post('/:id/respond', respondToProposal);

export default router;
