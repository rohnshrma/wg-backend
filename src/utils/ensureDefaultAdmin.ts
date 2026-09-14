import User from '../models/User';
import Tenant from '../models/Tenant';
import env from '../config/env';

const ensureDefaultAdmin = async (): Promise<void> => {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_DEFAULT_PASSWORD;

  if (!email || !password) {
    console.warn('⚠️  Default admin not configured. Set ADMIN_EMAIL and ADMIN_DEFAULT_PASSWORD.');
    return;
  }

  // Fresh install (new dev machine, CI DB) may not have run
  // migrateDefaultTenant.ts yet, so guarantee the default tenant exists here
  // too rather than depending on migration order.
  const tenant = await Tenant.findOneAndUpdate(
    { slug: env.DEFAULT_TENANT_SLUG },
    {
      $setOnInsert: {
        slug: env.DEFAULT_TENANT_SLUG,
        name: 'WebiGeeks',
        contactPhone: env.CONTACT_PHONE,
        contactEmail: env.CONTACT_EMAIL,
        address: 'M-18, Ground Floor, Old DLF Colony, Sector-14, Gurugram, Haryana',
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  const existingAdmin = await User.findOne({ tenantId: tenant._id, email });
  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      existingAdmin.isActive = true;
      await existingAdmin.save({ validateBeforeSave: false });
      console.log(`✅ Promoted existing user to admin: ${email}`);
    }
    return;
  }

  await User.create({
    tenantId: tenant._id,
    email,
    password,
    role: 'admin',
    isEmailVerified: true,
  });

  console.log(`✅ Default admin created: ${email}`);
};

export default ensureDefaultAdmin;
