import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { resolveTenant } from '../middleware/tenant.middleware';
import { getCurrentTenant, updateCurrentTenant } from '../controllers/tenant.controller';

const router = Router();

router.get('/current', resolveTenant, getCurrentTenant);
router.put('/current', protect, authorize('admin'), updateCurrentTenant);

export default router;
