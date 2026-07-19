import User from '../models/User';
import env from '../config/env';

const ensureDefaultAdmin = async (): Promise<void> => {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_DEFAULT_PASSWORD;

  if (!email || !password) {
    console.warn('⚠️  Default admin not configured. Set ADMIN_EMAIL and ADMIN_DEFAULT_PASSWORD.');
    return;
  }

  const existingAdmin = await User.findOne({ email });
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
    email,
    password,
    role: 'admin',
    isEmailVerified: true,
  });

  console.log(`✅ Default admin created: ${email}`);
};

export default ensureDefaultAdmin;
