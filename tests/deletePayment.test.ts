import request from 'supertest';
import axios from 'axios';
import app from '../src/app';
import User from '../src/models/User';
import Student from '../src/models/Student';
import Course from '../src/models/Course';
import Payment from '../src/models/Payment';
import Installment from '../src/models/Installment';
import DeletedPayment from '../src/models/DeletedPayment';
import transporter from '../src/config/email';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';

beforeAll(async () => {
  await connectTestDB();
});

beforeEach(() => {
  jest.spyOn(transporter, 'sendMail').mockResolvedValue({} as any);
  jest.spyOn(axios, 'post').mockResolvedValue({ data: {} });
});

afterEach(async () => {
  jest.restoreAllMocks();
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

const setup = async () => {
  await User.create({ email: 'pay-admin@example.com', password: 'Password123', role: 'admin' });
  const studentUser = await User.create({ email: 'palak@example.com', password: 'Password123', role: 'student' });
  const course = await Course.create({
    title: 'MERN Stack',
    shortDescription: 'MERN',
    fullDescription: 'MERN in depth',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    duration: '6 months',
    fees: 33000,
  });
  const student = await Student.create({
    userId: studentUser._id,
    status: 'approved',
    admissionId: 'WEBI-TEST-14',
    fullName: 'Palak Test',
    dateOfBirth: new Date('2000-01-01'),
    gender: 'female',
    fatherName: 'Father',
    motherName: 'Mother',
    parentContactNumber: '9999999999',
    studentContactNumber: '8888888888',
    email: 'palak@example.com',
    address: { street: '1 Main St', city: 'City', state: 'State', pincode: '123456' },
    qualification: 'B.Tech',
    courseId: course._id,
    courseFees: 33000,
    joiningDate: new Date('2026-01-01'),
    paymentMode: 'emi',
  });
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ email: 'pay-admin@example.com', password: 'Password123' });
  return { admin, student, course };
};

describe('Delete payment', () => {
  it('removes the payment, reinstates the amount, reopens installments and keeps an audit copy', async () => {
    const { admin, student, course } = await setup();
    await Installment.create(
      [1, 2, 3].map((n) => ({
        studentId: student._id,
        installmentNumber: n,
        amount: 11000,
        dueDate: new Date(Date.now() + n * 30 * 86400000),
      })) as any
    );

    const rec = await admin.post('/api/payments').send({
      studentId: student._id,
      courseId: course._id,
      amount: 11000,
      paymentMethod: 'upi',
      transactionId: 'OOPS-1',
    });
    expect(rec.status).toBe(201);
    expect((await Student.findById(student._id))?.totalPaid).toBe(11000);
    expect(await Installment.countDocuments({ status: 'paid' })).toBe(1);

    const del = await admin.delete(`/api/payments/${rec.body.data._id}`).send({ reason: 'Recorded by accident' });
    expect(del.status).toBe(200);

    const after = await Student.findById(student._id);
    expect(after?.totalPaid).toBe(0);
    expect(after?.pendingAmount).toBe(33000);
    expect(await Payment.countDocuments({ studentId: student._id })).toBe(0);
    expect(await Installment.countDocuments({ status: 'paid' })).toBe(0);
    const reopened = await Installment.findOne({ installmentNumber: 1 });
    expect(reopened?.status).toBe('pending');
    expect(reopened?.paymentId).toBeUndefined();

    const audit = await DeletedPayment.findOne({ receiptNumber: rec.body.data.receiptNumber });
    expect(audit?.reason).toBe('Recorded by accident');
    expect(audit?.amount).toBe(11000);
    expect(audit?.reopenedInstallmentIds).toHaveLength(1);
    expect((audit?.snapshot as any).transactionId).toBe('OOPS-1');
  });

  it('requires a reason, and admin access', async () => {
    const { admin, student, course } = await setup();
    const rec = await admin.post('/api/payments').send({
      studentId: student._id,
      courseId: course._id,
      amount: 5000,
      paymentMethod: 'cash',
    });
    expect((await admin.delete(`/api/payments/${rec.body.data._id}`).send({})).status).toBe(422);

    const studentAgent = request.agent(app);
    await studentAgent.post('/api/auth/login').send({ email: 'palak@example.com', password: 'Password123' });
    expect((await studentAgent.delete(`/api/payments/${rec.body.data._id}`).send({ reason: 'x' })).status).toBe(403);
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('refuses to delete an AutoPay payment collected through Razorpay', async () => {
    const { admin, student, course } = await setup();
    const adminUser = await User.findOne({ role: 'admin' });
    const payment = await Payment.create({
      studentId: student._id,
      courseId: course._id,
      amount: 11000,
      paymentMode: 'emi',
      paymentMethod: 'upi_autopay',
      receiptNumber: 'RCPT-AUTO-1',
      recordedBy: adminUser!._id,
    } as any);
    const res = await admin.delete(`/api/payments/${payment._id}`).send({ reason: 'x' });
    expect(res.status).toBe(400);
    expect(await Payment.exists({ _id: payment._id })).toBeTruthy();
  });
});
