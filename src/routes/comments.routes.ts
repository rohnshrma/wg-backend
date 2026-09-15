import { Router, Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { resolveTenant } from '../middleware/tenant.middleware';
import Comment from '../models/Comment';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';

const router = Router();

// Public — get approved comments for a blog
router.get('/blog/:blogId', resolveTenant, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const comments = await Comment.find({
    tenantId: req.tenantId,
    blog: req.params.blogId,
    isApproved: true,
  })
    .sort({ createdAt: -1 })
    .select('-email');

  const count = comments.length;

  sendResponse(res, {
    message: 'Comments fetched',
    data: comments,
    meta: { total: count },
  });
}));

// Public — post a comment
router.post('/', resolveTenant, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { blog, author, email, content } = req.body;

  if (!blog || !author || !email || !content) {
    res.status(422).json({
      success: false,
      message: 'Missing required fields: blog, author, email, content',
    });
    return;
  }

  const comment = await Comment.create({
    tenantId: req.tenantId,
    blog,
    author,
    email,
    content,
    isApproved: false,
  });

  sendResponse(res, {
    statusCode: 201,
    message: 'Comment submitted for review',
    data: comment,
  });
}));

// Admin — get all comments (including unapproved)
router.get('/admin/all', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = ((Number(page) - 1) * Number(limit)) || 0;

  const comments = await Comment.find({ tenantId: req.tenantId })
    .populate('blog', 'title slug')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Comment.countDocuments({ tenantId: req.tenantId });

  sendResponse(res, {
    message: 'Comments fetched',
    data: comments,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
}));

// Admin — approve comment
router.put('/:id/approve', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const comment = await Comment.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { isApproved: true },
    { new: true }
  );
  if (!comment) throw new NotFoundError('Comment not found');
  sendResponse(res, { message: 'Comment approved', data: comment });
}));

// Admin — delete comment
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const comment = await Comment.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
  if (!comment) throw new NotFoundError('Comment not found');
  sendResponse(res, { message: 'Comment deleted' });
}));

export default router;
