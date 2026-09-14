/**
 * One-time migration for the multi-tenant retrofit: creates a single
 * "webigeeks" Tenant record (seeded from the existing singleton Settings
 * doc, falling back to env CONTACT_* defaults if Settings doesn't exist
 * yet) and backfills tenantId onto every existing User. Safe to re-run —
 * upserts the tenant by slug and only backfills Users missing tenantId.
 *
 * Other collections (Lead, Student, Course, etc.) are intentionally left
 * out of this script — their tenantId backfill belongs with whichever
 * change actually adds the field to each model, so schema and data
 * migration stay in the same commit.
 */
import mongoose from 'mongoose';
import env from '../config/env';
import Tenant from '../models/Tenant';
import Settings from '../models/Settings';
import User from '../models/User';

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
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
