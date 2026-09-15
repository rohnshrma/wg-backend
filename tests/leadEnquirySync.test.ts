import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import Lead from '../src/models/Lead';
import Enquiry from '../src/models/Enquiry';
import { ITenant } from '../src/models/Tenant';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';
import { seedTestTenant } from './setup/tenant';

let tenant: ITenant;

beforeAll(async () => {
  await connectTestDB();
});

beforeEach(async () => {
  // POST /api/leads is public and goes through resolveTenant, which falls
  // back to DEFAULT_TENANT_SLUG when there's no Host match — this is what
  // seedTestTenant() seeds, so the request resolves to it without the test
  // needing to know the tenant id ahead of time.
  tenant = await seedTestTenant();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

const validSubmission = (overrides: Record<string, unknown> = {}) => ({
  name: 'Rahul Sharma',
  phone: '9876543210',
  email: 'rahul@example.com',
  courseInterested: 'Full Stack Development',
  source: 'popup',
  ...overrides,
});

// The lead->enquiry sync is fire-and-forget (started before the HTTP response
// is sent, not awaited by it) and does real DB I/O, so it can still be in
// flight once supertest's request resolves — poll briefly instead of a fixed
// delay/tick.
async function waitFor(check: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('waitFor: condition not met within timeout');
}

describe('public lead submission syncs into the enquiry pipeline', () => {
  it('creates a Lead and mirrors it into Enquiry, owned by the earliest active admin', async () => {
    const admin = await User.create({
      tenantId: tenant._id,
      email: 'admin@example.com',
      password: 'Password123',
      role: 'admin',
    });

    const res = await request(app).post('/api/leads').send(validSubmission());
    expect(res.status).toBe(201);

    const lead = await Lead.findOne({ phone: '9876543210' });
    expect(lead).not.toBeNull();
    expect(String(lead?.tenantId)).toBe(String(tenant._id));

    await waitFor(async () => (await Enquiry.exists({ mobile: '9876543210' })) !== null);
    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry).not.toBeNull();
    expect(String(enquiry?.tenantId)).toBe(String(tenant._id));
    expect(enquiry?.stage).toBe('new_enquiry');
    expect(enquiry?.source).toBe('website');
    expect(enquiry?.name).toBe('Rahul Sharma');
    expect(enquiry?.course).toBe('Full Stack Development');
    expect(String(enquiry?.owner)).toBe(String(admin._id));
    expect(String(enquiry?.createdBy)).toBe(String(admin._id));
    expect(enquiry?.stageHistory).toHaveLength(1);
    expect(enquiry?.stageHistory[0]).toMatchObject({ fromStage: null, toStage: 'new_enquiry' });
  });

  it('sanitizes a phone number with a country code / formatting before syncing', async () => {
    await User.create({ tenantId: tenant._id, email: 'admin@example.com', password: 'Password123', role: 'admin' });

    const res = await request(app)
      .post('/api/leads')
      .send(validSubmission({ phone: '+91 98765-43210' }));
    expect(res.status).toBe(201);

    await waitFor(async () => (await Enquiry.exists({ mobile: '9876543210' })) !== null);
    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry).not.toBeNull();
  });

  it('does not create a duplicate enquiry when an active one already exists for that mobile', async () => {
    const admin = await User.create({ tenantId: tenant._id, email: 'admin@example.com', password: 'Password123', role: 'admin' });
    await Enquiry.create({
      tenantId: tenant._id,
      name: 'Existing',
      course: 'Data Analytics',
      mobile: '9876543210',
      source: 'justdial',
      stage: 'follow_up',
      owner: admin._id,
      createdBy: admin._id,
      stageHistory: [{ fromStage: null, toStage: 'follow_up', changedBy: admin._id, changedAt: new Date() }],
    });

    const res = await request(app).post('/api/leads').send(validSubmission());
    expect(res.status).toBe(201);

    const lead = await Lead.findOne({ phone: '9876543210' });
    expect(lead).not.toBeNull();
    // No new enquiry to wait for here (the sync intentionally no-ops), so give
    // the fire-and-forget call a moment to finish before asserting the count.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const enquiries = await Enquiry.find({ mobile: '9876543210' });
    expect(enquiries).toHaveLength(1);
    expect(enquiries[0].stage).toBe('follow_up');
  });

  it('still saves the Lead even when no admin exists to own the synced enquiry', async () => {
    const res = await request(app).post('/api/leads').send(validSubmission());
    expect(res.status).toBe(201);

    const lead = await Lead.findOne({ phone: '9876543210' });
    expect(lead).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry).toBeNull();
  });

  it('does not leak across tenants: a duplicate in another tenant does not block sync, and the synced enquiry is never owned by another tenant\'s admin', async () => {
    // Tenant B has an active enquiry for the same mobile number, and an
    // admin who (by construction) is the earliest-created admin overall.
    // If the sync's queries weren't tenant-scoped, this admin could
    // wrongly become the owner, or the tenant-B enquiry could wrongly
    // count as an existing duplicate and suppress tenant A's sync.
    const tenantB = await seedTestTenant({ slug: 'tenant-b', contactEmail: 'tenant-b@example.com' });
    const otherAdmin = await User.create({
      tenantId: tenantB._id,
      email: 'other-admin@example.com',
      password: 'Password123',
      role: 'admin',
    });
    await Enquiry.create({
      tenantId: tenantB._id,
      name: 'Cross Tenant',
      course: 'Data Analytics',
      mobile: '9876543210',
      source: 'justdial',
      stage: 'follow_up',
      owner: otherAdmin._id,
      createdBy: otherAdmin._id,
      stageHistory: [{ fromStage: null, toStage: 'follow_up', changedBy: otherAdmin._id, changedAt: new Date() }],
    });

    // Tenant A's own admin is created after tenant B's, so an unscoped
    // "earliest active admin" lookup would pick otherAdmin instead.
    const ownAdmin = await User.create({
      tenantId: tenant._id,
      email: 'admin@example.com',
      password: 'Password123',
      role: 'admin',
    });

    const res = await request(app).post('/api/leads').send(validSubmission());
    expect(res.status).toBe(201);

    await waitFor(async () => (await Enquiry.countDocuments({ mobile: '9876543210' })) === 2);
    const ownEnquiry = await Enquiry.findOne({ tenantId: tenant._id, mobile: '9876543210' });
    expect(ownEnquiry).not.toBeNull();
    expect(String(ownEnquiry?.owner)).toBe(String(ownAdmin._id));
    expect(String(ownEnquiry?.owner)).not.toBe(String(otherAdmin._id));
  });
});
