import { Router, Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import Blog from '../models/Blog';
import { generateSlug } from '../utils/helpers';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';

const router = Router();

// Public
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 9;
  const category = req.query.category as string;
  const search = req.query.search as string;

  const query: Record<string, any> = { isPublished: true };
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Blog.countDocuments(query);
  const blogs = await Blog.find(query)
    .populate('author', 'email')
    .select('-content')
    .sort({ publishedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  sendResponse(res, {
    message: 'Blogs fetched', data: blogs,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

router.get('/:slug', asyncHandler(async (req: Request, res: Response) => {
  const blog = await Blog.findOneAndUpdate(
    { slug: req.params.slug, isPublished: true },
    { $inc: { viewCount: 1 } },
    { new: true }
  ).populate('author', 'email');

  if (!blog) throw new NotFoundError('Blog not found');
  sendResponse(res, { message: 'Blog fetched', data: blog });
}));

// Admin
router.post('/', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  req.body.slug = generateSlug(req.body.title);
  req.body.author = req.user._id;
  if (req.body.isPublished) req.body.publishedAt = new Date();
  const blog = await Blog.create(req.body);
  sendResponse(res, { statusCode: 201, message: 'Blog created', data: blog });
}));

router.put('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  if (req.body.title) req.body.slug = generateSlug(req.body.title);
  if (req.body.isPublished) req.body.publishedAt = new Date();
  const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!blog) throw new NotFoundError('Blog not found');
  sendResponse(res, { message: 'Blog updated', data: blog });
}));

router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const blog = await Blog.findByIdAndDelete(req.params.id);
  if (!blog) throw new NotFoundError('Blog not found');
  sendResponse(res, { message: 'Blog deleted' });
}));

export default router;
