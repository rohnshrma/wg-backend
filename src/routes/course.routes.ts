import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getAllCourses,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/course.controller';

const router = Router();

// Public
router.get('/', getAllCourses);
router.get('/:slug', getCourseBySlug);

// Admin
router.post('/', protect, authorize('admin'), createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

export default router;
