import { Router, Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import Blog from '../models/Blog';
import { generateUniqueSlug, getPagination } from '../utils/helpers';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';

const router = Router();

// Public
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit, 9);
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
    .skip(skip)
    .limit(limit);

  sendResponse(res, {
    message: 'Blogs fetched', data: blogs,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

// Admin — list all (including unpublished drafts)
router.get('/admin/all', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit, 50);
  const search = req.query.search as string;

  const query: Record<string, any> = {};
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Blog.countDocuments(query);
  const blogs = await Blog.find(query)
    .populate('author', 'email')
    .select('-content')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, {
    message: 'Blogs fetched', data: blogs,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

// Admin — fetch single blog by id (any status, full content) for editing
router.get('/admin/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const blog = await Blog.findById(req.params.id).populate('author', 'email').populate('relatedPosts', 'title slug _id');
  if (!blog) throw new NotFoundError('Blog not found');
  sendResponse(res, { message: 'Blog fetched', data: blog });
}));

router.get('/:slug', asyncHandler(async (req: Request, res: Response) => {
  const blog = await Blog.findOneAndUpdate(
    { slug: req.params.slug, isPublished: true },
    { $inc: { viewCount: 1 } },
    { new: true }
  ).populate('author', 'email').populate('relatedPosts', 'title slug category');

  if (!blog) throw new NotFoundError('Blog not found');
  sendResponse(res, { message: 'Blog fetched', data: blog });
}));

// Admin
router.post('/', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  // Only derive a slug once we know there is a title to derive it from —
  // otherwise let mongoose raise a proper 422 for the missing field.
  if (typeof req.body.title === 'string' && req.body.title.trim()) {
    req.body.slug = await generateUniqueSlug(Blog, req.body.title);
  }
  req.body.author = req.user!._id;
  if (req.body.isPublished) req.body.publishedAt = new Date();
  const blog = await Blog.create(req.body);
  sendResponse(res, { statusCode: 201, message: 'Blog created', data: blog });
}));

router.put('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const existing = await Blog.findById(req.params.id);
  if (!existing) throw new NotFoundError('Blog not found');

  if (typeof req.body.title === 'string' && req.body.title.trim()) {
    req.body.slug = await generateUniqueSlug(Blog, req.body.title, String(req.params.id));
  }
  // Stamp publishedAt only on the first transition to published, so editing an
  // already-published post doesn't reset its publish date (which would also
  // re-sort it to the top of the public blog list).
  if (req.body.isPublished && !existing.publishedAt) {
    req.body.publishedAt = new Date();
  }

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
