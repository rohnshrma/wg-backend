import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  addMilestone,
  updateMilestone,
  getProjectStats,
} from '../controllers/project.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes with authentication
router.use(protect);

// Project CRUD
router.post('/', authorize('admin'), createProject);
router.get('/', getProjects);
router.get('/stats/dashboard', getProjectStats);
router.get('/:id', getProject);
router.put('/:id', authorize('admin'), updateProject);

// Milestones
router.post('/:id/milestones', authorize('admin'), addMilestone);
router.put('/:id/milestones/:milestoneId', authorize('admin'), updateMilestone);

export default router;
