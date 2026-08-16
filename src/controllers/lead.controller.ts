import { Request, Response } from 'express';
import Lead from '../models/Lead';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotificationService } from '../services/notificationService';
import { notifyAdmins } from '../utils/notifyAdmins';
import { BadRequestError, NotFoundError } from '../utils/apiError';
import { getPagination } from '../utils/helpers';

/**
 * @desc    Submit an inquiry (public)
 * @route   POST /api/leads
 * @access  Public
 */
export const submitInquiry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { name, phone, email, courseInterested, projectType, budget, timeline, company, website, message, source } =
      req.body;

    // A lead needs at least one "what are they interested in" signal — either
    // the institute's courseInterested or the agency's projectType.
    const interest = courseInterested || projectType;
    if (!name || !phone || !email || !interest) {
      throw new BadRequestError('Name, phone, email, and course/project type are required');
    }

    const lead = await Lead.create({
      name,
      phone,
      email,
      courseInterested,
      projectType,
      budget,
      timeline,
      company,
      website,
      message,
      source: source || 'hero_form',
    });

    NotificationService.newLead(name, phone, email, interest, lead.source).catch((error) => {
      console.error('Failed to send new-lead notification:', error);
    });
    notifyAdmins('New Inquiry 🔔', `${name} enquired about ${interest}.`, '/admin/leads').catch((error) => {
      console.error('Failed to create admin notification for new lead:', error);
    });

    sendResponse(res, {
      statusCode: 201,
      message: 'Inquiry submitted successfully! We will contact you shortly.',
      data: { id: lead._id },
    });
  }
);

/**
 * @desc    Get all leads (paginated)
 * @route   GET /api/leads
 * @access  Admin
 */
export const getAllLeads = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit, 10);
    const status = req.query.status as string;
    const source = req.query.source as string;
    const search = req.query.search as string;

    const query: Record<string, any> = {};
    if (status) query.status = status;
    if (source) query.source = source;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Lead.countDocuments(query);
    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    sendResponse(res, {
      message: 'Leads fetched successfully',
      data: leads,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
);

/**
 * @desc    Get lead by ID
 * @route   GET /api/leads/:id
 * @access  Admin
 */
export const getLeadById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'email')
      .populate('notes.addedBy', 'email');

    if (!lead) throw new NotFoundError('Lead not found');

    sendResponse(res, { message: 'Lead fetched', data: lead });
  }
);

/**
 * @desc    Update lead
 * @route   PUT /api/leads/:id
 * @access  Admin
 */
export const updateLead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!lead) throw new NotFoundError('Lead not found');

    sendResponse(res, { message: 'Lead updated', data: lead });
  }
);

/**
 * @desc    Add note to lead
 * @route   POST /api/leads/:id/notes
 * @access  Admin
 */
export const addNote = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { text } = req.body;
    if (!text) throw new BadRequestError('Note text is required');

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: { text, addedBy: req.user!._id, addedAt: new Date() },
        },
      },
      { new: true }
    );

    if (!lead) throw new NotFoundError('Lead not found');

    sendResponse(res, { message: 'Note added', data: lead });
  }
);

/**
 * @desc    Convert lead to student (mark as converted)
 * @route   PATCH /api/leads/:id/convert
 * @access  Admin
 */
export const convertLead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new NotFoundError('Lead not found');

    if (lead.status === 'converted') {
      throw new BadRequestError('Lead is already converted');
    }

    lead.status = 'converted';
    lead.convertedAt = new Date();
    if (req.body.studentId) {
      lead.convertedToStudent = req.body.studentId;
    }
    await lead.save();

    sendResponse(res, { message: 'Lead converted', data: lead });
  }
);
