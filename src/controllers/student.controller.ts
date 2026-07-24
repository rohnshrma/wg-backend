import { Request, Response, NextFunction } from 'express';
import Student from '../models/Student';
import User from '../models/User';
import Counter from '../models/Counter';
import Notification from '../models/Notification';
import Course from '../models/Course';
import Payment from '../models/Payment';
import Installment from '../models/Installment';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotificationService } from '../services/notificationService';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../utils/apiError';

/**
 * @desc    Get all students (paginated)
 * @route   GET /api/students
 * @access  Admin
 */
export const getAllStudents = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const courseId = req.query.courseId as string;

    const query: Record<string, any> = {};

    if (status) query.status = status;
    if (courseId) query.courseId = courseId;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { admissionId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .populate('courseId', 'title slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendResponse(res, {
      message: 'Students fetched successfully',
      data: students,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

/**
 * @desc    Get student by ID
 * @route   GET /api/students/:id
 * @access  Admin or Self
 */
export const getStudentById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const student = await Student.findById(req.params.id)
      .populate('courseId')
      .populate('approvedBy', 'email');

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    // Students can only view their own profile
    if (
      req.user.role === 'student' &&
      student.userId.toString() !== req.user._id.toString()
    ) {
      throw new ForbiddenError('You can only view your own profile');
    }

    sendResponse(res, {
      message: 'Student fetched successfully',
      data: student,
    });
  }
);

/**
 * @desc    Update own student profile (or create student record)
 * @route   PUT /api/students/profile
 * @access  Private (student)
 */
export const updateMyProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    let student = await Student.findOne({ userId: req.user._id });
    const course = req.body.courseId ? await Course.findById(req.body.courseId) : null;
    const fullName =
      req.body.fullName ||
      [req.body.firstName, req.body.lastName].filter(Boolean).join(' ').trim() ||
      req.body.name ||
      req.user.email?.split('@')[0] ||
      'Student';

    const profilePayload = {
      fullName,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      photoUrl: req.body.photoUrl || '',
      aadhaarUrl: req.body.aadhaarUrl || '',
      fatherName: req.body.fatherName || req.body.parentName || '',
      motherName: req.body.motherName || '',
      parentContactNumber: req.body.parentContactNumber || req.body.parentPhone || '',
      studentContactNumber: req.body.studentContactNumber || req.body.phone || '',
      email: req.body.email || req.user.email,
      address: {
        street: req.body.address?.street || req.body.address || '',
        city: req.body.address?.city || req.body.city || '',
        state: req.body.address?.state || req.body.state || '',
        pincode: req.body.address?.pincode || req.body.pincode || '',
      },
      qualification: req.body.qualification || '',
      courseId: req.body.courseId || undefined,
      courseFees: req.body.courseFees ?? course?.fees ?? 0,
      joiningDate: req.body.joiningDate || new Date(),
      paymentMode: req.body.paymentMode || 'emi',
    };

    if (!student) {
      student = await Student.create({
        userId: req.user._id,
        ...profilePayload,
      });
    } else {
      if (student.isProfileLocked) {
        throw new ForbiddenError(
          'Your profile is locked after approval. Contact admin for changes.'
        );
      }

      student = await Student.findByIdAndUpdate(
        student._id,
        { $set: profilePayload },
        { new: true, runValidators: true }
      );
    }

    sendResponse(res, {
      message: 'Profile updated successfully',
      data: student,
    });
  }
);

/**
 * @desc    Update student profile
 * @route   PUT /api/students/:id
 * @access  Admin or Self (before approval)
 */
export const updateStudent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const student = await Student.findById(req.params.id);

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    // Check if student is trying to edit after approval
    if (req.user.role === 'student') {
      if (student.userId.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You can only edit your own profile');
      }
      if (student.isProfileLocked) {
        throw new ForbiddenError(
          'Your profile is locked after approval. Contact admin for changes.'
        );
      }
    }

    // If admin updates, notify student
    const isAdminUpdate = req.user.role === 'admin';

    // Update fields
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    // Notify student if admin made the update
    if (isAdminUpdate && student.userId) {
      await Notification.create({
        recipientId: student.userId,
        title: 'Profile Updated',
        message: 'Your profile has been updated by the admin.',
        type: 'profile_update',
        link: '/dashboard/profile',
      });
    }

    sendResponse(res, {
      message: 'Student updated successfully',
      data: updatedStudent,
    });
  }
);

