import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Enquiry, { ENQUIRY_STAGES, EnquiryStage } from '../models/Enquiry';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/apiError';
import { getPagination } from '../utils/helpers';

/**
 * Counsellors only ever see and touch their own enquiries; admins see everything.
 * Every read/write path funnels through this so the rule can't drift between routes.
 */
const scopeToUser = (req: Request): Record<string, unknown> =>
  req.user!.role === 'admin' ? {} : { owner: req.user!._id };

const assertCanMutate = (req: Request, enquiry: { owner: mongoose.Types.ObjectId }): void => {
  if (req.user!.role === 'admin') return;
  if (String(enquiry.owner) !== String(req.user!._id)) {
    throw new ForbiddenError('You can only modify enquiries assigned to you');
  }
};

const POPULATE = [
  { path: 'owner', select: 'email name role' },
  { path: 'createdBy', select: 'email name role' },
  { path: 'stageHistory.changedBy', select: 'email name role' },
];

/**
 * @desc    Create an enquiry — always starts in the "new_enquiry" stage
 * @route   POST /api/enquiries
 * @access  Admin, Counsellor
 */
export const createEnquiry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { owner, enquiryDate, ...rest } = req.body;

    // Only admins may hand an enquiry to someone else; a counsellor always owns
    // what they create.
    const ownerId = req.user!.role === 'admin' && owner ? owner : req.user!._id;

    const duplicate = await Enquiry.findOne({
      mobile: rest.mobile,
      stage: { $nin: ['admitted', 'cancelled'] },
    });
    if (duplicate) {
      throw new BadRequestError(
        'An active enquiry with this mobile number already exists'
      );
    }

    const enquiry = await Enquiry.create({
      ...rest,
      owner: ownerId,
      createdBy: req.user!._id,
      enquiryDate: enquiryDate || new Date(),
      stage: 'new_enquiry',
      stageHistory: [
        {
          fromStage: null,
          toStage: 'new_enquiry',
          changedBy: req.user!._id,
          changedAt: new Date(),
          note: 'Enquiry created',
        },
      ],
    });

    await enquiry.populate(POPULATE);

    sendResponse(res, {
      statusCode: 201,
      message: 'Enquiry created successfully',
      data: enquiry,
    });
  }
);

/**
 * @desc    List enquiries with search + filters (paginated)
 * @route   GET /api/enquiries
 * @access  Admin, Counsellor
 */
export const getEnquiries = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit, 50);
    const { search, stage, source, course, owner, dateFrom, dateTo } = req.query as Record<
      string,
      string
    >;

    const query: Record<string, any> = { ...scopeToUser(req) };

    if (stage) query.stage = stage;
    if (source) query.source = source;
    if (course) query.course = { $regex: course, $options: 'i' };
    // Admins can narrow the board to a single counsellor; for a counsellor this
    // is a no-op because scopeToUser already pinned `owner` to them.
    if (owner && req.user!.role === 'admin') query.owner = owner;

    if (dateFrom || dateTo) {
      query.enquiryDate = {};
      if (dateFrom) query.enquiryDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.enquiryDate.$lte = end;
      }
    }

    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ name: rx }, { mobile: rx }, { course: rx }];
    }

    const total = await Enquiry.countDocuments(query);
    const enquiries = await Enquiry.find(query)
      .populate(POPULATE)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    sendResponse(res, {
      message: 'Enquiries fetched successfully',
      data: enquiries,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
);

/**
 * @desc    Get a single enquiry with its full stage timeline
 * @route   GET /api/enquiries/:id
 * @access  Admin, Counsellor (own)
 */
export const getEnquiryById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const enquiry = await Enquiry.findOne({
      _id: req.params.id,
      ...scopeToUser(req),
    }).populate(POPULATE);

    if (!enquiry) throw new NotFoundError('Enquiry not found');

    sendResponse(res, { message: 'Enquiry fetched', data: enquiry });
  }
);

