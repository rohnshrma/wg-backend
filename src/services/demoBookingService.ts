import mongoose from 'mongoose';
import Enquiry from '../models/Enquiry';
import DemoBooking, { IDemoBooking } from '../models/DemoBooking';
import env from '../config/env';
import { NotificationService } from './notificationService';

interface CreateDemoBookingParams {
  enquiryId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  course: string;
  preferredDate: string;
  preferredTime: string;
  changedBy: mongoose.Types.ObjectId; // the automation's owner account — see whatsappConversationService
}

export type CreateDemoBookingResult =
  | { ok: true; booking: IDemoBooking }
  | { ok: false; reason: 'duplicate' | 'error' };

/**
 * Creates a demo booking and moves the Enquiry to `demo_scheduled` — mirrors
 * the exact stageHistory-append pattern `moveEnquiryStage` uses in
 * enquiry.controller.ts, so this can't drift from how a human-driven stage
 * change is journalled. Never claims success to the caller until the DB
 * write actually commits (per the brief: never tell a customer "your demo
 * is booked" before the backend confirms it).
 */
export const createDemoBooking = async (
  params: CreateDemoBookingParams
): Promise<CreateDemoBookingResult> => {
  const { enquiryId, name, phone, course, preferredDate, preferredTime, changedBy } = params;

  const existingActive = await DemoBooking.findOne({ enquiryId, status: 'scheduled' });
  if (existingActive) {
    return { ok: false, reason: 'duplicate' };
  }

  try {
    const booking = await DemoBooking.create({
      enquiryId,
      name,
      phone,
      course,
      preferredDate,
      preferredTime,
      feeAmount: env.DEMO_FEE_AMOUNT,
      paymentStatus: env.DEMO_FEE_AMOUNT > 0 ? 'pending' : 'not_required',
    });

    const enquiry = await Enquiry.findById(enquiryId);
    if (enquiry && enquiry.stage !== 'demo_scheduled') {
      enquiry.stageHistory.push({
        fromStage: enquiry.stage,
        toStage: 'demo_scheduled',
        changedBy,
        changedAt: new Date(),
        note: 'Booked via WhatsApp AI admissions automation',
      });
      enquiry.stage = 'demo_scheduled';
      await enquiry.save();
    }

    NotificationService.whatsappDemoScheduled({
      name,
      phone,
      course,
      date: preferredDate,
      time: preferredTime,
      paymentStatus: booking.paymentStatus,
      enquiryRef: String(enquiryId),
    }).catch((error) => console.error('[demo-booking] notification failed:', error));

    return { ok: true, booking };
  } catch (error: any) {
    // The partial unique index (enquiryId+status:'scheduled') is the last
    // line of defense against a race between two near-simultaneous webhook
    // deliveries — treat a duplicate-key error the same as the pre-check
    // above rather than a generic failure.
    if (error?.code === 11000) {
      return { ok: false, reason: 'duplicate' };
    }
    console.error('[demo-booking] create failed:', error);
    return { ok: false, reason: 'error' };
  }
};
