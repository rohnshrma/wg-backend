import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import validate from '../middleware/validate.middleware';
import {
  pauseStudentSchema,
  resumeStudentSchema,
  studentProfileSchema,
} from '../validations/student.validation';
import {
  getAllStudents,
  getStudentById,
  updateStudent,
  updateMyProfile,
  approveStudent,
  rejectStudent,
  pauseStudent,
  resumeStudent,
  deleteStudent,
  getMyDashboard,
} from '../controllers/student.controller';

const router = Router();

// Student self-service
router.get('/me/dashboard', protect, authorize('student'), getMyDashboard);
router.put(
  '/profile',
  protect,
  authorize('student'),
  validate(studentProfileSchema),
  updateMyProfile
);

// Admin routes
router.get('/', protect, authorize('admin'), getAllStudents);
router.get('/:id', protect, authorize('admin', 'student'), getStudentById);
router.put('/:id', protect, updateStudent);
router.patch('/:id/approve', protect, authorize('admin'), approveStudent);
router.patch('/:id/reject', protect, authorize('admin'), rejectStudent);
router.patch(
  '/:id/pause',
  protect,
  authorize('admin'),
  validate(pauseStudentSchema),
  pauseStudent
);
router.patch(
  '/:id/resume',
  protect,
  authorize('admin'),
  validate(resumeStudentSchema),
  resumeStudent
);
router.delete('/:id', protect, authorize('admin'), deleteStudent);

export default router;
