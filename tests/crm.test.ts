import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
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

async function adminAgent() {
  await User.create({ email: 'admin@example.com', password: 'Password123', role: 'admin' });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'Password123' });
  return agent;
}

async function counsellorAgent(email = 'counsellor@example.com') {
  await User.create({ email, password: 'Password123', role: 'counsellor', name: 'Test Counsellor' });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: 'Password123' });
  return agent;
}

async function studentAgent() {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .send({ email: 'student@example.com', password: 'Password123' });
  return agent;
}

const validEnquiry = (overrides: Record<string, unknown> = {}) => ({
  name: 'Rahul Sharma',
  course: 'Full Stack Development',
  mobile: '9876543210',
  source: 'justdial',
  ...overrides,
});

describe('CRM — enquiry lifecycle', () => {
  it('creates an enquiry in the new_enquiry stage with a seeded timeline', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/enquiries').send(validEnquiry());

    expect(res.status).toBe(201);
    expect(res.body.data.stage).toBe('new_enquiry');
    expect(res.body.data.stageHistory).toHaveLength(1);
    expect(res.body.data.stageHistory[0]).toMatchObject({
      fromStage: null,
      toStage: 'new_enquiry',
    });
    // Defaulted server-side so the client never has to send it.
    expect(res.body.data.enquiryDate).toBeTruthy();
  });

  it('ignores a client-supplied stage on create — everything starts in new_enquiry', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/enquiries').send(validEnquiry({ stage: 'admitted' }));

    expect(res.status).toBe(201);
    expect(res.body.data.stage).toBe('new_enquiry');
  });

  it('journals a stage move with the previous stage, actor and timestamp', async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/enquiries').send(validEnquiry());

    const moved = await admin
      .patch(`/api/enquiries/${created.body.data._id}/stage`)
      .send({ stage: 'demo_scheduled', note: 'Demo booked for Friday' });

    expect(moved.status).toBe(200);
    expect(moved.body.data.stage).toBe('demo_scheduled');
    expect(moved.body.data.stageHistory).toHaveLength(2);

    const entry = moved.body.data.stageHistory[1];
    expect(entry.fromStage).toBe('new_enquiry');
    expect(entry.toStage).toBe('demo_scheduled');
    expect(entry.note).toBe('Demo booked for Friday');
    expect(entry.changedBy.email).toBe('admin@example.com');
    expect(entry.changedAt).toBeTruthy();
  });

  it('records a stage change made through the edit form too', async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/enquiries').send(validEnquiry());

    const updated = await admin
      .put(`/api/enquiries/${created.body.data._id}`)
      .send({ stage: 'follow_up', remarks: 'Called, will decide next week' });

    expect(updated.status).toBe(200);
    expect(updated.body.data.stage).toBe('follow_up');
    expect(updated.body.data.stageHistory).toHaveLength(2);
    expect(updated.body.data.remarks).toBe('Called, will decide next week');
  });

  it('is a no-op when moved to the stage it is already in', async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/enquiries').send(validEnquiry());

    const moved = await admin
      .patch(`/api/enquiries/${created.body.data._id}/stage`)
      .send({ stage: 'new_enquiry' });

    expect(moved.status).toBe(200);
    expect(moved.body.data.stageHistory).toHaveLength(1);
  });
});

describe('CRM — validation', () => {
  it('rejects a malformed mobile number', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/enquiries').send(validEnquiry({ mobile: '12345' }));

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('mobile');
  });

  it('rejects a source outside the allowed list', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/enquiries').send(validEnquiry({ source: 'tiktok' }));

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('source');
  });

  it('rejects a malformed email when one is supplied', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/enquiries').send(validEnquiry({ email: 'not-an-email' }));

    expect(res.status).toBe(422);
  });

  it('accepts an enquiry with no email, since email is optional', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/enquiries').send(validEnquiry());

    expect(res.status).toBe(201);
  });

  it('rejects a second active enquiry for the same mobile number', async () => {
    const admin = await adminAgent();
    await admin.post('/api/enquiries').send(validEnquiry());
    const dup = await admin.post('/api/enquiries').send(validEnquiry({ name: 'Someone Else' }));

    expect(dup.status).toBe(400);
    expect(dup.body.message).toMatch(/already exists/i);
  });

  it('allows re-enquiry on the same mobile once the earlier one is closed', async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/enquiries').send(validEnquiry());
    await admin
      .patch(`/api/enquiries/${created.body.data._id}/stage`)
      .send({ stage: 'cancelled' });

    const again = await admin.post('/api/enquiries').send(validEnquiry({ name: 'Rahul Again' }));
    expect(again.status).toBe(201);
  });
});

