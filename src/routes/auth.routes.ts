import { Router } from 'express';
import passport from 'passport';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyPassword,
  googleCallback,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { resolveTenant } from '../middleware/tenant.middleware';
import { authLimiter } from '../middleware/rateLimiter';
import validate from '../middleware/validate.middleware';
import env from '../config/env';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyPasswordSchema,
} from '../validations/auth.validation';

const router = Router();

router.post('/register', authLimiter, resolveTenant, validate(registerSchema), register);
router.post('/login', authLimiter, resolveTenant, validate(loginSchema), login);
router.get(
  '/google',
  resolveTenant,
  // Google's OAuth redirect round-trip can't carry req.tenantId through as
  // Express state, so it's smuggled in the `state` param and read back out
  // in the callback below.
  (req, res, next) =>
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state: req.tenantId,
    })(req, res, next)
);
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=google` }),
  googleCallback
);
router.post('/logout', protect, logout);
router.post(
  '/forgot-password',
  authLimiter,
  resolveTenant,
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
