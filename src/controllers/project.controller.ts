import { Request, Response } from 'express';
import Project from '../models/Project';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError, BadRequestError } from '../utils/apiError';
import { getPagination } from '../utils/helpers';

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Admin
 */
export const createProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      description,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      serviceType,
      budget,
      budgetCurrency,
      startDate,
      endDate,
      expectedDelivery,
      technologies,
      teamMembers,
    } = req.body;

    if (!name || !clientName || !clientEmail || !serviceType || !budget) {
      throw new BadRequestError('Missing required fields');
    }

    const projectManager = req.user?._id;
    if (!projectManager) {
      throw new BadRequestError('User ID is required');
    }

    const project = await Project.create({
      name,
      description,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      serviceType,
      budget,
      budgetCurrency: budgetCurrency || 'USD',
      startDate,
      endDate,
      expectedDelivery,
      technologies: technologies || [],
      teamMembers: teamMembers || [],
      projectManager,
    });

    sendResponse(res, {
      statusCode: 201,
      message: 'Project created successfully',
      data: project,
    });
  }
);

/**
 * @desc    Get all projects
 * @route   GET /api/projects
 * @access  Admin
 */
export const getProjects = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { status, serviceType, page = 1, limit = 10 } = req.query;
    const { skip, limit: queryLimit } = getPagination(Number(page), Number(limit));

    const filter: any = {};
    if (status) filter.status = status;
    if (serviceType) filter.serviceType = serviceType;

    const projects = await Project.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit)
      .populate('projectManager', 'name email')
      .populate('teamMembers', 'name email');

    const total = await Project.countDocuments(filter);

    sendResponse(res, {
      statusCode: 200,
      message: 'Projects fetched successfully',
      data: projects,
      meta: {
        total,
        page: Number(page),
        limit: queryLimit,
        totalPages: Math.ceil(total / queryLimit),
      },
    });
  }
);

/**
 * @desc    Get single project
 * @route   GET /api/projects/:id
 * @access  Admin
 */
export const getProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate('projectManager', 'name email')
      .populate('teamMembers', 'name email')
      .populate('relatedLead');

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    sendResponse(res, {
      statusCode: 200,
      message: 'Project fetched successfully',
      data: project,
    });
  }
);

/**
 * @desc    Update project
 * @route   PUT /api/projects/:id
 * @access  Admin
 */
export const updateProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status, budget, budgetStatus, teamMembers, startDate, endDate, expectedDelivery, notes } = req.body;

    const updates: any = {};
    if (status) updates.status = status;
    if (budget !== undefined) updates.budget = budget;
    if (budgetStatus) updates.budgetStatus = budgetStatus;
    if (teamMembers) updates.teamMembers = teamMembers;
    if (startDate) updates.startDate = startDate;
    if (endDate) updates.endDate = endDate;
    if (expectedDelivery) updates.expectedDelivery = expectedDelivery;
    if (notes) updates.notes = notes;

    const project = await Project.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    sendResponse(res, {
      statusCode: 200,
      message: 'Project updated successfully',
      data: project,
    });
  }
);

/**
 * @desc    Add project milestone
 * @route   POST /api/projects/:id/milestones
 * @access  Admin
 */
export const addMilestone = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;

    if (!title || !dueDate) {
      throw new BadRequestError('Title and due date are required');
    }

    const project = await Project.findByIdAndUpdate(
      id,
      {
        $push: {
          milestones: {
            title,
            description,
            dueDate,
            status: 'pending',
          },
        },
      },
      { new: true }
    );

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    sendResponse(res, {
      statusCode: 200,
      message: 'Milestone added successfully',
      data: project,
    });
  }
);

/**
 * @desc    Update milestone status
 * @route   PUT /api/projects/:id/milestones/:milestoneId
 * @access  Admin
 */
export const updateMilestone = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id, milestoneId } = req.params;
    const { status, completedDate } = req.body;

    if (!status) {
      throw new BadRequestError('Status is required');
    }

    const updates: any = {};
    if (status) updates['milestones.$.status'] = status;
    if (status === 'completed' && !completedDate) {
      updates['milestones.$.completedDate'] = new Date();
    } else if (completedDate) {
      updates['milestones.$.completedDate'] = completedDate;
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, 'milestones._id': milestoneId },
      { $set: updates },
      { new: true }
    );

    if (!project) {
      throw new NotFoundError('Project or milestone not found');
    }

    sendResponse(res, {
      statusCode: 200,
      message: 'Milestone updated successfully',
      data: project,
    });
  }
);

/**
 * @desc    Get project statistics
 * @route   GET /api/projects/stats/dashboard
 * @access  Admin
 */
export const getProjectStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const stats = await Project.aggregate([
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          byServiceType: [
            {
              $group: {
                _id: '$serviceType',
                count: { $sum: 1 },
              },
            },
          ],
          totalRevenue: [
            {
              $group: {
                _id: null,
                total: { $sum: '$budget' },
              },
            },
          ],
          avgProjectValue: [
            {
              $group: {
                _id: null,
                avgBudget: { $avg: '$budget' },
              },
            },
          ],
        },
      },
    ]);

    sendResponse(res, {
      statusCode: 200,
      message: 'Project statistics fetched successfully',
      data: stats[0],
    });
  }
);
