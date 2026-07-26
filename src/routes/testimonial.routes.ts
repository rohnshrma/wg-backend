import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { Request, Response } from 'express';
import Testimonial from '../models/Testimonial';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';

const router = Router();

// Public
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const testimonials = await Testimonial.find({ isActive: true })
    .sort({ displayOrder: 1 });
  sendResponse(res, { message: 'Testimonials fetched', data: testimonials });
}));

// Admin — list all, including inactive
router.get('/admin/all', protect, authorize('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const testimonials = await Testimonial.find().sort({ displayOrder: 1, createdAt: -1 });
  sendResponse(res, { message: 'Testimonials fetched', data: testimonials });
}));

// Admin CRUD
router.post('/', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const testimonial = await Testimonial.create(req.body);
  sendResponse(res, { statusCode: 201, message: 'Testimonial created', data: testimonial });
}));

router.put('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!testimonial) throw new NotFoundError('Testimonial not found');
  sendResponse(res, { message: 'Testimonial updated', data: testimonial });
}));

router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
  if (!testimonial) throw new NotFoundError('Testimonial not found');
  sendResponse(res, { message: 'Testimonial deleted' });
}));

export default router;
