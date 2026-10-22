import request from 'supertest';
import axios from 'axios';
import app from '../src/app';
import User from '../src/models/User';
import Student from '../src/models/Student';
import Course from '../src/models/Course';
import Payment from '../src/models/Payment';
import Installment from '../src/models/Installment';
import MessageLog from '../src/models/MessageLog';
import transporter from '../src/config/email';
import { sendEmail } from '../src/services/emailService';
import { sendWhatsAppText } from '../src/services/whatsappService';
import { runInstallmentReminders } from '../src/jobs/installmentReminders';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';

beforeAll(async () => {
  await connectTestDB();
});

beforeEach(() => {
  // Never hit real SMTP / WhatsApp from these tests.
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
  const adminUser = await User.create({ email: 'dnd-admin@example.com', password: 'Password123', role: 'admin' });
  const studentUser = await User.create({
    email: 'vishal-login@example.com',
    password: 'Password123',
    role: 'student',
  });
  const course = await Course.create({
    title: 'MERN Stack',
    shortDescription: 'MERN',
    fullDescription: 'MERN in depth',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    duration: '6 months',
    fees: 50000,
  });
  const student = await Student.create({
    userId: studentUser._id,
    status: 'approved',
    admissionId: 'WG-TEST-001',
    fullName: 'Vishal Test',
    dateOfBirth: new Date('2000-01-01'),
    gender: 'male',
    fatherName: 'Father',
    motherName: 'Mother',
    parentContactNumber: '9999999999',
    studentContactNumber: '+91 98765 43210',
    email: 'vishal@example.com',
    address: { street: '1 Main St', city: 'City', state: 'State', pincode: '123456' },
    qualification: 'B.Tech',
    courseId: course._id,
    courseFees: 50000,
    totalPaid: 10000,
    joiningDate: new Date('2026-01-01'),
    paymentMode: 'emi',
  });
  await Payment.create({
    studentId: student._id,
    courseId: course._id,
    amount: 10000,
    paymentMode: 'emi',
    paymentMethod: 'upi',
    transactionId: 'TXN-1',
    receiptNumber: 'RCPT-TEST-1',
    recordedBy: adminUser._id,
  } as any);

  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ email: 'dnd-admin@example.com', password: 'Password123' });
  return { admin, student, studentUser, course };
};

describe('Do Not Disturb', () => {
  it('blocks every email and WhatsApp to a muted student until unmuted, and logs them as suppressed', async () => {
    const { admin, student } = await setup();

    const mute = await admin.patch(`/api/students/${student._id}/notifications`).send({ muted: true });
    expect(mute.status).toBe(200);
    expect(mute.body.data.notificationsMuted).toBe(true);

    // Profile email, login email, and the phone in a different format.
    expect(await sendEmail({ to: 'vishal@example.com', subject: 'Receipt', html: '<p>hi</p>' })).toBe(false);
    expect(await sendEmail({ to: 'Vishal-Login@example.com', subject: 'Reset', html: '<p>hi</p>' })).toBe(false);
    expect(await sendWhatsAppText('9876543210', 'reminder')).toBe(false);
    expect(transporter.sendMail).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(await MessageLog.countDocuments({ status: 'suppressed' })).toBe(3);

    // Other recipients are unaffected.
    expect(await sendEmail({ to: 'someone-else@example.com', subject: 'x', html: 'x' })).toBe(true);

    await admin.patch(`/api/students/${student._id}/notifications`).send({ muted: false });
    expect(await sendEmail({ to: 'vishal@example.com', subject: 'Back', html: '<p>hi</p>' })).toBe(true);
    expect(await MessageLog.countDocuments({ to: 'vishal@example.com', status: 'sent' })).toBe(1);
  });

  it('skips installment reminders (manual and AutoPay) for a muted student', async () => {
    const { admin, student } = await setup();
    await admin.patch(`/api/students/${student._id}/notifications`).send({ muted: true });

    await Installment.create([
      { studentId: student._id, installmentNumber: 1, amount: 5000, dueDate: new Date(Date.now() - 86400000) },
      {
        studentId: student._id,
        installmentNumber: 2,
        amount: 5000,
        dueDate: new Date(Date.now() + 86400000),
        collectionMethod: 'autopay',
      },
    ] as any);

    await runInstallmentReminders();

    expect(transporter.sendMail).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(await Installment.countDocuments({ reminderSent: true })).toBe(0);
  });

  it('rejects non-admins', async () => {
    const { student } = await setup();
    const studentAgent = request.agent(app);
    await studentAgent.post('/api/auth/login').send({ email: 'vishal-login@example.com', password: 'Password123' });
    const res = await studentAgent.patch(`/api/students/${student._id}/notifications`).send({ muted: true });
    expect(res.status).toBe(403);
  });
});

