import { Request, Response } from 'express';
import User from '../models/User';
import Enquiry from '../models/Enquiry';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/apiError';
import { getPagination } from '../utils/helpers';

/**
 * @desc    List staff accounts (admins + counsellors)
 * @route   GET /api/users
 * @access  Admin
 */
export const getStaffUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit, 50);
    const role = req.query.role as string;

    const query: Record<string, unknown> = {
      role: role && role !== 'all' ? role : { $in: ['admin', 'counsellor'] },
    };

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('email name role isActive lastLogin createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    sendResponse(res, {
      message: 'Users fetched successfully',
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
);

/**
 * @desc    Create a staff account (counsellor or admin)
 * @route   POST /api/users
 * @access  Admin
 */
export const createStaffUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, name, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const user = await User.create({
      email,
      password,
      name,
      role,
      isEmailVerified: true,
    });

    sendResponse(res, {
      statusCode: 201,
      message: `${role === 'admin' ? 'Admin' : 'Counsellor'} created successfully`,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    });
  }
);

/**
 * @desc    Update a staff account (name, role, active status, password)
 * @route   PUT /api/users/:id
 * @access  Admin
 */
export const updateStaffUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError('User not found');

    if (user.role === 'student') {
      throw new BadRequestError('Student accounts are managed from the Students section');
    }

    const { name, role, isActive, password } = req.body;

    // Refuse to strip the last admin of its role or deactivate it — otherwise
    // the panel can be locked out entirely with no way back in.
    const isSelfDemotion =
      user.role === 'admin' && (role === 'counsellor' || isActive === false);
    if (isSelfDemotion) {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        throw new BadRequestError('Cannot demote or deactivate the last active admin');
      }
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    // Assigning triggers the model's pre-save hash hook.
    if (password) user.password = password;

    await user.save();

    sendResponse(res, {
      message: 'User updated successfully',
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    });
  }
);

/**
 * @desc    Delete a staff account
 * @route   DELETE /api/users/:id
 * @access  Admin
 */
export const deleteStaffUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError('User not found');

    if (user.role === 'student') {
      throw new BadRequestError('Student accounts are managed from the Students section');
    }

    if (String(user._id) === String(req.user!._id)) {
      throw new BadRequestError('You cannot delete your own account');
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        throw new BadRequestError('Cannot delete the last active admin');
      }
    }

    // Enquiries outlive the counsellor who owned them — reassign rather than
    // orphan them (owner is a required field, so they'd fail validation later).
    await Enquiry.updateMany({ owner: user._id }, { $set: { owner: req.user!._id } });

    await user.deleteOne();

    sendResponse(res, { message: 'User deleted successfully' });
  }
);
