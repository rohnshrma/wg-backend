import { Router, Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import Gallery from '../models/Gallery';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';

const router = Router();

// Public
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const category = req.query.category as string;
  const query: Record<string, any> = { isActive: true };
  if (category) query.category = category;

  const images = await Gallery.find(query).sort({ displayOrder: 1, createdAt: -1 });
  sendResponse(res, { message: 'Gallery fetched', data: images });
}));

// Admin — list all, including inactive
router.get('/admin/all', protect, authorize('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const images = await Gallery.find().sort({ displayOrder: 1, createdAt: -1 });
  sendResponse(res, { message: 'Gallery fetched', data: images });
}));

router.post('/', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { images } = req.body; // array of { imageUrl, thumbnailUrl, caption, category }

  if (Array.isArray(images)) {
    const docs = images.map((img: any) => ({ ...img, uploadedBy: req.user!._id }));
    const result = await Gallery.insertMany(docs);
    sendResponse(res, { statusCode: 201, message: 'Images uploaded', data: result });
  } else {
    const image = await Gallery.create({ ...req.body, uploadedBy: req.user!._id });
    sendResponse(res, { statusCode: 201, message: 'Image uploaded', data: image });
  }
}));

router.put('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const image = await Gallery.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!image) throw new NotFoundError('Image not found');
  sendResponse(res, { message: 'Image updated', data: image });
}));

router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const image = await Gallery.findByIdAndDelete(req.params.id);
  if (!image) throw new NotFoundError('Image not found');
  sendResponse(res, { message: 'Image deleted' });
}));

export default router;
