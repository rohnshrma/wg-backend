import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyPassword,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';
import validate from '../middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyPasswordSchema,
} from '../validations/auth.validation';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', protect, logout);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
router.post(
  '/reset-password/:token',
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword
);
router.get('/me', protect, getMe);
router.put(
  '/change-password',
  protect,
  authLimiter,
  validate(changePasswordSchema),
  changePassword
);
router.post(
  '/verify-password',
  protect,
  authLimiter,
  validate(verifyPasswordSchema),
  verifyPassword
);

export default router;
