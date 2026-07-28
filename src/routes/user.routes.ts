import { Router } from 'express';
import {
  getStaffUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
} from '../controllers/user.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import validate from '../middleware/validate.middleware';
import {
  createStaffUserSchema,
  updateStaffUserSchema,
} from '../validations/user.validation';

const router = Router();

router.use(protect, authorize('admin'));

router.route('/').get(getStaffUsers).post(validate(createStaffUserSchema), createStaffUser);

router
  .route('/:id')
  .put(validate(updateStaffUserSchema), updateStaffUser)
  .delete(deleteStaffUser);

export default router;
