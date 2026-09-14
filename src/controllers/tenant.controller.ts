import { Request, Response } from 'express';
import Tenant from '../models/Tenant';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { NotFoundError } from '../utils/apiError';

/**
 * GET /api/tenant/current — public, resolved from Host header by
 * resolveTenant middleware. Returns only branding-safe fields.
 */
export const getCurrentTenant = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  sendResponse(res, {
    statusCode: 200,
    message: 'Tenant retrieved successfully',
    data: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      description: tenant.description,
      logoUrl: tenant.logoUrl,
      colors: tenant.colors,
      contactPhone: tenant.contactPhone,
      contactEmail: tenant.contactEmail,
      address: tenant.address,
    },
  });
});

/**
 * PUT /api/tenant/current — protected, admin-only. Updates the calling
 * admin's own tenant (req.tenantId from the authenticated user), never a
 * tenant supplied by the client, so one tenant's admin can never edit
 * another's branding.
 */
export const updateCurrentTenant = asyncHandler(async (req: Request, res: Response) => {
  const allowedUpdates = ['name', 'description', 'logoUrl', 'colors', 'contactPhone', 'contactEmail', 'address'];
  const updates: Record<string, unknown> = {};
  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const tenant = await Tenant.findByIdAndUpdate(req.tenantId, updates, {
    new: true,
    runValidators: true,
  });

  if (!tenant) throw new NotFoundError('Tenant not found');

  sendResponse(res, {
    statusCode: 200,
    message: 'Tenant updated successfully',
    data: tenant,
  });
});
