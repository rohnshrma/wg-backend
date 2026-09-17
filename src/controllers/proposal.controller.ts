import { Request, Response } from 'express';
import Proposal from '../models/Proposal';
import Lead from '../models/Lead';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError, BadRequestError } from '../utils/apiError';
import { getPagination } from '../utils/helpers';

/**
 * @desc    Create a new proposal
 * @route   POST /api/proposals
 * @access  Admin
 */
export const createProposal = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      lead,
      title,
      description,
      clientName,
      clientEmail,
      serviceType,
      scope,
      timeline,
      deliverables,
      technologies,
      pricing,
      validUntil,
      notes,
    } = req.body;

    if (!lead || !title || !clientEmail || !serviceType || !pricing?.total) {
      throw new BadRequestError('Missing required fields');
    }

    const userId = req.user?._id;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    // Generate unique proposal number
    const proposalNumber = `PROP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const proposal = await Proposal.create({
      proposalNumber,
      lead,
      title,
      description,
      clientName,
      clientEmail,
      serviceType,
      scope: scope || [],
      timeline,
      deliverables: deliverables || [],
      technologies: technologies || [],
      pricing,
      validUntil: new Date(validUntil),
      notes,
      createdBy: userId,
      status: 'draft',
    });

    sendResponse(res, {
      statusCode: 201,
      message: 'Proposal created successfully',
      data: proposal,
    });
  }
);

/**
 * @desc    Get all proposals
 * @route   GET /api/proposals
 * @access  Admin
 */
export const getProposals = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { status, lead, page = 1, limit = 10 } = req.query;
    const { skip, limit: queryLimit } = getPagination(Number(page), Number(limit));

    const filter: any = {};
    if (status) filter.status = status;
    if (lead) filter.lead = lead;

    const proposals = await Proposal.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit)
      .populate('lead', 'name email company')
      .populate('createdBy', 'name email');

    const total = await Proposal.countDocuments(filter);

    sendResponse(res, {
      statusCode: 200,
      message: 'Proposals fetched successfully',
      data: proposals,
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
 * @desc    Get single proposal
 * @route   GET /api/proposals/:id
 * @access  Admin
 */
export const getProposal = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const proposal = await Proposal.findById(id)
      .populate('lead')
      .populate('project')
      .populate('createdBy', 'name email');

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    sendResponse(res, {
      statusCode: 200,
      message: 'Proposal fetched successfully',
      data: proposal,
    });
  }
);

/**
 * @desc    Update proposal
 * @route   PUT /api/proposals/:id
 * @access  Admin
 */
export const updateProposal = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { title, description, pricing, timeline, scope, deliverables, notes } = req.body;

    const updates: any = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (pricing) updates.pricing = pricing;
    if (timeline) updates.timeline = timeline;
    if (scope) updates.scope = scope;
    if (deliverables) updates.deliverables = deliverables;
    if (notes) updates.notes = notes;

    const proposal = await Proposal.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    sendResponse(res, {
      statusCode: 200,
      message: 'Proposal updated successfully',
      data: proposal,
    });
  }
);

/**
 * @desc    Send proposal to client
 * @route   POST /api/proposals/:id/send
 * @access  Admin
 */
export const sendProposal = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const proposal = await Proposal.findByIdAndUpdate(
      id,
      {
        status: 'sent',
        sentAt: new Date(),
      },
      { new: true }
    );

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    // Update lead status to proposal_sent
    if (proposal.lead) {
      await Lead.findByIdAndUpdate(proposal.lead, { status: 'proposal_sent' });
    }

    // TODO: Send email to client with proposal link

    sendResponse(res, {
      statusCode: 200,
      message: 'Proposal sent successfully',
      data: proposal,
    });
  }
);

/**
 * @desc    Mark proposal as viewed
 * @route   POST /api/proposals/:id/view
 * @access  Public (for client tracking)
 */
export const markProposalViewed = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const proposal = await Proposal.findByIdAndUpdate(
      id,
      {
        status: 'viewed',
        viewedAt: new Date(),
      },
      { new: true }
    );

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    sendResponse(res, {
      statusCode: 200,
      message: 'Proposal marked as viewed',
      data: proposal,
    });
  }
);

/**
 * @desc    Accept or reject proposal
 * @route   POST /api/proposals/:id/respond
 * @access  Public (for client response)
 */
export const respondToProposal = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { accepted } = req.body;

    if (accepted === undefined) {
      throw new BadRequestError('Acceptance status is required');
    }

    const newStatus = accepted ? 'accepted' : 'rejected';

    const proposal = await Proposal.findByIdAndUpdate(
      id,
      {
        status: newStatus,
        respondedAt: new Date(),
      },
      { new: true }
    );

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    // Update lead status
    if (proposal.lead) {
      const leadStatus = accepted ? 'won' : 'lost';
      await Lead.findByIdAndUpdate(proposal.lead, { status: leadStatus });
    }

    sendResponse(res, {
      statusCode: 200,
      message: `Proposal ${newStatus} successfully`,
      data: proposal,
    });
  }
);

/**
 * @desc    Get proposal statistics
 * @route   GET /api/proposals/stats/dashboard
 * @access  Admin
 */
export const getProposalStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const stats = await Proposal.aggregate([
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
          totalValue: [
            {
              $group: {
                _id: null,
                total: { $sum: '$pricing.total' },
              },
            },
          ],
          acceptanceRate: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                accepted: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
          ],
          avgProposalValue: [
            {
              $group: {
                _id: null,
                avgValue: { $avg: '$pricing.total' },
              },
            },
          ],
        },
      },
    ]);

    sendResponse(res, {
      statusCode: 200,
      message: 'Proposal statistics fetched successfully',
      data: stats[0],
    });
  }
);
