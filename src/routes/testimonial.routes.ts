import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { resolveTenant } from '../middleware/tenant.middleware';
import { Request, Response } from 'express';
import Testimonial from '../models/Testimonial';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';

const router = Router();

// Public
router.get('/', resolveTenant, asyncHandler(async (req: Request, res: Response) => {
  const testimonials = await Testimonial.find({ tenantId: req.tenantId, isActive: true })
    .sort({ displayOrder: 1 });
  sendResponse(res, { message: 'Testimonials fetched', data: testimonials });
}));

// Admin — list all, including inactive
router.get('/admin/all', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const testimonials = await Testimonial.find({ tenantId: req.tenantId }).sort({ displayOrder: 1, createdAt: -1 });
  sendResponse(res, { message: 'Testimonials fetched', data: testimonials });
}));

// Admin CRUD
router.post('/', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const testimonial = await Testimonial.create({ ...req.body, tenantId: req.tenantId });
  sendResponse(res, { statusCode: 201, message: 'Testimonial created', data: testimonial });
}));

router.put('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const testimonial = await Testimonial.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!testimonial) throw new NotFoundError('Testimonial not found');
  sendResponse(res, { message: 'Testimonial updated', data: testimonial });
}));

router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const testimonial = await Testimonial.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
  if (!testimonial) throw new NotFoundError('Testimonial not found');
  sendResponse(res, { message: 'Testimonial deleted' });
}));

export default router;
