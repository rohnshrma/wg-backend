import { Router, Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import Notification from '../models/Notification';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';
import { getPagination } from '../utils/helpers';

const router = Router();

// Get my notifications
router.get('/', protect, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit, 20);

  const query = { recipientId: req.user!._id };
  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const unreadCount = await Notification.countDocuments({
    ...query,
    isRead: false,
  });

  sendResponse(res, {
    message: 'Notifications fetched',
    data: { notifications, unreadCount },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}));

// Mark as read (only the recipient may mark their own notification)
router.patch('/:id/read', protect, asyncHandler(async (req: Request, res: Response) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user!._id },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw new NotFoundError('Notification not found');
  sendResponse(res, { message: 'Notification marked as read' });
}));

// Mark all as read
router.patch('/read-all', protect, asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany(
    { recipientId: req.user!._id, isRead: false },
    { isRead: true }
  );
  sendResponse(res, { message: 'All notifications marked as read' });
}));

// Admin: send notification to a student
router.post('/', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { recipientId, title, message, type, link } = req.body;
  const notification = await Notification.create({
    recipientId,
    title,
    message,
    type: type || 'general',
    link,
  });
  sendResponse(res, { statusCode: 201, message: 'Notification sent', data: notification });
}));

// Admin: broadcast notification to all students
router.post('/broadcast', protect, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { title, message, type } = req.body;
  const User = (await import('../models/User')).default;
  const students = await User.find({ role: 'student', isActive: true }).select('_id');
  
  const notifications = students.map(s => ({
    recipientId: s._id,
    title,
    message,
    type: type || 'general',
  }));

  await Notification.insertMany(notifications);
  sendResponse(res, { statusCode: 201, message: `Notification sent to ${students.length} students` });
}));

export default router;
