/**
 * One-time migration for the multi-tenant retrofit: creates a single
 * "webigeeks" Tenant record (seeded from the existing singleton Settings
 * doc, falling back to env CONTACT_* defaults if Settings doesn't exist
 * yet) and backfills tenantId onto every existing document across every
 * retrofitted collection. Safe to re-run — upserts the tenant by slug and
 * only backfills documents missing tenantId.
 */
import mongoose from 'mongoose';
import env from '../config/env';
import Tenant from '../models/Tenant';
import Settings from '../models/Settings';
import User from '../models/User';
import Lead from '../models/Lead';
import Student from '../models/Student';
import Enquiry from '../models/Enquiry';
import Course from '../models/Course';
import Payment from '../models/Payment';
import Installment from '../models/Installment';
import Mandate from '../models/Mandate';
import Blog from '../models/Blog';
import Gallery from '../models/Gallery';
import Testimonial from '../models/Testimonial';
import Notification from '../models/Notification';
import Comment from '../models/Comment';

async function migrate() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB. Migrating default tenant...');

  const settings = await Settings.findOne();

  const tenant = await Tenant.findOneAndUpdate(
    { slug: env.DEFAULT_TENANT_SLUG },
    {
      $setOnInsert: {
        slug: env.DEFAULT_TENANT_SLUG,
        name: settings?.siteName || 'WebiGeeks',
        contactPhone: settings?.contactPhone || env.CONTACT_PHONE,
        contactEmail: settings?.contactEmail || env.CONTACT_EMAIL,
        address: settings?.address || 'M-18, Ground Floor, Old DLF Colony, Sector-14, Gurugram, Haryana',
        // Set explicitly rather than relying on schema defaults applying on
        // upsert — matches wg-frontend's actual brand palette.
        colors: { primary: '#1672B8', secondary: '#606062', accent: '#F97316' },
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  console.log(`Tenant ready: ${tenant.slug} (${tenant._id})`);

  const result = await User.updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: tenant._id } }
  );
  console.log(`Backfilled tenantId on ${result.modifiedCount} user(s).`);

  const collectionsToBackfill: Array<{ name: string; model: mongoose.Model<any> }> = [
    { name: 'lead', model: Lead },
    { name: 'student', model: Student },
    { name: 'enquiry', model: Enquiry },
    { name: 'course', model: Course },
    { name: 'payment', model: Payment },
    { name: 'installment', model: Installment },
    { name: 'mandate', model: Mandate },
    { name: 'blog', model: Blog },
    { name: 'gallery', model: Gallery },
    { name: 'testimonial', model: Testimonial },
    { name: 'notification', model: Notification },
    { name: 'comment', model: Comment },
  ];

  for (const { name, model } of collectionsToBackfill) {
    const res = await model.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: tenant._id } }
    );
    console.log(`Backfilled tenantId on ${res.modifiedCount} ${name}(s).`);
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
