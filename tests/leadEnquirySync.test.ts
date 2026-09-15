import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import Lead from '../src/models/Lead';
import Enquiry from '../src/models/Enquiry';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';

beforeAll(async () => {
  await connectTestDB();
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
    const admin = await User.create({ email: 'admin@example.com', password: 'Password123', role: 'admin' });

    const res = await request(app).post('/api/leads').send(validSubmission());
    expect(res.status).toBe(201);

    const lead = await Lead.findOne({ phone: '9876543210' });
    expect(lead).not.toBeNull();

    await waitFor(async () => (await Enquiry.exists({ mobile: '9876543210' })) !== null);
    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry).not.toBeNull();
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
    await User.create({ email: 'admin@example.com', password: 'Password123', role: 'admin' });

    const res = await request(app)
      .post('/api/leads')
      .send(validSubmission({ phone: '+91 98765-43210' }));
    expect(res.status).toBe(201);

    await waitFor(async () => (await Enquiry.exists({ mobile: '9876543210' })) !== null);
    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry).not.toBeNull();
  });

  it('does not create a duplicate enquiry when an active one already exists for that mobile', async () => {
    const admin = await User.create({ email: 'admin@example.com', password: 'Password123', role: 'admin' });
    await Enquiry.create({
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
});
