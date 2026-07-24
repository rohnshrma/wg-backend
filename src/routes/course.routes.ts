import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getAllCourses,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
  getAllCoursesAdmin,
  getCourseByIdAdmin,
} from '../controllers/course.controller';

const router = Router();

// Admin (must come before the public /:slug catch-all)
router.get('/admin/all', protect, authorize('admin'), getAllCoursesAdmin);
router.get('/admin/:id', protect, authorize('admin'), getCourseByIdAdmin);
router.post('/', protect, authorize('admin'), createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

// Public
router.get('/', getAllCourses);
router.get('/:slug', getCourseBySlug);

export default router;