/**
 * @desc    Update an enquiry's details
 * @route   PUT /api/enquiries/:id
 * @access  Admin, Counsellor (own)
 */
export const updateEnquiry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) throw new NotFoundError('Enquiry not found');
    assertCanMutate(req, enquiry);

    const { stage, owner, ...rest } = req.body;

    // Reassignment is an admin-only action.
    if (owner && req.user!.role === 'admin') enquiry.owner = owner;

    Object.assign(enquiry, rest);

    // A stage change coming through the edit form still has to be journalled,
    // exactly as a drag on the board would be.
    if (stage && stage !== enquiry.stage) {
      enquiry.stageHistory.push({
        fromStage: enquiry.stage,
        toStage: stage as EnquiryStage,
        changedBy: req.user!._id as mongoose.Types.ObjectId,
        changedAt: new Date(),
        note: 'Updated via edit form',
      });
      enquiry.stage = stage;
    }

    await enquiry.save();
    await enquiry.populate(POPULATE);

    sendResponse(res, { message: 'Enquiry updated', data: enquiry });
  }
);

/**
 * @desc    Move an enquiry to a new stage (drag-and-drop on the pipeline)
 * @route   PATCH /api/enquiries/:id/stage
 * @access  Admin, Counsellor (own)
 */
export const moveEnquiryStage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { stage, note } = req.body;

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) throw new NotFoundError('Enquiry not found');
    assertCanMutate(req, enquiry);

    if (enquiry.stage === stage) {
      await enquiry.populate(POPULATE);
      sendResponse(res, { message: 'Enquiry already in this stage', data: enquiry });
      return;
    }

    enquiry.stageHistory.push({
      fromStage: enquiry.stage,
      toStage: stage,
      changedBy: req.user!._id as mongoose.Types.ObjectId,
      changedAt: new Date(),
      note: note || undefined,
    });
    enquiry.stage = stage;

    await enquiry.save();
    await enquiry.populate(POPULATE);

    sendResponse(res, { message: 'Stage updated', data: enquiry });
  }
);

/**
 * @desc    Delete an enquiry
 * @route   DELETE /api/enquiries/:id
 * @access  Admin only
 */
export const deleteEnquiry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) throw new NotFoundError('Enquiry not found');

    sendResponse(res, { message: 'Enquiry deleted' });
  }
);

/**
 * @desc    CRM dashboard stats — counts per stage, today's enquiries,
 *          conversion rate and source breakdown
 * @route   GET /api/enquiries/stats
 * @access  Admin, Counsellor
 */
export const getEnquiryStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const scope = scopeToUser(req);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [byStageRaw, bySourceRaw, todayCount, total] = await Promise.all([
      Enquiry.aggregate([
        { $match: scope },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ]),
      Enquiry.aggregate([
        { $match: scope },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Enquiry.countDocuments({ ...scope, createdAt: { $gte: startOfToday } }),
      Enquiry.countDocuments(scope),
    ]);

    // Seed every stage at 0 so the dashboard never renders gaps for stages
    // that happen to be empty.
    const byStage = Object.fromEntries(ENQUIRY_STAGES.map((s) => [s, 0])) as Record<
      EnquiryStage,
      number
    >;
    for (const row of byStageRaw) byStage[row._id as EnquiryStage] = row.count;

    const admitted = byStage.admitted;
    // Conversion is measured against enquiries that reached a terminal state;
    // counting still-open enquiries as failures would understate it early on.
    const closed = admitted + byStage.cancelled;
    const conversionRate = closed > 0 ? Math.round((admitted / closed) * 100) : 0;

    sendResponse(res, {
      message: 'Stats fetched',
      data: {
        byStage,
        bySource: bySourceRaw.map((r) => ({ source: r._id, count: r.count })),
        todayCount,
        total,
        conversionRate,
      },
    });
  }
);
