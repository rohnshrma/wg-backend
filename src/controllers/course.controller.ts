import { Request, Response } from 'express';
import Course from '../models/Course';
import { generateSlug } from '../utils/helpers';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError, ConflictError } from '../utils/apiError';

/**
 * @desc    Get all courses (public)
 * @route   GET /api/courses
 * @access  Public
 */
export const getAllCourses = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { featured, level, mode, search } = req.query;
    const query: Record<string, any> = { isActive: true };

    if (featured === 'true') query.isFeatured = true;
    if (level) query.level = level;
    if (mode) query.mode = mode;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { technologies: { $regex: search, $options: 'i' } },
      ];
    }

    const courses = await Course.find(query)
      .select('title slug shortDescription thumbnailUrl duration mode level fees isFeatured technologies displayOrder createdAt updatedAt')
      .sort({ displayOrder: 1, createdAt: -1 });

    sendResponse(res, {
      message: 'Courses fetched successfully',
      data: courses,
    });
  }
);

/**
 * @desc    Get course by slug (public)
 * @route   GET /api/courses/:slug
 * @access  Public
 */
export const getCourseBySlug = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const course = await Course.findOne({
      slug: req.params.slug,
      isActive: true,
    });

    if (!course) throw new NotFoundError('Course not found');

    sendResponse(res, { message: 'Course fetched', data: course });
  }
);

/**
 * @desc    Get all courses including inactive, with full fields (admin)
 * @route   GET /api/courses/admin/all
 * @access  Admin
 */
export const getAllCoursesAdmin = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const courses = await Course.find().sort({ displayOrder: 1, createdAt: -1 });

    sendResponse(res, {
      message: 'Courses fetched successfully',
      data: courses,
    });
  }
);

/**
 * @desc    Get single course by id, any status (admin)
 * @route   GET /api/courses/admin/:id
 * @access  Admin
 */
export const getCourseByIdAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const course = await Course.findById(req.params.id);
    if (!course) throw new NotFoundError('Course not found');

    sendResponse(res, { message: 'Course fetched', data: course });
  }
);

/**
 * @desc    Create course
 * @route   POST /api/courses
 * @access  Admin
 */
export const createCourse = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Generate slug from title
    let slug = generateSlug(req.body.title);

    // Ensure slug is unique
    const existing = await Course.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const course = await Course.create({ ...req.body, slug });

    sendResponse(res, {
      statusCode: 201,
      message: 'Course created successfully',
      data: course,
    });
  }
);

/**
 * @desc    Update course
 * @route   PUT /api/courses/:id
 * @access  Admin
 */
export const updateCourse = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // If title changed, regenerate slug
    if (req.body.title) {
      req.body.slug = generateSlug(req.body.title);
      // Check uniqueness
      const existing = await Course.findOne({
        slug: req.body.slug,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        throw new ConflictError('A course with this title already exists');
      }
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!course) throw new NotFoundError('Course not found');

    sendResponse(res, { message: 'Course updated', data: course });
  }
);

/**
 * @desc    Delete (soft-delete) course
 * @route   DELETE /api/courses/:id
 * @access  Admin
 */
export const deleteCourse = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!course) throw new NotFoundError('Course not found');

    sendResponse(res, { message: 'Course deleted' });
  }
);