/**
 * @desc    Approve student registration
 * @route   PATCH /api/students/:id/approve
 * @access  Admin
 */
export const approveStudent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const student = await Student.findById(req.params.id).populate('courseId', 'title');

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    if (student.status === 'approved') {
      throw new BadRequestError('Student is already approved');
    }

    // Generate admission ID atomically
    const admissionId = await (Counter as any).getNextAdmissionId();

    // Update student
    student.status = 'approved';
    student.admissionId = admissionId;
    student.approvedBy = req.user._id;
    student.approvedAt = new Date();
    student.isProfileLocked = true;
    await student.save();

    // Create notification
    await Notification.create({
      recipientId: student.userId,
      title: 'Registration Approved! 🎉',
      message: `Congratulations! Your registration has been approved. Your Admission ID is ${admissionId}.`,
      type: 'approval',
      link: '/dashboard',
    });

    try {
      const courseName = (student.courseId as any)?.title || 'your course';
      await NotificationService.admissionApproved(
        student.email,
        student.studentContactNumber,
        student.fullName,
        admissionId,
        courseName
      );
    } catch (error) {
      console.error('Failed to send admission-approved notification:', error);
    }

    sendResponse(res, {
      message: 'Student approved successfully',
      data: {
        student,
        admissionId,
      },
    });
  }
);

/**
 * @desc    Reject student registration
 * @route   PATCH /api/students/:id/reject
 * @access  Admin
 */
export const rejectStudent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { reason } = req.body;

    if (!reason) {
      throw new BadRequestError('Rejection reason is required');
    }

    const student = await Student.findById(req.params.id);

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    student.status = 'rejected';
    student.rejectionReason = reason;
    await student.save();

    // Create notification
    await Notification.create({
      recipientId: student.userId,
      title: 'Registration Update',
      message: `Your registration was not approved. Reason: ${reason}. Please contact support for assistance.`,
      type: 'rejection',
      link: '/dashboard/profile',
    });

    try {
      await NotificationService.admissionRejected(
        student.email,
        student.studentContactNumber,
        student.fullName,
        reason
      );
    } catch (error) {
      console.error('Failed to send admission-rejected notification:', error);
    }

    sendResponse(res, {
      message: 'Student rejected',
      data: student,
    });
  }
);

/**
 * @desc    Permanently delete a student's admission record, along with
 *          their payments, installments, notifications, and login account.
 * @route   DELETE /api/students/:id
 * @access  Admin
 */
export const deleteStudent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const student = await Student.findById(req.params.id);
    if (!student) {
      throw new NotFoundError('Student not found');
    }

    await Promise.all([
      Payment.deleteMany({ studentId: student._id }),
      Installment.deleteMany({ studentId: student._id }),
      Notification.deleteMany({ recipientId: student.userId }),
      User.deleteOne({ _id: student.userId }),
    ]);

    await student.deleteOne();

    sendResponse(res, { message: 'Student deleted successfully' });
  }
);

/**
 * @desc    Get student dashboard data
 * @route   GET /api/students/me/dashboard
 * @access  Student
 */
export const getMyDashboard = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const student = await Student.findOne({ userId: req.user._id })
      .populate('courseId');

    if (!student) {
      sendResponse(res, {
        message: 'Student profile not found',
        data: {
          student: null,
          unreadNotifications: 0,
        },
      });
      return;
    }

    // Get unread notifications count
    const unreadNotifications = await Notification.countDocuments({
      recipientId: req.user._id,
      isRead: false,
    });

    sendResponse(res, {
      message: 'Dashboard data fetched',
      data: {
        student,
        unreadNotifications,
      },
    });
  }
);
