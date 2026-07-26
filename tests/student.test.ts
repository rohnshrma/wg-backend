import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import Student from '../src/models/Student';
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

const validProfilePayload = {
  fullName: 'Test Student',
  dateOfBirth: '2000-01-01',
  gender: 'male',
  fatherName: 'Father',
  motherName: 'Mother',
  parentContactNumber: '9999999999',
  studentContactNumber: '8888888888',
  email: 'student@example.com',
  address: { street: '1 Main St', city: 'City', state: 'State', pincode: '123456' },
  qualification: 'B.Tech',
  courseFees: 50000,
  joiningDate: '2026-01-01',
  paymentMode: 'emi',
};

describe('Student profile — mass-assignment protection', () => {
  it('lets a student create and self-edit their own profile within the allowed fields', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'student@example.com', password: 'Password123' });

    const create = await agent.put('/api/students/profile').send(validProfilePayload);
    expect(create.status).toBe(200);
    expect(create.body.data.status).toBe('pending');
    expect(create.body.data.isProfileLocked).toBe(false);
    expect(create.body.data.totalPaid).toBe(0);

    const studentId = create.body.data._id;

    const selfEdit = await agent
      .put(`/api/students/${studentId}`)
      .send({ fullName: 'Updated Name' });
    expect(selfEdit.status).toBe(200);
    expect(selfEdit.body.data.fullName).toBe('Updated Name');
  });

  it('blocks a student from self-approving or crediting themselves via the generic update route', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'attacker@example.com', password: 'Password123' });

    const create = await agent.put('/api/students/profile').send(validProfilePayload);
    const studentId = create.body.data._id;

    const exploit = await agent.put(`/api/students/${studentId}`).send({
      status: 'approved',
      isProfileLocked: true,
      totalPaid: 999999,
      admissionId: 'HACKED-001',
      approvedBy: studentId,
    });

    expect(exploit.status).toBe(200);
    expect(exploit.body.data.status).toBe('pending');
    expect(exploit.body.data.isProfileLocked).toBe(false);
    expect(exploit.body.data.totalPaid).toBe(0);
    expect(exploit.body.data.admissionId).toBeUndefined();

    const persisted = await Student.findById(studentId);
    expect(persisted?.status).toBe('pending');
    expect(persisted?.totalPaid).toBe(0);
  });

  it('blocks a student from editing another student\'s profile', async () => {
    const victim = request.agent(app);
    await victim.post('/api/auth/register').send({ email: 'victim@example.com', password: 'Password123' });
    const victimProfile = await victim.put('/api/students/profile').send(validProfilePayload);
    const victimId = victimProfile.body.data._id;

    const attacker = request.agent(app);
    await attacker.post('/api/auth/register').send({ email: 'other-attacker@example.com', password: 'Password123' });

    const res = await attacker.put(`/api/students/${victimId}`).send({ fullName: 'Pwned' });
    expect(res.status).toBe(403);

    const persisted = await Student.findById(victimId);
    expect(persisted?.fullName).toBe('Test Student');
  });

  it('lets an admin update any field on a student record', async () => {
    await User.create({ email: 'admin@example.com', password: 'Password123', role: 'admin' });
    const student = await Student.create({
      userId: (await User.create({ email: 'managed-student@example.com', password: 'Password123', role: 'student' }))._id,
      ...validProfilePayload,
      dateOfBirth: new Date(validProfilePayload.dateOfBirth),
      joiningDate: new Date(validProfilePayload.joiningDate),
    });

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'Password123' });

    const res = await agent.put(`/api/students/${student._id}`).send({ status: 'approved', totalPaid: 25000 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.totalPaid).toBe(25000);
  });
});