describe('CRM — roles and ownership', () => {
  it('scopes a counsellor to their own enquiries', async () => {
    const admin = await adminAgent();
    await admin.post('/api/enquiries').send(validEnquiry());

    const counsellor = await counsellorAgent();
    const list = await counsellor.get('/api/enquiries');

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('lets an admin see every enquiry regardless of owner', async () => {
    const counsellor = await counsellorAgent();
    await counsellor.post('/api/enquiries').send(validEnquiry());

    const admin = await adminAgent();
    await admin.post('/api/enquiries').send(validEnquiry({ mobile: '9876543211' }));

    const list = await admin.get('/api/enquiries');
    expect(list.body.data).toHaveLength(2);
  });

  it('assigns a counsellor-created enquiry to that counsellor', async () => {
    const counsellor = await counsellorAgent();
    const res = await counsellor.post('/api/enquiries').send(validEnquiry());

    expect(res.body.data.owner.email).toBe('counsellor@example.com');
  });

  it("hides another user's enquiry from a counsellor", async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/enquiries').send(validEnquiry());

    const counsellor = await counsellorAgent();
    const res = await counsellor.get(`/api/enquiries/${created.body.data._id}`);

    expect(res.status).toBe(404);
  });

  it("refuses to let a counsellor move another user's enquiry", async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/enquiries').send(validEnquiry());

    const counsellor = await counsellorAgent();
    const res = await counsellor
      .patch(`/api/enquiries/${created.body.data._id}/stage`)
      .send({ stage: 'cancelled' });

    expect(res.status).toBe(403);
  });

  it('lets a counsellor move their own enquiry', async () => {
    const counsellor = await counsellorAgent();
    const created = await counsellor.post('/api/enquiries').send(validEnquiry());

    const res = await counsellor
      .patch(`/api/enquiries/${created.body.data._id}/stage`)
      .send({ stage: 'follow_up' });

    expect(res.status).toBe(200);
    expect(res.body.data.stage).toBe('follow_up');
  });

  it('reserves deletion for admins', async () => {
    const counsellor = await counsellorAgent();
    const created = await counsellor.post('/api/enquiries').send(validEnquiry());

    const denied = await counsellor.delete(`/api/enquiries/${created.body.data._id}`);
    expect(denied.status).toBe(403);

    const admin = await adminAgent();
    const allowed = await admin.delete(`/api/enquiries/${created.body.data._id}`);
    expect(allowed.status).toBe(200);
  });

  it('ignores an owner reassignment attempted by a counsellor', async () => {
    const admin = await adminAgent();
    const adminId = (await User.findOne({ email: 'admin@example.com' }))!._id;

    const counsellor = await counsellorAgent();
    const created = await counsellor
      .post('/api/enquiries')
      .send(validEnquiry({ owner: String(adminId) }));

    // The enquiry stays with its creator — only admins may assign.
    expect(created.body.data.owner.email).toBe('counsellor@example.com');
    void admin;
  });

  it('keeps students out of the CRM entirely', async () => {
    const student = await studentAgent();

    expect((await student.get('/api/enquiries')).status).toBe(403);
    expect((await student.post('/api/enquiries').send(validEnquiry())).status).toBe(403);
    expect((await student.get('/api/enquiries/stats')).status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/enquiries')).status).toBe(401);
    expect((await request(app).get('/api/enquiries/stats')).status).toBe(401);
  });
});

describe('CRM — search, filters and stats', () => {
  it('searches across name, mobile and course', async () => {
    const admin = await adminAgent();
    await admin.post('/api/enquiries').send(validEnquiry({ name: 'Alpha', course: 'Data Science' }));
    await admin
      .post('/api/enquiries')
      .send(validEnquiry({ name: 'Bravo', course: 'Java', mobile: '9111111112' }));

    const byName = await admin.get('/api/enquiries?search=Alpha');
    expect(byName.body.data).toHaveLength(1);

    const byMobile = await admin.get('/api/enquiries?search=9111111112');
    expect(byMobile.body.data).toHaveLength(1);
    expect(byMobile.body.data[0].name).toBe('Bravo');

    const byCourse = await admin.get('/api/enquiries?search=Data');
    expect(byCourse.body.data).toHaveLength(1);
    expect(byCourse.body.data[0].name).toBe('Alpha');
  });

  it('filters by stage and by source', async () => {
    const admin = await adminAgent();
    const a = await admin.post('/api/enquiries').send(validEnquiry({ source: 'website' }));
    await admin
      .post('/api/enquiries')
      .send(validEnquiry({ mobile: '9111111112', source: 'google_maps' }));
    await admin.patch(`/api/enquiries/${a.body.data._id}/stage`).send({ stage: 'admitted' });

    expect((await admin.get('/api/enquiries?stage=admitted')).body.data).toHaveLength(1);
    expect((await admin.get('/api/enquiries?source=google_maps')).body.data).toHaveLength(1);
  });

  it('reports per-stage counts, source breakdown and conversion rate', async () => {
    const admin = await adminAgent();
    const a = await admin.post('/api/enquiries').send(validEnquiry({ source: 'justdial' }));
    const b = await admin
      .post('/api/enquiries')
      .send(validEnquiry({ mobile: '9111111112', source: 'justdial' }));

    await admin.patch(`/api/enquiries/${a.body.data._id}/stage`).send({ stage: 'admitted' });
    await admin.patch(`/api/enquiries/${b.body.data._id}/stage`).send({ stage: 'cancelled' });

    const stats = await admin.get('/api/enquiries/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.data.byStage.admitted).toBe(1);
    expect(stats.body.data.byStage.cancelled).toBe(1);
    // Every stage is present even at zero, so the dashboard never shows gaps.
    expect(stats.body.data.byStage.demo_done).toBe(0);
    expect(stats.body.data.total).toBe(2);
    expect(stats.body.data.todayCount).toBe(2);
    // 1 admitted of 2 closed.
    expect(stats.body.data.conversionRate).toBe(50);
    expect(stats.body.data.bySource).toEqual([{ source: 'justdial', count: 2 }]);
  });

  it('scopes a counsellor’s stats to their own enquiries', async () => {
    const admin = await adminAgent();
    await admin.post('/api/enquiries').send(validEnquiry());

    const counsellor = await counsellorAgent();
    const stats = await counsellor.get('/api/enquiries/stats');

    expect(stats.body.data.total).toBe(0);
  });
});

describe('CRM — staff account management', () => {
  it('lets an admin create a counsellor who can then log in', async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/users').send({
      email: 'new.counsellor@example.com',
      password: 'Password123',
      name: 'New Counsellor',
      role: 'counsellor',
    });

    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe('counsellor');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'new.counsellor@example.com', password: 'Password123' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('counsellor');
  });

  it('rejects a duplicate email', async () => {
    const admin = await adminAgent();
    const payload = {
      email: 'dupe@example.com',
      password: 'Password123',
      name: 'Dupe',
      role: 'counsellor' as const,
    };
    await admin.post('/api/users').send(payload);
    const second = await admin.post('/api/users').send(payload);

    expect(second.status).toBe(409);
  });

  it('rejects an unknown role', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/users').send({
      email: 'weird@example.com',
      password: 'Password123',
      name: 'Weird',
      role: 'superuser',
    });

    expect(res.status).toBe(422);
  });

  it('refuses to delete the last remaining admin', async () => {
    const admin = await adminAgent();
    const self = await User.findOne({ email: 'admin@example.com' });
    const res = await admin.delete(`/api/users/${self!._id}`);

    expect(res.status).toBe(400);
  });

  it("reassigns a deleted counsellor's enquiries rather than orphaning them", async () => {
    const counsellor = await counsellorAgent();
    await counsellor.post('/api/enquiries').send(validEnquiry());
    const counsellorUser = await User.findOne({ email: 'counsellor@example.com' });

    const admin = await adminAgent();
    const del = await admin.delete(`/api/users/${counsellorUser!._id}`);
    expect(del.status).toBe(200);

    const list = await admin.get('/api/enquiries');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].owner.email).toBe('admin@example.com');
  });

  it('keeps staff management admin-only', async () => {
    const counsellor = await counsellorAgent();
    expect((await counsellor.get('/api/users')).status).toBe(403);
    expect(
      (
        await counsellor.post('/api/users').send({
          email: 'x@example.com',
          password: 'Password123',
          name: 'X',
          role: 'admin',
        })
      ).status
    ).toBe(403);
  });
});
