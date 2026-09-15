import Enquiry from '../models/Enquiry';
import User from '../models/User';
import { ILead } from '../models/Lead';

const sanitizeMobile = (phone: string): string | null => {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

/**
 * Mirrors a newly-submitted website Lead into the admissions CRM's Enquiry
 * pipeline so counsellors see it without anyone re-keying it by hand.
 * Fire-and-forget from submitInquiry — a sync failure must never block the
 * visitor-facing lead save, since Lead is still the source of truth.
 */
export const createEnquiryFromLead = async (lead: ILead): Promise<void> => {
  const mobile = sanitizeMobile(lead.phone);
  if (!mobile) {
    console.error(
      `Lead ${lead._id}: phone "${lead.phone}" is not a valid 10-digit Indian mobile number, skipped enquiry sync`
    );
    return;
  }

  const existing = await Enquiry.findOne({
    tenantId: lead.tenantId,
    mobile,
    stage: { $nin: ['admitted', 'cancelled'] },
  });
  if (existing) return; // already being worked in the pipeline — don't create a duplicate

  // No public/anonymous path exists for Enquiry (owner/createdBy are required
  // User refs), so a website lead is assigned to the longest-standing active
  // admin **within its own tenant** until a counsellor reassigns it from the
  // pipeline board. Must stay scoped to `lead.tenantId` — an unscoped lookup
  // would hand one tenant's lead to a completely different tenant's admin.
  const defaultOwner = await User.findOne({ tenantId: lead.tenantId, role: 'admin', isActive: true }).sort({
    createdAt: 1,
  });
  if (!defaultOwner) {
    console.error(`Lead ${lead._id}: no active admin found in tenant ${lead.tenantId} to own the auto-created enquiry, skipped enquiry sync`);
    return;
  }

  await Enquiry.create({
    tenantId: lead.tenantId,
    name: lead.name,
    course: lead.courseInterested,
    mobile,
    email: lead.email || undefined,
    remarks: lead.message,
    source: 'website',
    stage: 'new_enquiry',
    owner: defaultOwner._id,
    createdBy: defaultOwner._id,
    stageHistory: [
      {
        fromStage: null,
        toStage: 'new_enquiry',
        changedBy: defaultOwner._id,
        changedAt: new Date(),
        note: `Auto-created from website lead (${lead.source})`,
      },
    ],
  });
};
