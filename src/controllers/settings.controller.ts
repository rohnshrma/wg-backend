import { Request, Response } from 'express';
import Settings from '../models/Settings';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { BadRequestError } from '../utils/apiError';

const DEFAULTS = {
  siteName: 'WebiGeeks',
  contactPhone: '+91 8766367815',
  contactEmail: 'webigeeksofficial@gmail.com',
  address: 'M-18, Ground Floor, Old DLF Colony, Sector-14, Gurugram, Haryana',
};

/**
 * Settings is a singleton — there is always exactly one document. It's
 * created lazily on first read/write rather than via a seed script.
 */
const getOrCreateSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create(DEFAULTS);
  }
  return settings;
};

export const getSettings = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const settings = await getOrCreateSettings();
  sendResponse(res, { message: 'Settings fetched', data: settings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { siteName, contactPhone, contactEmail, address } = req.body;
  if (!siteName || !contactPhone || !contactEmail || !address) {
    throw new BadRequestError('siteName, contactPhone, contactEmail, and address are all required');
  }

  const settings = await getOrCreateSettings();
  settings.siteName = siteName;
  settings.contactPhone = contactPhone;
  settings.contactEmail = contactEmail;
  settings.address = address;
  await settings.save();

  sendResponse(res, { message: 'Settings updated', data: settings });
});
