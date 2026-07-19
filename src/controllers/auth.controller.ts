import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '../utils/apiError';

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

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendResponse(res, {
      statusCode: 201,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        token,
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

    if (!email || !password) {
      throw new BadRequestError('Please provide email and password');
    }

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
        token,
      },
    });
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

    // TODO: Send email with reset link (Agent 4 — Communication)
    // const resetUrl = `${env.FRONTEND_URL}/reset-password/${resetToken}`;

    sendResponse(res, {
      message: 'If an account with that email exists, a reset link has been sent',
      data: {
        // Remove in production — for development only
        resetToken,
      },
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

    sendResponse(res, {
      message: 'Password reset successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        token: authToken,
      },
    });
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

    sendResponse(res, {
      message: 'Password changed successfully',
      data: { token },
    });
  }
);