describe('Cancel admission', () => {
  it('cancels without deleting anything, turns on DND, and can be reinstated', async () => {
    const { admin, student, studentUser } = await setup();

    const res = await admin.patch(`/api/students/${student._id}/cancel-admission`).send({
      reason: 'Non-payment of fees and a false e-commerce fraud complaint',
    });
    expect(res.status).toBe(200);

    const after = await Student.findById(student._id);
    expect(after?.status).toBe('cancelled');
    expect(after?.cancellationReason).toBe('Non-payment of fees and a false e-commerce fraud complaint');
    expect(after?.notificationsMuted).toBe(true);
    // Everything retained.
    expect(after?.admissionId).toBe('WG-TEST-001');
    expect(after?.totalPaid).toBe(10000);
    expect(await Payment.countDocuments({ studentId: student._id })).toBe(1);
    expect(await User.exists({ _id: studentUser._id })).toBeTruthy();

    // Login shows the cancellation, but never the internal reason.
    const studentAgent = request.agent(app);
    const login = await studentAgent
      .post('/api/auth/login')
      .send({ email: 'vishal-login@example.com', password: 'Password123' });
    expect(login.body.data.user.isAdmissionCancelled).toBe(true);
    expect(JSON.stringify(login.body)).not.toContain('fraud');

    // Can't be "approved" over the top (would mint a new admission ID).
    expect((await admin.patch(`/api/students/${student._id}/approve`)).status).toBe(400);
    expect((await admin.patch(`/api/students/${student._id}/cancel-admission`).send({ reason: 'x' })).status).toBe(400);

    const reinstate = await admin.patch(`/api/students/${student._id}/reinstate`);
    expect(reinstate.status).toBe(200);
    expect(reinstate.body.data.status).toBe('approved');
    expect(reinstate.body.data.admissionId).toBe('WG-TEST-001');
  });

  it('sends the optional notice before DND blocks it', async () => {
    const { admin, student } = await setup();
    const res = await admin.patch(`/api/students/${student._id}/cancel-admission`).send({
      reason: 'Non-payment',
      sendEmail: true,
      emailSubject: 'Admission cancelled',
      emailMessage: 'Your admission is cancelled.',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.emailSent).toBe(true);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  });

  it('requires a reason, and email text when sending a notice', async () => {
    const { admin, student } = await setup();
    expect((await admin.patch(`/api/students/${student._id}/cancel-admission`).send({})).status).toBe(422);
    expect(
      (await admin.patch(`/api/students/${student._id}/cancel-admission`).send({ reason: 'x', sendEmail: true })).status
    ).toBe(422);
  });
});

describe('Communications history', () => {
  it('returns in-app notifications, logged messages (incl. suppressed) and reminders', async () => {
    const { admin, student } = await setup();
    await sendEmail({ to: 'vishal@example.com', subject: 'Fee reminder', html: '<p>Pay ₹5,000</p>' });
    await sendWhatsAppText('9876543210', 'Reminder');
    await admin.patch(`/api/students/${student._id}/notifications`).send({ muted: true });
    await sendEmail({ to: 'vishal@example.com', subject: 'Blocked', html: '<p>x</p>' });
    await sendEmail({ to: 'unrelated@example.com', subject: 'Other', html: '<p>x</p>' });

    const res = await admin.get(`/api/students/${student._id}/communications`);
    expect(res.status).toBe(200);
    const { messages } = res.body.data;
    expect(messages).toHaveLength(3);
    expect(messages.map((m: any) => m.status).sort()).toEqual(['sent', 'sent', 'suppressed']);
    expect(messages.find((m: any) => m.subject === 'Fee reminder').preview).toContain('Pay ₹5,000');
  });
});
