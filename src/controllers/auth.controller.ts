import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import env from '../config/env';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotificationService } from '../services/notificationService';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../utils/apiError';

const AUTH_COOKIE_NAME = 'token';

const authCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  // Frontend and backend are on different domains in production, so the
  // cookie must be SameSite=None (requires Secure) to be sent on the
  // cross-site fetch/XHR calls the frontend makes. Lax is fine for local
  // dev, where both run on http://localhost.
  sameSite: env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  maxAge: env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
  path: '/',
});

const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    // Only allow student registration from public. Admin accounts are created internally.
    const userRole = role === 'admin' ? 'student' : (role || 'student');

    const user = await User.create({
      email,
      password,
      role: userRole,
    });

    // Generate token
    const token = user.generateAuthToken();
    setAuthCookie(res, token);

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    NotificationService.welcome(user.email, user.email.split('@')[0]).catch((error) => {
      console.error('Failed to send welcome email:', error);
    });

    sendResponse(res, {
      statusCode: 201,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      },
    });
  }
);

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate token
    const token = user.generateAuthToken();
    setAuthCookie(res, token);

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendResponse(res, {
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      },
    });
  }
);

/**
 * @desc    Log out current user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    res.clearCookie(AUTH_COOKIE_NAME, { ...authCookieOptions(), maxAge: undefined });
    sendResponse(res, { message: 'Logged out successfully' });
  }
);

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    sendResponse(res, {
      message: 'User profile fetched',
      data: { user: req.user },
    });
  }
);

/**
 * @desc    Forgot password — send reset email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      sendResponse(res, {
        message: 'If an account with that email exists, a reset link has been sent',
      });
      return;
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${env.FRONTEND_URL}/reset-password/${resetToken}`;

    NotificationService.passwordReset(user.email, resetUrl).catch((error) => {
      console.error('Failed to send password reset email:', error);
    });

    sendResponse(res, {
      message: 'If an account with that email exists, a reset link has been sent',
    });
  }
);

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { password } = req.body;
    const { token } = req.params;

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(String(token))
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Generate new auth token
    const authToken = user.generateAuthToken();
    setAuthCookie(res, authToken);

    sendResponse(res, {
      message: 'Password reset successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      },
    });
  }
);

/**
 * @desc    Verify the current user's password — used as a confirmation
 *          gate in front of destructive admin actions (delete student,
 *          delete course, etc.) without issuing a new session.
 * @route   POST /api/auth/verify-password
 * @access  Private
 */
export const verifyPassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // 403, not 401: the session itself is valid — the frontend's
      // axios interceptor treats any 401 as "session expired" and
      // force-redirects to /login, which would be wrong here.
      throw new ForbiddenError('Incorrect password');
    }

    sendResponse(res, { message: 'Password verified' });
  }
);

/**
 * @desc    Change password (logged-in user)
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new BadRequestError('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    const token = user.generateAuthToken();
    setAuthCookie(res, token);

    sendResponse(res, {
      message: 'Password changed successfully',
    });
  }
);
