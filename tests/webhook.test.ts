import crypto from 'crypto';
import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import Student from '../src/models/Student';
import Course from '../src/models/Course';
import Mandate from '../src/models/Mandate';
import Installment from '../src/models/Installment';
import Payment from '../src/models/Payment';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET as string;

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

async function postWebhook(payload: Record<string, unknown>, opts: { signature?: string; raw?: string } = {}) {
  const raw = opts.raw ?? JSON.stringify(payload);
  const signature = opts.signature ?? sign(raw);
  const req = request(app).post('/api/webhooks/razorpay').set('Content-Type', 'application/json');
  if (signature) req.set('X-Razorpay-Signature', signature);
  return req.send(raw);
}

async function setupStudentWithMandate(overrides: Record<string, unknown> = {}) {
  const course = await Course.create({
    title: 'Full Stack Development',
    shortDescription: 'Learn full stack development',
    fullDescription: 'Learn full stack development in depth',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    duration: '6 months',
    fees: 30000,
  });

  const user = await User.create({ email: 'student@example.com', password: 'Password123', role: 'student' });
  const student = await Student.create({
    userId: user._id,
    courseId: course._id,
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
  });

  const mandate = await Mandate.create({
    studentId: student._id,
    courseId: course._id,
    razorpayPlanId: 'plan_test123',
    razorpaySubscriptionId: 'sub_test123',
    status: 'created',
    amount: 10000,
    totalCount: 3,
    period: 'monthly',
    interval: 1,
    consent: { acceptedAt: new Date(), ip: '127.0.0.1' },
    ...overrides,
  });

  const installment = await Installment.create({
    studentId: student._id,
    installmentNumber: 1,
    amount: 10000,
    dueDate: new Date(),
    status: 'pending',
    mandateId: mandate._id,
    collectionMethod: 'autopay',
  });

  return { student, mandate, installment };
}

describe('Razorpay webhook — signature verification', () => {
  it('rejects a request with no signature header', async () => {
    const res = await postWebhook({ event: 'subscription.authenticated' }, { signature: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a request with a tampered/invalid signature', async () => {
    const res = await postWebhook({ event: 'subscription.authenticated' }, { signature: 'deadbeef'.repeat(8) });
    expect(res.status).toBe(400);
  });

  it('accepts a request with a valid signature', async () => {
    const res = await postWebhook({ event: 'subscription.authenticated', payload: {} });
    expect(res.status).toBe(200);
  });
});

describe('Razorpay webhook — subscription lifecycle', () => {
  it('subscription.authenticated activates the mandate', async () => {
    const { mandate } = await setupStudentWithMandate();

    const res = await postWebhook({
      event: 'subscription.authenticated',
      payload: { subscription: { entity: { id: mandate.razorpaySubscriptionId } } },
    });
    expect(res.status).toBe(200);

    const updated = await Mandate.findById(mandate._id);
    expect(updated?.status).toBe('active');
  });

  it('subscription.charged marks the next pending installment paid and records a Payment', async () => {
    const { student, mandate, installment } = await setupStudentWithMandate();

    const res = await postWebhook({
      event: 'subscription.charged',
      payload: {
        subscription: { entity: { id: mandate.razorpaySubscriptionId } },
        payment: { entity: { id: 'pay_test001', amount: 1000000 } },
      },
    });
    expect(res.status).toBe(200);

    const updatedInstallment = await Installment.findById(installment._id);
    expect(updatedInstallment?.status).toBe('paid');
    expect(updatedInstallment?.razorpayPaymentId).toBe('pay_test001');
    expect(updatedInstallment?.paidDate).toBeTruthy();

    const payments = await Payment.find({ studentId: student._id });
    expect(payments).toHaveLength(1);
    expect(payments[0].paymentMethod).toBe('upi_autopay');
    expect(payments[0].amount).toBe(10000);

    const updatedStudent = await Student.findById(student._id);
    expect(updatedStudent?.totalPaid).toBe(10000);
  });

  it('is idempotent — replaying the same charged delivery does not double-charge', async () => {
    const { mandate } = await setupStudentWithMandate();
    const payload = {
      event: 'subscription.charged',
      payload: {
        subscription: { entity: { id: mandate.razorpaySubscriptionId } },
        payment: { entity: { id: 'pay_test002', amount: 1000000 } },
      },
    };

    const first = await postWebhook(payload);
    expect(first.status).toBe(200);
    const second = await postWebhook(payload);
    expect(second.status).toBe(200);

    const payments = await Payment.find({});
    expect(payments).toHaveLength(1);

    const paidInstallments = await Installment.find({ status: 'paid' });
    expect(paidInstallments).toHaveLength(1);
  });

  it('payment.failed records the failure without changing installment status', async () => {
    const { mandate, installment } = await setupStudentWithMandate();

    const res = await postWebhook({
      event: 'payment.failed',
      payload: {
        payment: { entity: { id: 'pay_fail001', subscription_id: mandate.razorpaySubscriptionId, error_description: 'Insufficient balance' } },
      },
    });
    expect(res.status).toBe(200);

    const updated = await Installment.findById(installment._id);
    expect(updated?.status).toBe('pending');
    expect(updated?.autoDebitFailedAt).toBeTruthy();
    expect(updated?.autoDebitFailureReason).toBe('Insufficient balance');
  });

  it('subscription.halted pauses the mandate', async () => {
    const { mandate } = await setupStudentWithMandate();

    const res = await postWebhook({
      event: 'subscription.halted',
      payload: { subscription: { entity: { id: mandate.razorpaySubscriptionId } } },
    });
    expect(res.status).toBe(200);

    const updated = await Mandate.findById(mandate._id);
    expect(updated?.status).toBe('paused');
  });

  it('subscription.cancelled cancels the mandate', async () => {
    const { mandate } = await setupStudentWithMandate();

    const res = await postWebhook({
      event: 'subscription.cancelled',
      payload: { subscription: { entity: { id: mandate.razorpaySubscriptionId } } },
    });
    expect(res.status).toBe(200);

    const updated = await Mandate.findById(mandate._id);
    expect(updated?.status).toBe('cancelled');
  });
});
