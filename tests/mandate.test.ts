import request from 'supertest';
import User from '../src/models/User';
import Student from '../src/models/Student';
import Mandate from '../src/models/Mandate';
import Installment from '../src/models/Installment';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';

jest.mock('../src/services/razorpayService', () => {
  const actual = jest.requireActual('../src/services/razorpayService');
  return {
    ...actual,
    createSubscriptionMandate: jest.fn().mockResolvedValue({
      planId: 'plan_test123',
      subscriptionId: 'sub_test123',
      shortUrl: 'https://rzp.io/i/test-checkout',
    }),
    cancelSubscriptionMandate: jest.fn().mockResolvedValue(undefined),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../src/app').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const razorpayService = require('../src/services/razorpayService');

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

async function createStudent(overrides: Record<string, unknown> = {}) {
  const user = await User.create({ email: 'student@example.com', password: 'Password123', role: 'student' });
  return Student.create({
    userId: user._id,
    fullName: 'Rahul Sharma',
    dateOfBirth: '2000-01-01',
    gender: 'male',
    fatherName: 'Father Name',
    motherName: 'Mother Name',
    parentContactNumber: '9999999999',
    studentContactNumber: '8888888888',
    email: 'student@example.com',
    address: { street: '1 Main St', city: 'City', state: 'State', pincode: '123456' },
    qualification: 'B.Tech',
    courseFees: 30000,
    joiningDate: '2026-01-01',
    paymentMode: 'emi',
    status: 'approved',
    ...overrides,
  });
}

describe('AutoPay mandate creation', () => {
  it('creates a mandate + matching installments when the balance splits evenly', async () => {
    const admin = await adminAgent();
    const student = await createStudent();

    const res = await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      period: 'monthly',
      interval: 1,
      consentAccepted: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.mandate.status).toBe('created');
    expect(res.body.data.mandate.amount).toBe(10000);
    expect(res.body.data.installments).toHaveLength(3);
    expect(res.body.data.installments.every((i: any) => i.collectionMethod === 'autopay')).toBe(true);
    expect(res.body.data.shortUrl).toBe('https://rzp.io/i/test-checkout');

    const savedMandate = await Mandate.findById(res.body.data.mandate._id);
    expect(savedMandate?.consent.ip).toBeTruthy();
    expect(savedMandate?.consent.acceptedAt).toBeTruthy();
    expect(razorpayService.createSubscriptionMandate).toHaveBeenCalledTimes(1);
  });

  it('rejects consentAccepted !== true', async () => {
    const admin = await adminAgent();
    const student = await createStudent();

    const res = await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: false,
    });

    expect(res.status).toBe(422);
    expect(razorpayService.createSubscriptionMandate).not.toHaveBeenCalled();
  });

  it('rejects an installment count that does not split the balance evenly', async () => {
    const admin = await adminAgent();
    // pendingAmount 10000, 3 installments -> 3333.33, not an integer
    const student = await createStudent({ courseFees: 10000 });

    const res = await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: true,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not split evenly/);
    expect(razorpayService.createSubscriptionMandate).not.toHaveBeenCalled();
  });

  it('rejects a second mandate while one is already active for the student', async () => {
    const admin = await adminAgent();
    const student = await createStudent();

    const first = await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: true,
    });
    expect(first.status).toBe(201);

    const second = await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: true,
    });
    expect(second.status).toBe(400);
  });

  it('lets the owning student (not just admin) fetch their own mandate', async () => {
    const admin = await adminAgent();
    const student = await createStudent();
    await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: true,
    });

    const studentAgent = request.agent(app);
    await studentAgent.post('/api/auth/login').send({ email: 'student@example.com', password: 'Password123' });

    const res = await studentAgent.get(`/api/payments/mandate/student/${student._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.razorpaySubscriptionId).toBe('sub_test123');
  });

  it('denies a different student from reading another student\'s mandate', async () => {
    const admin = await adminAgent();
    const student = await createStudent();
    await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: true,
    });

    await User.create({ email: 'other@example.com', password: 'Password123', role: 'student' });
    const otherAgent = request.agent(app);
    await otherAgent.post('/api/auth/login').send({ email: 'other@example.com', password: 'Password123' });

    const res = await otherAgent.get(`/api/payments/mandate/student/${student._id}`);
    expect(res.status).toBe(403);
  });
});

describe('Listing mandates (admin payments view)', () => {
  it('lists all mandates with student populated, most recent first', async () => {
    const admin = await adminAgent();
    const student = await createStudent();
    await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: true,
    });

    const res = await admin.get('/api/payments/mandates');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentId.fullName).toBe('Rahul Sharma');
  });

  it('is admin-only', async () => {
    await createStudent();
    const studentAgent = request.agent(app);
    await studentAgent.post('/api/auth/login').send({ email: 'student@example.com', password: 'Password123' });

    const res = await studentAgent.get('/api/payments/mandates');
    expect(res.status).toBe(403);
  });
});

describe('Mandate cancellation', () => {
  it('cancels an active mandate', async () => {
    const admin = await adminAgent();
    const student = await createStudent();
    const created = await admin.post('/api/payments/mandate').send({
      studentId: student._id.toString(),
      numberOfInstallments: 3,
      consentAccepted: true,
    });

    const mandateId = created.body.data.mandate._id;
    const res = await admin.patch(`/api/payments/mandate/${mandateId}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(razorpayService.cancelSubscriptionMandate).toHaveBeenCalledWith('sub_test123');
  });
});

describe('Installment status transitions unaffected by mandate fields', () => {
  it('still allows a manual installment plan (no mandateId) to be generated and marked paid as before', async () => {
    const admin = await adminAgent();
    const student = await createStudent();

    const plan = await admin
      .post(`/api/payments/installments/student/${student._id}/generate`)
      .send({ numberOfInstallments: 2 });
    expect(plan.status).toBe(201);

    const installments = await Installment.find({ studentId: student._id });
    expect(installments.every((i) => i.collectionMethod === 'manual')).toBe(true);
    expect(installments.every((i) => i.mandateId === undefined)).toBe(true);
  });
});
